import { neon } from '@neondatabase/serverless'
import { WebClient } from '@slack/web-api'

function getDb() {
    return neon( process.env.POSTGRES_URL )
}

function formatEntry( entry ) {
    const bullets = entry.summary.slice( 0, 3 ).map( ( b ) => `  • ${b}` ).join( '\n' )
    const submitter = entry.submitter_name ? ` — ${entry.submitter_name}` : ''
    return `*<${entry.url}|${entry.title}>*${submitter}\n${bullets}`
}

export default async function handler( req, res ) {
    // Allow Vercel Cron (GET with cron secret) or manual POST for testing
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

    // Entries created since midnight yesterday (UTC)
    const yesterday = new Date()
    yesterday.setUTCDate( yesterday.getUTCDate() - 1 )
    yesterday.setUTCHours( 0, 0, 0, 0 )

    const today = new Date()
    today.setUTCHours( 0, 0, 0, 0 )

    const rows = await sql`
        SELECT * FROM entries
        WHERE created_at >= ${yesterday.toISOString()}
          AND created_at <  ${today.toISOString()}
        ORDER BY (heart_count + click_count) DESC, created_at DESC
    `

    if ( rows.length === 0 ) {
        return res.status( 200 ).json( { ok: true, sent: false, reason: 'No entries yesterday' } )
    }

    const dateLabel = yesterday.toLocaleDateString( 'en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' } )
    const blocks = [
        {
            type: 'header',
            text: { type: 'plain_text', text: `📚 AI Learnings — ${dateLabel}` },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `${rows.length} new learning${rows.length !== 1 ? 's' : ''} shared yesterday:`,
            },
        },
        { type: 'divider' },
        ...rows.map( ( entry ) => ( {
            type: 'section',
            text: { type: 'mrkdwn', text: formatEntry( entry ) },
        } ) ),
    ]

    await slack.chat.postMessage( { channel, blocks, text: `📚 AI Learnings — ${dateLabel}: ${rows.length} new entries`, unfurl_links: false, unfurl_media: false } )

    return res.status( 200 ).json( { ok: true, sent: true, count: rows.length } )
}
