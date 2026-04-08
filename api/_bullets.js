// Shared bullet generation logic used by both generate-bullets.js and slack/events.js

export function isYouTubeUrl( url ) {
    return /youtube\.com|youtu\.be/i.test( url )
}

export function extractYouTubeId( url ) {
    const patterns = [
        /[?&]v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /\/shorts\/([a-zA-Z0-9_-]{11})/,
        /\/embed\/([a-zA-Z0-9_-]{11})/,
    ]
    for ( const re of patterns ) {
        const m = url.match( re )
        if ( m ) return m[1]
    }
    return null
}

async function fetchYouTubeTranscript( videoId ) {
    try {
        const pageRes = await fetch( `https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AI-Learnings-Hub/1.0)',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout( 8000 ),
        } )
        if ( !pageRes.ok ) return null
        const html = await pageRes.text()

        const captionMatch = html.match( /"captionTracks":\[{"baseUrl":"(https:[^"]+)"/ )
        if ( !captionMatch ) return null

        const captionUrl = JSON.parse( `"${captionMatch[1]}"` )
        const captionRes = await fetch( captionUrl, { signal: AbortSignal.timeout( 5000 ) } )
        if ( !captionRes.ok ) return null

        const xml = await captionRes.text()
        const text = [...xml.matchAll( /<text[^>]*>([\s\S]*?)<\/text>/g )]
            .map( ( m ) => m[1]
                .replace( /&amp;/g, '&' )
                .replace( /&lt;/g, '<' )
                .replace( /&gt;/g, '>' )
                .replace( /&#39;/g, "'" )
                .replace( /&quot;/g, '"' )
            )
            .join( ' ' )
            .replace( /\s+/g, ' ' )
            .trim()

        return text.slice( 0, 12000 ) || null
    } catch {
        return null
    }
}

async function fetchArticleText( url ) {
    try {
        const res = await fetch( url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Learnings-Hub/1.0)' },
            signal: AbortSignal.timeout( 8000 ),
        } )
        if ( !res.ok ) return null
        const html = await res.text()
        return html
            .replace( /<script[^>]*>[\s\S]*?<\/script>/gi, '' )
            .replace( /<style[^>]*>[\s\S]*?<\/style>/gi, '' )
            .replace( /<[^>]+>/g, ' ' )
            .replace( /\s+/g, ' ' )
            .trim()
            .slice( 0, 12000 )
    } catch {
        return null
    }
}

export async function generateBullets( url ) {
    if ( !process.env.AI_GATEWAY_API_KEY ) return null

    let contentBlock = `URL: ${url}`
    let isVideo = false

    const ytId = extractYouTubeId( url )
    if ( ytId ) {
        isVideo = true
        const transcript = await fetchYouTubeTranscript( ytId )
        if ( transcript ) {
            contentBlock = `YouTube video transcript:\n${transcript}`
        }
    } else {
        const text = await fetchArticleText( url )
        if ( text ) {
            contentBlock = `URL: ${url}\n\nArticle text:\n${text}`
        }
    }

    const prompt = isVideo
        ? `Extract 3 to 5 key learnings from this YouTube video. Each learning should be a single concise sentence under 20 words capturing a distinct, practical insight. Return only a JSON array of strings with no other text.\n\n${contentBlock}`
        : `Extract 3 to 5 key learnings from this article. Each learning should be a single concise sentence under 20 words capturing a distinct, practical insight. Return only a JSON array of strings with no other text.\n\n${contentBlock}`

    const response = await fetch( 'https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify( {
            model: 'anthropic/claude-haiku-4.5',
            max_tokens: 512,
            messages: [{ role: 'user', content: prompt }],
        } ),
    } )

    if ( !response.ok ) return null

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''

    let bullets
    const jsonMatch = raw.match( /\[[\s\S]*\]/ )
    if ( jsonMatch ) {
        try {
            const parsed = JSON.parse( jsonMatch[0] )
            if ( Array.isArray( parsed ) ) bullets = parsed
        } catch {
            // fall through
        }
    }

    if ( !bullets ) {
        bullets = raw
            .split( '\n' )
            .map( ( l ) => l
                .replace( /^[\s\-•*\d.)]+/, '' )
                .replace( /^["']|["'],?$/g, '' )
                .trim()
            )
            .filter( Boolean )
    }

    bullets = bullets
        .map( ( b ) => b.replace( /^["']|["']$/g, '' ).trim() )
        .filter( Boolean )
        .slice( 0, 5 )

    if ( !bullets.length ) return null

    const FAILURE_PHRASES = [
        "i'm sorry", "i cannot", "i can't", "unable to", "could not",
        "couldn't", "not able to", "failed to", "no content", "error",
    ]
    const isFailure = bullets.length === 1 &&
        FAILURE_PHRASES.some( ( p ) => bullets[0].toLowerCase().includes( p ) )

    return isFailure ? null : bullets
}
