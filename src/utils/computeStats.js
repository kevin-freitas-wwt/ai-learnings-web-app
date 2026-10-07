// NOTE ON SCOPE: this app's data model has no task/status concept — it only
// tracks "entries" (AI learnings) with a `category` field (see
// src/data/categories.js). By agreement with the requester, this stats page
// uses category as a stand-in for "status." `categories` here is expected to
// be an array of plain strings; each one is used directly as an object key
// and as the rendered label.
export function computeCategoryCounts( entries, categories = [] ) {
    const counts = {}
    categories.forEach( ( category ) => {
        counts[String( category )] = 0
    } )

    entries.forEach( ( entry ) => {
        const category = entry.category ? String( entry.category ) : 'Uncategorized'
        counts[category] = ( counts[category] || 0 ) + 1
    } )

    return counts
}

export function totalCount( entries ) {
    return entries.length
}
