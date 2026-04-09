import { generatePodcastAudio } from '../_podcast.js'

export default async function handler( req, res ) {
    if ( req.method !== 'POST' ) return res.status( 405 ).end()

    const { script } = req.body
    if ( !Array.isArray( script ) || script.length === 0 ) {
        return res.status( 400 ).json( { error: 'Invalid script' } )
    }

    const audioBuffer = await generatePodcastAudio( script )
    if ( !audioBuffer ) {
        return res.status( 500 ).json( { error: 'Audio generation failed — check ELEVENLABS_API_KEY' } )
    }

    res.setHeader( 'Content-Type', 'audio/mpeg' )
    res.setHeader( 'Content-Length', audioBuffer.length )
    res.end( audioBuffer )
}
