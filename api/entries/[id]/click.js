import { neon } from '@neondatabase/serverless'

export default async function handler( req, res ) {
    if ( req.method !== 'POST' ) {
        return res.status( 405 ).json( { error: 'Method not allowed' } )
    }
    if ( !process.env.POSTGRES_URL ) {
        return res.status( 503 ).json( { error: 'Database not configured' } )
    }

    const { id } = req.query
    const sql = neon( process.env.POSTGRES_URL )
    await sql`UPDATE entries SET click_count = click_count + 1 WHERE id = ${id}`
    return res.status( 200 ).json( { ok: true } )
}
