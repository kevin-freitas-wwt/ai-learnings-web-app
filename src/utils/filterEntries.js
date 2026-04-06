export function filterEntries( entries, { search, tags, submitter } ) {
    return entries.filter( ( entry ) => {
        if ( tags.length > 0 && !tags.every( ( t ) => entry.tags.includes( t ) ) ) return false
        if ( submitter && entry.submitter_name !== submitter ) return false

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
