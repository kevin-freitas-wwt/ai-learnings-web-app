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
        const stripped = line
            .replace( /<@[A-Z0-9]+>/g, '' )   // strip @mentions
            .replace( /^[\s\-\*•\d\.]+/, '' )
            .trim()
        if ( stripped && !stripped.match( /^<https?:\/\// ) && !stripped.match( /^https?:\/\// ) && !stripped.startsWith( '#' ) ) {
            bullets.push( stripped )
        }
    }

    return { url, tags, bullets }
}

const WORD_NUMS = { one: 1, two: 2, three: 3, four: 4, five: 5, a: 1, an: 1 }

function parseLimit( text ) {
    // Explicit digit: "3 articles", "show me 4"
    const digitMatch = text.match( /\b(\d+)\s+(?:articles?|posts?|learnings?|results?|picks?)\b/i )
    if ( digitMatch ) return Math.min( parseInt( digitMatch[1], 10 ), 10 )

    // Word number: "three articles", "a post"
    const wordMatch = text.match( /\b(one|two|three|four|five|a|an)\s+(?:articles?|posts?|learnings?|results?|picks?)\b/i )
    if ( wordMatch ) return WORD_NUMS[wordMatch[1].toLowerCase()] ?? 5

    // "a few"
    if ( /\ba few\b/i.test( text ) ) return 3

    // Singular noun with no number → 1
    if ( /\b(?:article|post|learning|result|pick)\b(?!s)/i.test( text ) ) return 1

    return 5
}

// Returns { type: 'recent' } or { type: 'search', term: string } or null
function parseQuery( text ) {
    if ( !text ) return null
    const t = text.trim()

    const limit = parseLimit( t )

    // Help: "help", "how does this work", "what can you do", etc.
    if ( /^(help|hi|hello|hey|howdy|sup|yo)[\s!?.,]*$/i.test( t ) ||
         /\b(help|how (does|do) (this|you|it) work|what can you do|what do you do|commands?|instructions?)\b/i.test( t ) ) {
        return { type: 'help' }
    }

    // Recent: "recent", "latest", "most recent", "show me the latest", etc.
    if ( /\b(recent|latest|newest|last few|most recent|new posts?|new articles?)\b/i.test( t ) ) {
        return { type: 'recent', limit }
    }

    // By person: "articles by Kevin", "what's Kevin reading", "Kevin's posts", etc.
    const byPersonPatterns = [
        /\bby\s+([A-Za-z]+)\b/i,
        /\bfrom\s+([A-Za-z]+)\b/i,
        /\b([A-Za-z]+)'s\s+(?:posts?|articles?|learnings?|picks?|reads?)/i,
        /\bwhat(?:'s|\s+is|\s+has)\s+([A-Za-z]+)\s+(?:reading|watching|listening|sharing|posted|shared|been reading)/i,
        /\bshow me\s+([A-Za-z]+)'s/i,
    ]
    for ( const re of byPersonPatterns ) {
        const match = t.match( re )
        if ( match ) {
            return { type: 'by-person', term: match[1], limit }
        }
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
            if ( term.length > 0 ) return { type: 'search', term, limit }
        }
    }

    // Bare search: single/multi-word message with no URL that doesn't match above
    // Only treat as search if it's short (≤ 6 words) and looks like a topic
    const words = t.split( /\s+/ )
    if ( words.length <= 6 && !t.match( /https?:\/\// ) ) {
        return { type: 'search', term: t, limit }
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
                    text: '*Search learnings*\n`articles about agents`\n`posts tagged llms`\n`show me prompting`\n`articles by Kevin`\n`what\'s Kevin reading?`',
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

    const limit = query.limit ?? 5

    if ( query.type === 'recent' ) {
        entries = await sql`
            SELECT id, url, title, summary, tags, created_at, published_at, submitter_name
            FROM entries
            ORDER BY COALESCE(published_at, created_at) DESC
            LIMIT ${limit}
        `
        header = limit === 1 ? '*Most recent learning:*' : '*Most recent learnings:*'
    } else if ( query.type === 'by-person' ) {
        const term = `%${query.term}%`
        entries = await sql`
            SELECT id, url, title, summary, tags, created_at, published_at, submitter_name
            FROM entries
            WHERE submitter_name ILIKE ${term}
            ORDER BY COALESCE(published_at, created_at) DESC
            LIMIT ${limit}
        `
        header = `*Learnings shared by ${query.term}:*`
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
            LIMIT ${limit}
        `
        header = `*Results for "${query.term}":*`
    }

    if ( entries.length === 0 ) {
        await slack.chat.postMessage( {
            channel: channelId,
            text: query.type === 'by-person'
                ? `No learnings found from "${query.term}". They may not have shared anything yet.`
                : query.type === 'search'
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
        const profile = res.user?.profile
        if ( !profile ) return null

        const first = profile.first_name?.trim()
        const last = profile.last_name?.trim()

        if ( first && last ) {
            return `${first} ${last[0]}.`
        }

        // Fall back to real_name (e.g. "Kevin Freitas" → "Kevin F.")
        const real = ( profile.real_name || res.user?.real_name || '' ).trim()
        if ( real ) {
            const parts = real.split( /\s+/ )
            return parts.length >= 2
                ? `${parts[0]} ${parts[parts.length - 1][0]}.`
                : parts[0]
        }

        return null
    } catch {
        return null
    }
}

function decodeHtmlEntities( str ) {
    return str
        .replace( /&amp;/g, '&' )
        .replace( /&lt;/g, '<' )
        .replace( /&gt;/g, '>' )
        .replace( /&quot;/g, '"' )
        .replace( /&#39;/g, "'" )
        .replace( /&apos;/g, "'" )
        .replace( /&#(\d+);/g, ( _, code ) => String.fromCharCode( Number( code ) ) )
        .replace( /&#x([0-9a-fA-F]+);/g, ( _, hex ) => String.fromCharCode( parseInt( hex, 16 ) ) )
}

async function fetchTitle( url ) {
    try {
        const res = await fetch( url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout( 5000 ) } )
        const html = await res.text()
        const match = html.match( /<title[^>]*>([^<]+)<\/title>/i )
        return match ? decodeHtmlEntities( match[1].trim().replace( /\s+/g, ' ' ) ) : url
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

async function readRawBody( req ) {
    return new Promise( ( resolve ) => {
        const chunks = []
        req.on( 'data', ( chunk ) => chunks.push( Buffer.isBuffer( chunk ) ? chunk : Buffer.from( chunk ) ) )
        req.on( 'end', () => resolve( Buffer.concat( chunks ).toString( 'utf8' ) ) )
        req.on( 'error', () => resolve( null ) )
    } )
}

export default async function handler( req, res ) {
    if ( req.method !== 'POST' ) return res.status( 405 ).end()

    // Try to read raw body from stream (Vercel may or may not have consumed it)
    const streamBody = await readRawBody( req )
    const rawBody = ( streamBody && streamBody.length > 0 ) ? streamBody : JSON.stringify( req.body )
    const body = streamBody && streamBody.length > 0 ? JSON.parse( streamBody ) : req.body

    console.log( '[slack/events] incoming body type:', body?.type, '| event type:', body?.event?.type, '| channel_type:', body?.event?.channel_type, '| rawBody source:', streamBody?.length > 0 ? 'stream' : 'json.stringify' )

    // Respond to Slack's one-time URL verification challenge immediately,
    // before signature check (safe — challenge contains no sensitive data)
    if ( body?.type === 'url_verification' ) {
        return res.status( 200 ).json( { challenge: body.challenge } )
    }

    console.log( '[slack/events] sig check — secret set:', !!process.env.SLACK_SIGNING_SECRET, '| rawBody source:', streamBody?.length > 0 ? 'stream' : 'json.stringify', '| rawBody length:', rawBody.length )

    if ( !verifySlackSignature( req, rawBody ) ) {
        console.log( '[slack/events] signature verification FAILED' )
        return res.status( 401 ).json( { error: 'Invalid signature' } )
    }

    const event = body.event
    if ( !event || event.subtype || event.bot_id ) {
        console.log( '[slack/events] skipping — no event, subtype, or bot_id:', { subtype: event?.subtype, bot_id: event?.bot_id } )
        return res.status( 200 ).end()
    }

    const slack = new WebClient( process.env.SLACK_BOT_TOKEN )

    // @mentions in a channel — strip the mention, then treat same as a DM
    if ( event.type === 'app_mention' ) {
        const text = ( event.text || '' ).replace( /<@[A-Z0-9]+>/g, '' ).trim()
        console.log( '[slack/events] app_mention — text:', text )
        await handleChannelMention( text, event, slack )
        return res.status( 200 ).end()
    }

    if ( event.type !== 'message' ) {
        console.log( '[slack/events] skipping non-message event type:', event.type )
        return res.status( 200 ).end()
    }

    const isDM = event.channel_type === 'im'
    const channel = process.env.SLACK_CHANNEL_ID
    console.log( '[slack/events] message — isDM:', isDM, '| channel:', event.channel, '| expected channel:', channel )

    if ( !isDM && channel && event.channel !== channel ) {
        console.log( '[slack/events] skipping — wrong channel' )
        return res.status( 200 ).end()
    }

    if ( isDM ) {
        const query = parseQuery( event.text )
        console.log( '[slack/events] DM parseQuery result:', query )
        if ( query ) {
            await handleQuery( query, slack, event.channel ).catch( console.error )
            return res.status( 200 ).end()
        }

        const parsed = parseMessage( event.text )
        console.log( '[slack/events] DM parseMessage result:', parsed ? { url: parsed.url, bullets: parsed.bullets.length, tags: parsed.tags } : null )
        if ( !parsed ) {
            await sendHelp( slack, event.channel ).catch( console.error )
            return res.status( 200 ).end()
        }
        if ( parsed.bullets.length === 0 ) {
            console.log( '[slack/events] DM has URL but no bullets — prompting user' )
            await slack.chat.postMessage( {
                channel: event.channel,
                text: 'Add a short description below the URL so I know what to save:\n```https://example.com/article  #tag1 #tag2\nKey takeaway from this article.```',
            } ).catch( console.error )
            return res.status( 200 ).end()
        }
        console.log( '[slack/events] DM submission — saving entry' )
        await saveEntry( parsed, event, slack )
        return res.status( 200 ).end()
    }

    // Channel: only process messages that contain an @mention
    const hasMention = /<@[A-Z0-9]+>/.test( event.text || '' )
    if ( !hasMention ) return res.status( 200 ).end()

    const mentionText = ( event.text || '' ).replace( /<@[A-Z0-9]+>/g, '' ).trim()
    await handleChannelMention( mentionText, event, slack )
    return res.status( 200 ).end()
}

async function handleChannelMention( text, event, slack ) {
    const query = parseQuery( text )
    if ( query ) {
        await handleQuery( query, slack, event.channel ).catch( console.error )
        return
    }

    const parsed = parseMessage( text )
    console.log( '[slack/events] channel parseMessage result:', parsed ? { url: parsed.url, bullets: parsed.bullets.length } : null )
    if ( !parsed ) {
        await sendHelp( slack, event.channel ).catch( console.error )
        return
    }
    if ( parsed.bullets.length === 0 ) {
        await slack.chat.postMessage( {
            channel: event.channel,
            thread_ts: event.ts,
            text: 'Add a short description below the URL so I know what to save:\n```@bot https://example.com  #tag1 #tag2\nKey takeaway from this article.```',
        } ).catch( console.error )
        return
    }
    await saveEntry( parsed, event, slack ).catch( console.error )
}

async function saveEntry( parsed, event, slack ) {
    const sql = getDb()

    // Deduplicate: skip if this URL was already saved in the last 60 seconds
    const recent = await sql`
        SELECT id FROM entries
        WHERE url = ${parsed.url}
        AND created_at > NOW() - INTERVAL '60 seconds'
        LIMIT 1
    `
    if ( recent.length > 0 ) {
        console.log( '[slack/events] duplicate submission skipped:', parsed.url )
        return
    }

    const bullets = parsed.bullets
    const submitterName = await getDisplayName( slack, event.user )
    const title = await fetchTitle( parsed.url )
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const readingTime = estimateReadingTime( bullets )

    try {
        await sql`
            INSERT INTO entries
                (id, url, title, summary, tags, click_count, heart_count, created_at, submitter_name, reading_time)
            VALUES
                (${id}, ${parsed.url}, ${title}, ${JSON.stringify( bullets )}::jsonb,
                 ${JSON.stringify( parsed.tags )}::jsonb, 0, 0, ${now},
                 ${submitterName ?? null}, ${readingTime})
        `

        const tagsText = parsed.tags.length > 0 ? parsed.tags.map( ( t ) => `#${t}` ).join( ' ' ) : 'no tags'
        await slack.chat.postMessage( {
            channel: event.channel,
            thread_ts: event.ts,
            text: `✅ Added to AI Learnings Hub!\n*${title}*\n${bullets.length} learning${bullets.length !== 1 ? 's' : ''} · ${tagsText}`,
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
