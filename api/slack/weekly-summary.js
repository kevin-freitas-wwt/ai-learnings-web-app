import { neon } from '@neondatabase/serverless'
import { WebClient } from '@slack/web-api'
import { generatePodcastScript, generatePodcastAudio } from '../_podcast.js'

function getDb() {
    return neon( process.env.POSTGRES_URL )
}

function formatEntry( entry ) {
    const bullets = entry.summary.slice( 0, 3 ).map( ( b ) => `  • ${b}` ).join( '\n' )
    const submitter = entry.submitter_name ? ` — ${entry.submitter_name}` : ''
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

    // Last 7 days
    const weekAgo = new Date()
    weekAgo.setUTCDate( weekAgo.getUTCDate() - 7 )
    weekAgo.setUTCHours( 0, 0, 0, 0 )

    const rows = await sql`
        SELECT * FROM entries
        WHERE created_at >= ${weekAgo.toISOString()}
        ORDER BY (heart_count + click_count) DESC, created_at DESC
    `

    if ( rows.length === 0 ) {
        return res.status( 200 ).json( { ok: true, sent: false, reason: 'No entries this week' } )
    }

    // Group into top-faved, top-clicked, rest (by combined score)
    const topFaved = [...rows].sort( ( a, b ) => b.heart_count - a.heart_count ).slice( 0, 3 )
    const topClicked = [...rows].sort( ( a, b ) => b.click_count - a.click_count ).slice( 0, 3 )
    const topFavedIds = new Set( topFaved.map( ( e ) => e.id ) )
    const topClickedIds = new Set( topClicked.map( ( e ) => e.id ) )
    const rest = rows.filter( ( e ) => !topFavedIds.has( e.id ) && !topClickedIds.has( e.id ) )

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
                text: `${rows.length} learning${rows.length !== 1 ? 's' : ''} shared this week. Here are the highlights:`,
            },
        },
        { type: 'divider' },
    ]

    if ( topFaved.length > 0 ) {
        blocks.push( {
            type: 'section',
            text: { type: 'mrkdwn', text: `*⭐ Most Fav'd*` },
        } )
        topFaved.forEach( ( e ) => blocks.push( { type: 'section', text: { type: 'mrkdwn', text: formatEntry( e ) } } ) )
        blocks.push( { type: 'divider' } )
    }

    if ( topClicked.length > 0 ) {
        blocks.push( {
            type: 'section',
            text: { type: 'mrkdwn', text: `*🔥 Most Clicked*` },
        } )
        topClicked.forEach( ( e ) => blocks.push( { type: 'section', text: { type: 'mrkdwn', text: formatEntry( e ) } } ) )
        blocks.push( { type: 'divider' } )
    }

    if ( rest.length > 0 ) {
        blocks.push( {
            type: 'section',
            text: { type: 'mrkdwn', text: `*📖 Also this week*` },
        } )
        rest.forEach( ( e ) => blocks.push( { type: 'section', text: { type: 'mrkdwn', text: formatEntry( e ) } } ) )
    }

    const msgResult = await slack.chat.postMessage( {
        channel,
        blocks,
        text: `📚 AI Learnings Week of ${weekStart}–${weekEnd}: ${rows.length} entries`,
        unfurl_links: false,
        unfurl_media: false,
    } )

    // Podcast generation — non-fatal, runs after the main summary is sent
    try {
        const top5 = [...rows]
            .sort( ( a, b ) => ( b.heart_count + b.click_count ) - ( a.heart_count + a.click_count ) )
            .slice( 0, 5 )

        const script = await generatePodcastScript( top5, weekStart, weekEnd )
        if ( !script?.length ) throw new Error( 'No script generated' )

        const audioBuffer = await generatePodcastAudio( script )
        if ( !audioBuffer ) throw new Error( 'No audio generated' )

        const dateSlug = weekStart.toLowerCase().replace( /\s/g, '-' )
        await slack.files.uploadV2( {
            channel_id: channel,
            thread_ts: msgResult.ts,
            filename: `ai-learnings-${dateSlug}.mp3`,
            file: audioBuffer,
            title: `🎙️ AI Learnings Podcast — Week of ${weekStart}–${weekEnd}`,
        } )
    } catch ( err ) {
        console.error( '[weekly-summary] podcast step failed:', err.message )
    }

    return res.status( 200 ).json( { ok: true, sent: true, count: rows.length } )
}
