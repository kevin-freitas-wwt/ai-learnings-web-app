import { neon } from '@neondatabase/serverless'

const sql = neon( process.env.POSTGRES_URL )

const OG_PATTERNS = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i,
]

async function fetchOgImage( url ) {
    try {
        const res = await fetch( url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Learnings-Hub/1.0)' },
            signal: AbortSignal.timeout( 6000 ),
        } )
        if ( !res.ok ) return null
        const html = await res.text()
        for ( const pattern of OG_PATTERNS ) {
            const m = html.match( pattern )
            if ( m?.[1]?.startsWith( 'http' ) ) return m[1]
        }
    } catch {
        // timeout or network error — skip
    }
    return null
}

const rows = await sql`SELECT id, url, title FROM entries WHERE og_image IS NULL ORDER BY created_at DESC`
console.log( `Found ${rows.length} entries to backfill\n` )

let updated = 0
let skipped = 0

for ( const row of rows ) {
    const image = await fetchOgImage( row.url )
    if ( image ) {
        await sql`UPDATE entries SET og_image = ${image} WHERE id = ${row.id}`
        console.log( `✓  ${row.title.slice( 0, 60 )}` )
        updated++
    } else {
        console.log( `–  ${row.title.slice( 0, 60 )} (no image)` )
        skipped++
    }
    // small delay to avoid hammering sites
    await new Promise( ( r ) => setTimeout( r, 300 ) )
}

console.log( `\nDone. ${updated} updated, ${skipped} skipped.` )
