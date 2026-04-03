export function exportHearts( entries ) {
    const heartIds = JSON.parse( localStorage.getItem( 'aih_hearts' ) || '[]' )
    const hearted = entries.filter( ( e ) => heartIds.includes( e.id ) )

    if ( hearted.length === 0 ) return false

    const lines = hearted.map( ( e ) => {
        const bullets = e.summary.map( ( b ) => `  - ${b}` ).join( '\n' )
        const tags = e.tags.map( ( t ) => `#${t}` ).join( ' ' )
        const meta = [e.category, tags].filter( Boolean ).join( ' · ' )
        return `## ${e.title}\n> ${e.url}\n\n_${meta}_\n\n${bullets}`
    } )

    const md = `# My AI Learnings ♥\n\n_Exported ${new Date().toLocaleDateString()}_\n\n---\n\n${lines.join( '\n\n---\n\n' )}\n`
    const blob = new Blob( [md], { type: 'text/markdown' } )
    const blobUrl = URL.createObjectURL( blob )
    const a = document.createElement( 'a' )
    a.href = blobUrl
    a.download = 'ai-learnings.md'
    a.click()
    URL.revokeObjectURL( blobUrl )

    return true
}
