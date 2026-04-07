import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

// Load .env.local manually
const env = readFileSync( '.env.local', 'utf8' )
for ( const line of env.split( '\n' ) ) {
    const [key, ...rest] = line.split( '=' )
    if ( key && rest.length ) {
        const val = rest.join( '=' ).trim().replace( /^["']|["']$/g, '' )
        process.env[key.trim()] = val
    }
}

const sql = neon( process.env.POSTGRES_URL )

function extractPublishedAt( html ) {
    const metaPatterns = [
        /property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
        /content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
        /name=["'](?:date|pubdate|publish[-_]?date|publication[-_]?date)["'][^>]*content=["']([^"']+)["']/i,
        /content=["']([^"']+)["'][^>]*name=["'](?:date|pubdate|publish[-_]?date|publication[-_]?date)["']/i,
        /itemprop=["']datePublished["'][^>]*content=["']([^"']+)["']/i,
        /content=["']([^"']+)["'][^>]*itemprop=["']datePublished["']/i,
        /property=["']og:(?:published_time|pubdate)["'][^>]*content=["']([^"']+)["']/i,
        /content=["']([^"']+)["'][^>]*property=["']og:(?:published_time|pubdate)["']/i,
    ]

    for ( const pattern of metaPatterns ) {
        const match = html.match( pattern )
        if ( match ) {
            const d = new Date( match[1] )
            if ( !isNaN( d.getTime() ) ) return d.toISOString()
        }
    }

    const jsonLdMatch = html.match( /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i )
    if ( jsonLdMatch ) {
        try {
            const data = JSON.parse( jsonLdMatch[1] )
            const raw = data.datePublished || data.dateCreated
            if ( raw ) {
                const d = new Date( raw )
                if ( !isNaN( d.getTime() ) ) return d.toISOString()
            }
        } catch { /* skip */ }
    }

    const timeMatch = html.match( /<time[^>]+datetime=["']([^"']+)["']/i )
    if ( timeMatch ) {
        const d = new Date( timeMatch[1] )
        if ( !isNaN( d.getTime() ) ) return d.toISOString()
    }

    return null
}

async function fetchPublishedAt( url ) {
    try {
        const res = await fetch( url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Learnings-Hub/1.0)' },
            signal: AbortSignal.timeout( 8000 ),
        } )
        if ( !res.ok ) return null
        const html = await res.text()
        return extractPublishedAt( html )
    } catch {
        return null
    }
}

const entries = await sql`SELECT id, url FROM entries WHERE published_at IS NULL`
console.log( `Found ${entries.length} entries to backfill\n` )

for ( const entry of entries ) {
    process.stdout.write( `  ${entry.url.slice( 0, 60 )}… ` )
    const published_at = await fetchPublishedAt( entry.url )
    if ( published_at ) {
        await sql`UPDATE entries SET published_at = ${published_at} WHERE id = ${entry.id}`
        console.log( `✓ ${new Date( published_at ).toLocaleDateString( 'en-US', { month: 'short', day: 'numeric', year: 'numeric' } )}` )
    } else {
        console.log( '— not found' )
    }
}

console.log( '\nDone.' )
