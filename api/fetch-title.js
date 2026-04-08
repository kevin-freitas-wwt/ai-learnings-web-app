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
    // Priority order: structured meta tags → JSON-LD → <time> element
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

    // JSON-LD
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

    // <time datetime="...">
    const timeMatch = html.match( /<time[^>]+datetime=["']([^"']+)["']/i )
    if ( timeMatch ) {
        const d = new Date( timeMatch[1] )
        if ( !isNaN( d.getTime() ) ) return d.toISOString()
    }

    return null
}

export default async function handler( req, res ) {
    const { url } = req.query

    if ( !url ) {
        return res.status( 400 ).json( { error: 'Missing url parameter' } )
    }

    try {
        const response = await fetch( url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AI-Learnings-Hub/1.0)',
            },
            signal: AbortSignal.timeout( 5000 ),
        } )

        if ( !response.ok ) {
            return res.status( 200 ).json( { title: null, published_at: null } )
        }

        const html = await response.text()
        const titleMatch = html.match( /<title[^>]*>([^<]+)<\/title>/i )
        const title = titleMatch ? decodeHtmlEntities( titleMatch[1].trim().replace( /\s+/g, ' ' ) ) : null
        const published_at = extractPublishedAt( html )

        return res.status( 200 ).json( { title, published_at } )
    } catch {
        return res.status( 200 ).json( { title: null, published_at: null } )
    }
}
