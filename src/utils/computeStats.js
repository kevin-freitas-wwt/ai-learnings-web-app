// Computes counts of entries grouped by their category (used as the status
// grouping for the stats page, since entries don't have a separate status
// field in this app's data model).
export function computeCategoryCounts( entries, categories = [] ) {
    const counts = {}
    categories.forEach( ( category ) => {
        counts[category] = 0
    } )

    entries.forEach( ( entry ) => {
        const category = entry.category || 'Uncategorized'
        counts[category] = ( counts[category] || 0 ) + 1
    } )

    return counts
}

export function totalCount( entries ) {
    return entries.length
}
