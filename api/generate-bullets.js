import { generateBullets, isYouTubeUrl } from './_bullets.js'

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

    const bullets = await generateBullets( url )

    if ( !bullets ) {
        const error = isYouTubeUrl( url )
            ? "Couldn't extract a transcript from that video. It may not have captions — please fill in the learnings manually."
            : "Couldn't extract learnings from that URL. The page may be paywalled or bot-protected — please fill them in manually."
        return res.status( 422 ).json( { error } )
    }

    return res.status( 200 ).json( { bullets } )
}
