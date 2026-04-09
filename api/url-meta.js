import { generateBullets, isYouTubeUrl } from './_bullets.js'

function cleanTitle( str ) {
    if ( !str ) return str
    return str
        .replace( /\s*[-|–—·:»›]\s*[^-|–—·:»›]+$/, '' )
        .replace( /^[^-|–—·:»›]+\s*[-|–—·:»›]\s*/, ( match, offset ) => offset === 0 && str.lastIndexOf( match ) > 0 ? '' : match )
        .trim()
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

function extractPublishedAt( html ) {
    const metaPatterns = [
        /property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
        /content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
        /name=["'](?:date|pubdate|publish[-_]?date|publication[-_]?date)["'][^>]*content=["']([^"']+)["']/i,
        /content=["']([^"']+)["'][^>]*name=["'](?:date|pubdate|publish[-_]?date|publication[-_]?date)["']/i,
        /itemprop=["']datePublished["'][^>]*content=["']([^"']+)["']/i,
        /content=["']([^"']+)["'][^>]*itemprop=["']datePublished["']/i,
        /property=["']og:(?:published_time|pubdate)["'][^>]*content=["']([^"']+)["']/i,
        /content=["']([^"']+)["'][^>]*property=["']og:(?:published_time|pubdate)["']/i,
    ]

    for ( const pattern of metaPatterns ) {
        const match = html.match( pattern )
        if ( match ) {
            const d = new Date( match[1] )
            if ( !isNaN( d.getTime() ) ) return d.toISOString()
        }
    }

    const jsonLdMatch = html.match( /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i )
    if ( jsonLdMatch ) {
        try {
            const data = JSON.parse( jsonLdMatch[1] )
            const raw = data.datePublished || data.dateCreated
            if ( raw ) {
                const d = new Date( raw )
                if ( !isNaN( d.getTime() ) ) return d.toISOString()
            }
        } catch {
            // malformed JSON-LD, skip
        }
    }

    const timeMatch = html.match( /<time[^>]+datetime=["']([^"']+)["']/i )
    if ( timeMatch ) {
        const d = new Date( timeMatch[1] )
        if ( !isNaN( d.getTime() ) ) return d.toISOString()
    }

    return null
}

export default async function handler( req, res ) {
    // GET ?url=... → fetch title + published date
    if ( req.method === 'GET' ) {
        const { url } = req.query
        if ( !url ) return res.status( 400 ).json( { error: 'Missing url parameter' } )

        try {
            const response = await fetch( url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Learnings-Hub/1.0)' },
                signal: AbortSignal.timeout( 5000 ),
            } )
            if ( !response.ok ) return res.status( 200 ).json( { title: null, published_at: null } )

            const html = await response.text()
            const titleMatch = html.match( /<title[^>]*>([^<]+)<\/title>/i )
            const title = titleMatch ? cleanTitle( decodeHtmlEntities( titleMatch[1].trim().replace( /\s+/g, ' ' ) ) ) : null
            const published_at = extractPublishedAt( html )

            return res.status( 200 ).json( { title, published_at } )
        } catch {
            return res.status( 200 ).json( { title: null, published_at: null } )
        }
    }

    // POST { url } → generate AI bullets
    if ( req.method === 'POST' ) {
        const { url } = req.body
        if ( !url ) return res.status( 400 ).json( { error: 'Missing url' } )

        if ( !process.env.AI_GATEWAY_API_KEY ) {
            return res.status( 503 ).json( { error: 'AI not configured' } )
        }

        const bullets = await generateBullets( url )

        if ( !bullets ) {
            const error = isYouTubeUrl( url )
                ? "Couldn't extract a transcript from that video. It may not have captions — please fill in the learnings manually."
                : "Couldn't extract learnings from that URL. The page may be paywalled or bot-protected — please fill them in manually."
            return res.status( 422 ).json( { error } )
        }

        return res.status( 200 ).json( { bullets } )
    }

    res.status( 405 ).end()
}
