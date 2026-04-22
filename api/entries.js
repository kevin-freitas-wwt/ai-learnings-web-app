import { neon } from '@neondatabase/serverless'

function getDb() {
    if ( !process.env.POSTGRES_URL ) return null
    return neon( process.env.POSTGRES_URL )
}

export default async function handler( req, res ) {
    const sql = getDb()

    if ( req.method === 'GET' ) {
        if ( !sql ) {
            return res.status( 503 ).json( { error: 'Database not configured' } )
        }
        const rows = await sql`SELECT * FROM entries ORDER BY created_at DESC`
        return res.status( 200 ).json( rows )
    }

    if ( req.method === 'POST' ) {
        if ( !sql ) {
            return res.status( 503 ).json( { error: 'Database not configured' } )
        }
        const { id, url, title, summary, tags, created_at, submitter_name, reading_time, published_at, og_image } = req.body
        await sql`
            INSERT INTO entries
                (id, url, title, summary, tags, click_count, heart_count, created_at, submitter_name, reading_time, published_at, og_image)
            VALUES
                (${id}, ${url}, ${title}, ${JSON.stringify( summary )}::jsonb, ${JSON.stringify( tags )}::jsonb,
                 0, 0, ${created_at}, ${submitter_name ?? null}, ${reading_time ?? null}, ${published_at ?? null}, ${og_image ?? null})
        `
        return res.status( 201 ).json( { ok: true } )
    }

    return res.status( 405 ).json( { error: 'Method not allowed' } )
}
