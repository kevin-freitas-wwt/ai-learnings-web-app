import { neon } from '@neondatabase/serverless'

export default async function handler( req, res ) {
    if ( req.method !== 'POST' ) {
        return res.status( 405 ).json( { error: 'Method not allowed' } )
    }
    if ( !process.env.POSTGRES_URL ) {
        return res.status( 503 ).json( { error: 'Database not configured' } )
    }

    const { id } = req.query
    const { action, delta } = req.body
    const sql = neon( process.env.POSTGRES_URL )

    if ( action === 'click' ) {
        await sql`UPDATE entries SET click_count = click_count + 1 WHERE id = ${id}`
        return res.status( 200 ).json( { ok: true } )
    }

    if ( action === 'heart' ) {
        if ( delta !== 1 && delta !== -1 ) {
            return res.status( 400 ).json( { error: 'delta must be 1 or -1' } )
        }
        await sql`UPDATE entries SET heart_count = heart_count + ${delta} WHERE id = ${id}`
        return res.status( 200 ).json( { ok: true } )
    }

    return res.status( 400 ).json( { error: 'action must be click or heart' } )
}
