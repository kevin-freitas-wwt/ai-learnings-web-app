// Shared bullet generation logic used by both generate-bullets.js and slack/events.js
import { YoutubeTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js'

export function isYouTubeUrl( url ) {
    return /youtube\.com|youtu\.be/i.test( url )
}

async function fetchYouTubeTranscript( url ) {
    try {
        const segments = await YoutubeTranscript.fetchTranscript( url )
        if ( !segments?.length ) return null
        return segments
            .map( ( s ) => s.text )
            .join( ' ' )
            .replace( /\s+/g, ' ' )
            .trim()
            .slice( 0, 12000 )
    } catch ( err ) {
        console.log( '[_bullets] transcript error:', err.message )
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

    let contentBlock = null
    let isVideo = false

    if ( isYouTubeUrl( url ) ) {
        isVideo = true
        const transcript = await fetchYouTubeTranscript( url )
        if ( transcript ) {
            contentBlock = `YouTube video transcript:\n${transcript}`
        }
    } else {
        const text = await fetchArticleText( url )
        if ( text ) {
            contentBlock = `URL: ${url}\n\nArticle text:\n${text}`
        }
    }

    // No content to summarize — bail early rather than sending Claude a bare URL
    if ( !contentBlock ) return null

    const prompt = isVideo
        ? `Extract 3 to 5 key learnings from this YouTube video transcript. Each learning should be a single concise sentence under 20 words capturing a distinct, practical insight. Return only a JSON array of strings with no other text.\n\n${contentBlock}`
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
        "couldn't", "not able to", "failed to", "no content", "cannot access",
        "can't access", "don't have the ability", "i don't have", "unfortunately",
    ]
    const combined = bullets.join( ' ' ).toLowerCase()
    const isFailure = FAILURE_PHRASES.some( ( p ) => combined.includes( p ) )

    return isFailure ? null : bullets
}
