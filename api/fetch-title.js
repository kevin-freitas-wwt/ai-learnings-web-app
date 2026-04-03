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
            return res.status( 200 ).json( { title: null } )
        }

        const html = await response.text()
        const match = html.match( /<title[^>]*>([^<]+)<\/title>/i )
        const title = match ? match[1].trim().replace( /\s+/g, ' ' ) : null

        return res.status( 200 ).json( { title } )
    } catch {
        return res.status( 200 ).json( { title: null } )
    }
}
