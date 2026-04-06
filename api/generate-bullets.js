export default async function handler( req, res ) {
    if ( req.method !== 'POST' ) {
        return res.status( 405 ).json( { error: 'Method not allowed' } )
    }

    const { url } = req.body
    if ( !url ) {
        return res.status( 400 ).json( { error: 'Missing url' } )
    }

    if ( !process.env.AI_GATEWAY_API_KEY ) {
        return res.status( 503 ).json( { error: 'AI not configured' } )
    }

    let articleText = ''
    try {
        const response = await fetch( url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Learnings-Hub/1.0)' },
            signal: AbortSignal.timeout( 8000 ),
        } )
        if ( response.ok ) {
            const html = await response.text()
            articleText = html
                .replace( /<script[^>]*>[\s\S]*?<\/script>/gi, '' )
                .replace( /<style[^>]*>[\s\S]*?<\/style>/gi, '' )
                .replace( /<[^>]+>/g, ' ' )
                .replace( /\s+/g, ' ' )
                .trim()
                .slice( 0, 12000 )
        }
    } catch {
        // proceed with URL only if fetch fails
    }

    const content = articleText
        ? `URL: ${url}\n\nArticle text:\n${articleText}`
        : `URL: ${url}`

    const response = await fetch( 'https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify( {
            model: 'anthropic/claude-haiku-4.5',
            max_tokens: 512,
            messages: [
                {
                    role: 'user',
                    content: `Extract 3 to 5 key learnings from this article. Each learning should be a single concise sentence under 20 words capturing a distinct, practical insight. Return only a JSON array of strings with no other text.\n\n${content}`,
                },
            ],
        } ),
    } )

    if ( !response.ok ) {
        const errBody = await response.text().catch( () => '' )
        console.error( 'AI Gateway error:', response.status, errBody )
        return res.status( 502 ).json( { error: 'AI request failed', detail: errBody } )
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ''

    let bullets

    // Try to extract a JSON array from anywhere in the response
    const jsonMatch = raw.match( /\[[\s\S]*\]/ )
    if ( jsonMatch ) {
        try {
            const parsed = JSON.parse( jsonMatch[0] )
            if ( Array.isArray( parsed ) ) bullets = parsed
        } catch {
            // fall through
        }
    }

    // Fallback: split by newlines and strip any list/JSON formatting
    if ( !bullets ) {
        bullets = raw
            .split( '\n' )
            .map( ( l ) => l
                .replace( /^[\s\-•*\d.)]+/, '' )  // leading list markers
                .replace( /^["']|["'],?$/g, '' )   // surrounding quotes/commas
                .trim()
            )
            .filter( Boolean )
    }

    // Final clean pass — strip any remaining stray quotes or JSON punctuation
    bullets = bullets
        .map( ( b ) => b.replace( /^["']|["']$/g, '' ).trim() )
        .filter( Boolean )
        .slice( 0, 5 )

    // If the model returned a refusal/failure instead of bullets, surface it
    const FAILURE_PHRASES = [
        "i'm sorry", "i cannot", "i can't", "unable to", "could not", "couldn't",
        "not able to", "failed to", "no content", "cannot access", "can't access",
        "error", "unfortunately", "i don't have",
    ]
    const isFailure = bullets.length === 0 ||
        ( bullets.length === 1 && FAILURE_PHRASES.some( ( p ) => bullets[0].toLowerCase().includes( p ) ) )

    if ( isFailure ) {
        return res.status( 422 ).json( { error: "Couldn't extract learnings from that URL. The page may be paywalled or bot-protected — please fill them in manually." } )
    }

    return res.status( 200 ).json( { bullets } )
}
