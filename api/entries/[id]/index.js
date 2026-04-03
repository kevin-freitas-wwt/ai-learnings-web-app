import { neon } from '@neondatabase/serverless'

export default async function handler( req, res ) {
    if ( req.method !== 'DELETE' ) {
        return res.status( 405 ).json( { error: 'Method not allowed' } )
    }
    if ( !process.env.POSTGRES_URL ) {
        return res.status( 503 ).json( { error: 'Database not configured' } )
    }

    const { id } = req.query
    const { submitter_name } = req.body

    if ( !submitter_name ) {
        return res.status( 400 ).json( { error: 'submitter_name required' } )
    }

    const sql = neon( process.env.POSTGRES_URL )
    const rows = await sql`SELECT submitter_name FROM entries WHERE id = ${id}`

    if ( !rows.length ) {
        return res.status( 404 ).json( { error: 'Entry not found' } )
    }
    if ( rows[0].submitter_name !== submitter_name ) {
        return res.status( 403 ).json( { error: 'Not authorized' } )
    }

    await sql`DELETE FROM entries WHERE id = ${id}`
    return res.status( 200 ).json( { ok: true } )
}
