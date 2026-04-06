import { createHmac, timingSafeEqual } from 'crypto'
import { neon } from '@neondatabase/serverless'
import { WebClient } from '@slack/web-api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDb() {
    return neon( process.env.POSTGRES_URL )
}

function verifySlackSignature( req, rawBody ) {
    const signingSecret = process.env.SLACK_SIGNING_SECRET
    const timestamp = req.headers['x-slack-request-timestamp']
    const slackSig = req.headers['x-slack-signature']

    if ( !signingSecret || !timestamp || !slackSig ) return false

    // Reject requests older than 5 minutes
    if ( Math.abs( Date.now() / 1000 - Number( timestamp ) ) > 300 ) return false

    const base = `v0:${timestamp}:${rawBody}`
    const hmac = 'v0=' + createHmac( 'sha256', signingSecret ).update( base ).digest( 'hex' )
    try {
        return timingSafeEqual( Buffer.from( hmac ), Buffer.from( slackSig ) )
    } catch {
        return false
    }
}

/**
 * Parse a Slack message body for a submission.
 * Expected (loose) format:
 *   <URL>
 *   - bullet one
 *   - bullet two
 *   #tag1 #tag2
 *
 * Returns null if no URL found.
 */
function parseMessage( text ) {
    if ( !text ) return null

    // Extract first URL
    const urlMatch = text.match( /https?:\/\/[^\s>]+/ )
    if ( !urlMatch ) return null
    const url = urlMatch[0].replace( /[<>]/g, '' )

    // Extract hashtag-style tags (not part of URLs)
    const tags = []
    const tagRe = /(?<![:/\w])#(\w[\w-]*)/g
    let m
    while ( ( m = tagRe.exec( text ) ) !== null ) {
        tags.push( m[1].toLowerCase() )
    }

    // Extract bullet lines (-, *, •, or numbered)
    const bullets = []
    for ( const line of text.split( '\n' ) ) {
        const stripped = line.replace( /^[\s\-\*•\d\.]+/, '' ).trim()
        if ( stripped && !stripped.match( /^https?:\/\// ) && !stripped.startsWith( '#' ) ) {
            bullets.push( stripped )
        }
    }

    return { url, tags, bullets }
}

async function getDisplayName( slack, userId ) {
    try {
        const res = await slack.users.info( { user: userId } )
        return res.user?.profile?.display_name || res.user?.real_name || null
    } catch {
        return null
    }
}

async function fetchTitle( url ) {
    try {
        const res = await fetch( url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout( 5000 ) } )
        const html = await res.text()
        const match = html.match( /<title[^>]*>([^<]+)<\/title>/i )
        return match ? match[1].trim().replace( /&amp;/g, '&' ).replace( /&#39;/g, "'" ).replace( /&quot;/g, '"' ) : url
    } catch {
        return url
    }
}

function estimateReadingTime( bullets ) {
    const words = bullets.join( ' ' ).split( /\s+/ ).length
    return Math.max( 1, Math.round( words / 200 ) )
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const config = { api: { bodyParser: false } }

export default async function handler( req, res ) {
    if ( req.method !== 'POST' ) return res.status( 405 ).end()

    // Read raw body for signature verification
    const rawBody = await new Promise( ( resolve ) => {
        const chunks = []
        req.on( 'data', ( c ) => chunks.push( c ) )
        req.on( 'end', () => resolve( Buffer.concat( chunks ).toString( 'utf8' ) ) )
    } )

    if ( !verifySlackSignature( req, rawBody ) ) {
        return res.status( 401 ).json( { error: 'Invalid signature' } )
    }

    const body = JSON.parse( rawBody )

    // Slack URL verification challenge (one-time during app setup)
    if ( body.type === 'url_verification' ) {
        return res.status( 200 ).json( { challenge: body.challenge } )
    }

    // Acknowledge immediately — Slack expects 200 within 3s
    res.status( 200 ).end()

    const event = body.event
    if ( !event || event.type !== 'message' ) return
    if ( event.subtype ) return  // ignore edits, deletes, bot messages
    if ( event.bot_id ) return

    const channel = process.env.SLACK_CHANNEL_ID
    if ( channel && event.channel !== channel ) return

    const parsed = parseMessage( event.text )
    if ( !parsed || parsed.bullets.length === 0 ) return

    const slack = new WebClient( process.env.SLACK_BOT_TOKEN )
    const sql = getDb()

    const submitterName = await getDisplayName( slack, event.user )
    const title = await fetchTitle( parsed.url )
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const readingTime = estimateReadingTime( parsed.bullets )

    try {
        await sql`
            INSERT INTO entries
                (id, url, title, summary, tags, click_count, heart_count, created_at, submitter_name, reading_time)
            VALUES
                (${id}, ${parsed.url}, ${title}, ${JSON.stringify( parsed.bullets )}::jsonb,
                 ${JSON.stringify( parsed.tags )}::jsonb, 0, 0, ${now},
                 ${submitterName ?? null}, ${readingTime})
        `

        const tagsText = parsed.tags.length > 0 ? parsed.tags.map( ( t ) => `#${t}` ).join( ' ' ) : 'no tags'
        await slack.chat.postMessage( {
            channel: event.channel,
            thread_ts: event.ts,
            text: `✅ Added to AI Learnings Hub!\n*${title}*\n${parsed.bullets.length} learning${parsed.bullets.length !== 1 ? 's' : ''} · ${tagsText}`,
        } )
    } catch ( err ) {
        console.error( 'Slack submission error:', err )
        await slack.chat.postMessage( {
            channel: event.channel,
            thread_ts: event.ts,
            text: `❌ Failed to save that entry. Please try submitting via the web app.`,
        } ).catch( () => {} )
    }
}
