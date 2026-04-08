import { createHmac, timingSafeEqual } from 'crypto'
import { neon } from '@neondatabase/serverless'
import { WebClient } from '@slack/web-api'

const APP_URL = 'https://ai-learnings-web-app.vercel.app'

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
    if ( Math.abs( Date.now() / 1000 - Number( timestamp ) ) > 300 ) return false

    const base = `v0:${timestamp}:${rawBody}`
    const hmac = 'v0=' + createHmac( 'sha256', signingSecret ).update( base ).digest( 'hex' )
    try {
        return timingSafeEqual( Buffer.from( hmac ), Buffer.from( slackSig ) )
    } catch {
        return false
    }
}

function parseMessage( text ) {
    if ( !text ) return null

    const urlMatch = text.match( /https?:\/\/[^\s>]+/ )
    if ( !urlMatch ) return null
    const url = urlMatch[0].replace( /[<>]/g, '' )

    const tags = []
    const tagRe = /(?<![:/\w])#(\w[\w-]*)/g
    let m
    while ( ( m = tagRe.exec( text ) ) !== null ) {
        tags.push( m[1].toLowerCase() )
    }

    const bullets = []
    for ( const line of text.split( '\n' ) ) {
        const stripped = line.replace( /^[\s\-\*•\d\.]+/, '' ).trim()
        if ( stripped && !stripped.match( /^https?:\/\// ) && !stripped.startsWith( '#' ) ) {
            bullets.push( stripped )
        }
    }

    return { url, tags, bullets }
}

// Returns { type: 'recent' } or { type: 'search', term: string } or null
function parseQuery( text ) {
    if ( !text ) return null
    const t = text.trim()

    // Help: "help", "how does this work", "what can you do", etc.
    if ( /^(help|hi|hello|hey|howdy|sup|yo)[\s!?.,]*$/i.test( t ) ||
         /\b(help|how (does|do) (this|you|it) work|what can you do|what do you do|commands?|instructions?)\b/i.test( t ) ) {
        return { type: 'help' }
    }

    // Recent: "recent", "latest", "most recent", "show me the latest", etc.
    if ( /\b(recent|latest|newest|last few|most recent|new posts?|new articles?)\b/i.test( t ) ) {
        return { type: 'recent' }
    }

    // Search: "about X", "on X", "tagged X", "tag X", "articles about X", "posts about X", etc.
    const searchPatterns = [
        /\babout\s+(.+)/i,
        /\btagged\s+(.+)/i,
        /\btag[s]?\s+(.+)/i,
        /\brelated to\s+(.+)/i,
        /\bon\s+(.+)/i,
        /^(?:show me|find|search for|look for|get|what about)\s+(.+)/i,
    ]
    for ( const re of searchPatterns ) {
        const match = t.match( re )
        if ( match ) {
            const term = match[1].replace( /^(posts?|articles?|learnings?)\s+(about\s+)?/i, '' ).trim()
            if ( term.length > 0 ) return { type: 'search', term }
        }
    }

    // Bare search: single/multi-word message with no URL that doesn't match above
    // Only treat as search if it's short (≤ 6 words) and looks like a topic
    const words = t.split( /\s+/ )
    if ( words.length <= 6 && !t.match( /https?:\/\// ) ) {
        return { type: 'search', term: t }
    }

    return null
}

function formatEntryBlock( entry ) {
    const tags = Array.isArray( entry.tags ) ? entry.tags : []
    const tagsText = tags.length > 0 ? tags.map( ( t ) => `#${t}` ).join( '  ' ) : ''
    const date = entry.published_at
        ? new Date( entry.published_at ).toLocaleDateString( 'en-US', { month: 'short', day: 'numeric', year: 'numeric' } )
        : new Date( entry.created_at ).toLocaleDateString( 'en-US', { month: 'short', day: 'numeric', year: 'numeric' } )
    const sharedBy = entry.submitter_name ? `Shared by ${entry.submitter_name}` : null
    const meta = [date, tagsText, sharedBy].filter( Boolean ).join( '  ·  ' )

    const bullets = Array.isArray( entry.summary ) ? entry.summary : []
    const bulletsText = bullets.length > 0
        ? '\n' + bullets.map( ( b ) => `• ${b}` ).join( '\n' )
        : ''

    return {
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `*<${entry.url}|${entry.title}>*\n${meta}${bulletsText}`,
        },
    }
}

async function sendHelp( slack, channelId ) {
    await slack.chat.postMessage( {
        channel: channelId,
        text: 'Here\'s what I can do:',
        blocks: [
            {
                type: 'section',
                text: { type: 'mrkdwn', text: '*Here\'s what I can do:*' },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '*Search learnings*\n`articles about agents`\n`posts tagged llms`\n`show me prompting`',
                },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '*See recent posts*\n`recent articles`\n`show me the latest`',
                },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '*Save a new learning*\nPaste a URL with a short description and any `#tags`:\n```https://example.com/article  #agents #llms\nKey insight from this article.```',
                },
            },
            {
                type: 'context',
                elements: [{ type: 'mrkdwn', text: `You can also browse and submit learnings at <${APP_URL}|AI Learnings Hub>` }],
            },
        ],
    } )
}

async function handleQuery( query, slack, channelId ) {
    if ( query.type === 'help' ) {
        return sendHelp( slack, channelId )
    }

    const sql = getDb()
    let entries = []
    let header = ''

    if ( query.type === 'recent' ) {
        entries = await sql`
            SELECT id, url, title, summary, tags, created_at, published_at, submitter_name
            FROM entries
            ORDER BY COALESCE(published_at, created_at) DESC
            LIMIT 5
        `
        header = '*Most recent learnings:*'
    } else {
        const term = `%${query.term}%`
        entries = await sql`
            SELECT id, url, title, summary, tags, created_at, published_at, submitter_name
            FROM entries
            WHERE
                title ILIKE ${term}
                OR summary::text ILIKE ${term}
                OR tags::text ILIKE ${term}
            ORDER BY COALESCE(published_at, created_at) DESC
            LIMIT 5
        `
        header = `*Results for "${query.term}":*`
    }

    if ( entries.length === 0 ) {
        await slack.chat.postMessage( {
            channel: channelId,
            text: query.type === 'search'
                ? `No learnings found matching "${query.term}". Try a different keyword or browse everything at ${APP_URL}`
                : `No learnings found yet. Be the first to add one at ${APP_URL}`,
        } )
        return
    }

    const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: header } },
        { type: 'divider' },
        ...entries.map( formatEntryBlock ),
        { type: 'divider' },
        {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `<${APP_URL}|Browse all learnings on AI Learnings Hub>` }],
        },
    ]

    await slack.chat.postMessage( {
        channel: channelId,
        text: header,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
    } )
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

export default async function handler( req, res ) {
    if ( req.method !== 'POST' ) return res.status( 405 ).end()

    // Vercel pre-parses JSON bodies; reconstruct raw string for signature verification
    const body = req.body
    const rawBody = JSON.stringify( body )

    // Respond to Slack's one-time URL verification challenge immediately,
    // before signature check (safe — challenge contains no sensitive data)
    if ( body?.type === 'url_verification' ) {
        return res.status( 200 ).json( { challenge: body.challenge } )
    }

    if ( !verifySlackSignature( req, rawBody ) ) {
        return res.status( 401 ).json( { error: 'Invalid signature' } )
    }

    const event = body.event
    if ( !event || event.type !== 'message' || event.subtype || event.bot_id ) {
        return res.status( 200 ).end()
    }

    const isDM = event.channel_type === 'im'
    const channel = process.env.SLACK_CHANNEL_ID
    if ( !isDM && channel && event.channel !== channel ) {
        return res.status( 200 ).end()
    }

    const slack = new WebClient( process.env.SLACK_BOT_TOKEN )

    // DMs: try to answer as a query first — do work before responding (fast path,
    // avoids Vercel terminating the function after res.end())
    if ( isDM ) {
        const query = parseQuery( event.text )
        if ( query ) {
            await handleQuery( query, slack, event.channel ).catch( console.error )
            return res.status( 200 ).end()
        }

        // Not a query — check if it looks like a submission (has a URL)
        const parsed = parseMessage( event.text )
        if ( !parsed ) {
            await sendHelp( slack, event.channel ).catch( console.error )
            return res.status( 200 ).end()
        }
    }

    // Submission path — acknowledge immediately, then do slow work (title fetch etc.)
    res.status( 200 ).end()

    // Channel message or DM with a URL — treat as a submission
    const parsed = parseMessage( event.text )
    if ( !parsed || parsed.bullets.length === 0 ) return

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
