import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.argv[2]
if ( !DATABASE_URL ) {
    console.error( 'Usage: node db/drop-category.mjs <connection-string>' )
    process.exit( 1 )
}

const sql = neon( DATABASE_URL )

await sql`
    UPDATE entries
    SET tags = CASE
        WHEN tags @> to_jsonb(LOWER(category)::text) THEN tags
        ELSE tags || to_jsonb(LOWER(category)::text)
    END
    WHERE category IS NOT NULL AND category != ''
`
console.log( 'Merged category into tags.' )

await sql`ALTER TABLE entries DROP COLUMN category`
console.log( 'Dropped category column.' )
