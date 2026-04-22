import { neon } from '@neondatabase/serverless'
import { put } from '@vercel/blob'

const sql = neon( process.env.POSTGRES_URL )

const OG_PATTERNS = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i,
]

async function fetchOgImageUrl( pageUrl ) {
    try {
        const res = await fetch( pageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Learnings-Hub/1.0)' },
            signal: AbortSignal.timeout( 6000 ),
        } )
        if ( !res.ok ) return null
        const html = await res.text()
        for ( const pattern of OG_PATTERNS ) {
            const m = html.match( pattern )
            if ( m?.[1]?.startsWith( 'http' ) ) return m[1]
        }
    } catch { /* skip */ }
    return null
}

async function uploadToBlob( imageUrl ) {
    try {
        const res = await fetch( imageUrl, { signal: AbortSignal.timeout( 6000 ) } )
        if ( !res.ok ) return null
        const contentType = res.headers.get( 'content-type' ) || 'image/jpeg'
        if ( !contentType.startsWith( 'image/' ) ) return null
        const buffer = await res.arrayBuffer()
        const ext = contentType.split( '/' )[1]?.split( ';' )[0] || 'jpg'
        const filename = `og-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const blob = await put( filename, buffer, { access: 'public', contentType } )
        return blob.url
    } catch { /* skip */ }
    return null
}

// Migrate existing external URLs + fill in missing ones
const rows = await sql`
    SELECT id, url, title, og_image FROM entries
    WHERE og_image IS NULL
       OR og_image NOT LIKE '%vercel-storage.com%'
    ORDER BY created_at DESC
`
console.log( `Found ${rows.length} entries to process\n` )

let updated = 0
let skipped = 0

for ( const row of rows ) {
    let externalUrl = row.og_image  // already has an external URL

    if ( !externalUrl ) {
        externalUrl = await fetchOgImageUrl( row.url )
    }

    if ( externalUrl ) {
        const blobUrl = await uploadToBlob( externalUrl )
        if ( blobUrl ) {
            await sql`UPDATE entries SET og_image = ${blobUrl} WHERE id = ${row.id}`
            console.log( `✓  ${row.title.slice( 0, 60 )}` )
            updated++
        } else {
            console.log( `–  ${row.title.slice( 0, 60 )} (upload failed)` )
            skipped++
        }
    } else {
        console.log( `–  ${row.title.slice( 0, 60 )} (no image found)` )
        skipped++
    }

    await new Promise( ( r ) => setTimeout( r, 300 ) )
}

console.log( `\nDone. ${updated} uploaded to Blob, ${skipped} skipped.` )
