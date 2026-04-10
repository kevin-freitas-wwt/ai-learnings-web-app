import { neon } from '@neondatabase/serverless'
import { WebClient } from '@slack/web-api'
import { generatePodcastScript, generatePodcastAudio } from '../_podcast.js'

function getDb() {
    return neon( process.env.POSTGRES_URL )
}

// Builds a map of "Firstname L." -> Slack userId from the workspace member list
async function buildSlackUserMap( slack ) {
    const map = new Map()
    try {
        let cursor
        do {
            const res = await slack.users.list( { limit: 200, cursor } )
            for ( const member of res.members ?? [] ) {
                if ( member.deleted || member.is_bot ) continue
                const real = member.profile?.real_name || member.real_name || ''
                const parts = real.trim().split( /\s+/ )
                if ( parts.length < 2 ) continue
                const first = parts[0]
                const lastInitial = parts[parts.length - 1][0]
                const key = `${first} ${lastInitial}.`.toLowerCase()
                map.set( key, member.id )
            }
            cursor = res.response_metadata?.next_cursor
        } while ( cursor )
    } catch ( err ) {
        console.warn( '[weekly-summary] could not build Slack user map:', err.message )
    }
    return map
}

function formatEntry( entry, userMap ) {
    const bullets = entry.summary.slice( 0, 3 ).map( ( b ) => `  • ${b}` ).join( '\n' )
    let submitter = ''
    if ( entry.submitter_name ) {
        const userId = userMap?.get( entry.submitter_name.toLowerCase() )
        submitter = userId ? ` — <@${userId}>` : ` — ${entry.submitter_name}`
    }
    return `*<${entry.url}|${entry.title}>*${submitter}\n${bullets}`
}

export default async function handler( req, res ) {
    const cronSecret = process.env.CRON_SECRET
    if ( cronSecret ) {
        const auth = req.headers['authorization']
        if ( auth !== `Bearer ${cronSecret}` ) {
            return res.status( 401 ).json( { error: 'Unauthorized' } )
        }
    }

    const sql = getDb()
    const slack = new WebClient( process.env.SLACK_BOT_TOKEN )
    const channel = process.env.SLACK_CHANNEL_ID
    const userMap = await buildSlackUserMap( slack )

    // Last 7 days
    const weekAgo = new Date()
    weekAgo.setUTCDate( weekAgo.getUTCDate() - 7 )
    weekAgo.setUTCHours( 0, 0, 0, 0 )

    const rows = await sql`
        SELECT * FROM entries
        WHERE created_at >= ${weekAgo.toISOString()}
        ORDER BY (heart_count * 2 + click_count) DESC, created_at DESC
    `

    if ( rows.length === 0 ) {
        return res.status( 200 ).json( { ok: true, sent: false, reason: 'No entries this week' } )
    }

    // Top 5 by weighted score: hearts count double (stronger signal than clicks)
    const top5 = rows.slice( 0, 5 )

    const weekStart = weekAgo.toLocaleDateString( 'en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' } )
    const weekEnd = new Date().toLocaleDateString( 'en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' } )

    const blocks = [
        {
            type: 'header',
            text: { type: 'plain_text', text: `📚 AI Learnings — Week of ${weekStart}–${weekEnd}` },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `${rows.length} learning${rows.length !== 1 ? 's' : ''} shared this week. Here are the top ${top5.length}:`,
            },
        },
        { type: 'divider' },
    ]

    top5.forEach( ( e, i ) => {
        blocks.push( { type: 'section', text: { type: 'mrkdwn', text: `*${i + 1}.* ${formatEntry( e, userMap )}` } } )
        if ( i < top5.length - 1 ) blocks.push( { type: 'divider' } )
    } )

    const msgResult = await slack.chat.postMessage( {
        channel,
        blocks,
        text: `📚 AI Learnings Week of ${weekStart}–${weekEnd}: ${rows.length} entries`,
        unfurl_links: false,
        unfurl_media: false,
    } )

    // Podcast generation — non-fatal, runs after the main summary is sent
    try {
        const script = await generatePodcastScript( top5, weekStart, weekEnd )
        if ( !script?.length ) throw new Error( 'No script generated' )

        const { audio: audioBuffer, usage } = await generatePodcastAudio( script ) ?? {}
        if ( !audioBuffer ) throw new Error( 'No audio generated' )
        if ( usage ) console.log( `[podcast] ElevenLabs usage: ${usage.used} / ${usage.limit}` )

        const now = new Date()
        const month = now.toLocaleDateString( 'en-US', { month: 'long', timeZone: 'UTC' } ).toLowerCase()
        const day = now.toLocaleDateString( 'en-US', { day: '2-digit', timeZone: 'UTC' } )
        const year = now.toLocaleDateString( 'en-US', { year: 'numeric', timeZone: 'UTC' } )
        const dateSlug = `${month}-${day}-${year}`
        await slack.files.uploadV2( {
            channel_id: channel,
            thread_ts: msgResult.ts,
            filename: `ai-learnings-hub-${dateSlug}.mp3`,
            file: audioBuffer,
            title: `🎙️ AI Learnings Podcast — Week of ${weekStart}–${weekEnd}`,
        } )
    } catch ( err ) {
        console.error( '[weekly-summary] podcast step failed:', err.message )
    }

    return res.status( 200 ).json( { ok: true, sent: true, count: rows.length } )
}
