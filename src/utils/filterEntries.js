export function filterEntries( entries, { search, category } ) {
    return entries.filter( ( entry ) => {
        if ( category && entry.category !== category ) return false

        if ( search ) {
            const q = search.toLowerCase()
            const inTitle = entry.title.toLowerCase().includes( q )
            const inSummary = entry.summary.some( ( b ) => b.toLowerCase().includes( q ) )
            const inTags = entry.tags.some( ( t ) => t.toLowerCase().includes( q ) )
            if ( !inTitle && !inSummary && !inTags ) return false
        }

        return true
    } )
}
