import { neon } from '@neondatabase/serverless'
import { generatePodcastScript, generatePodcastAudio, fetchMusicUrl } from './_podcast.js'

export default async function handler( req, res ) {
    if ( req.method === 'GET' && req.query.preview === 'music' ) {
        try {
            const url = await fetchMusicUrl()
            const source = url?.startsWith( 'http' ) ? 'ccmixter' : 'bundled'
            return res.status( 200 ).json( { url: source === 'ccmixter' ? url : null, source } )
        } catch {
            return res.status( 200 ).json( { url: null, source: 'error' } )
        }
    }

    if ( req.method === 'GET' ) {
        const sql = neon( process.env.POSTGRES_URL )

        const weekAgo = new Date()
        weekAgo.setUTCDate( weekAgo.getUTCDate() - 7 )
        weekAgo.setUTCHours( 0, 0, 0, 0 )

        const rows = await sql`
            SELECT id, title, url, summary, submitter_name, heart_count, click_count
            FROM entries
            WHERE created_at >= ${weekAgo.toISOString()}
            ORDER BY (heart_count + click_count) DESC, created_at DESC
        `

        const weekStart = weekAgo.toLocaleDateString( 'en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' } )
        const weekEnd = new Date().toLocaleDateString( 'en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' } )

        if ( rows.length === 0 ) {
            return res.status( 200 ).json( { script: [], weekStart, weekEnd, count: 0 } )
        }

        const top5 = [...rows]
            .sort( ( a, b ) => ( b.heart_count + b.click_count ) - ( a.heart_count + a.click_count ) )
            .slice( 0, 5 )

        const script = await generatePodcastScript( top5, weekStart, weekEnd )

        return res.status( 200 ).json( {
            script: script || [],
            weekStart,
            weekEnd,
            count: top5.length,
        } )
    }

    if ( req.method === 'POST' ) {
        const { script } = req.body
        if ( !Array.isArray( script ) || script.length === 0 ) {
            return res.status( 400 ).json( { error: 'Invalid script' } )
        }

        let result
        try {
            result = await generatePodcastAudio( script )
        } catch ( err ) {
            return res.status( 500 ).json( { error: err.message } )
        }
        if ( !result?.audio ) {
            return res.status( 500 ).json( { error: 'Audio generation failed — check ELEVENLABS_API_KEY' } )
        }

        const { audio, usage } = result
        res.setHeader( 'Content-Type', 'audio/mpeg' )
        res.setHeader( 'Content-Length', audio.length )
        if ( usage ) {
            res.setHeader( 'X-ElevenLabs-Characters-Used', usage.used )
            res.setHeader( 'X-ElevenLabs-Characters-Limit', usage.limit )
            if ( usage.resetAt ) res.setHeader( 'X-ElevenLabs-Reset-Unix', usage.resetAt )
        }
        return res.end( audio )
    }

    res.status( 405 ).end()
}
