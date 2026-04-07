export function sortEntries( entries, sort ) {
    const sorted = [...entries]

    switch ( sort ) {
        case 'most-clicked':
            return sorted.sort( ( a, b ) => b.click_count - a.click_count )
        case 'most-faved':
            return sorted.sort( ( a, b ) => b.heart_count - a.heart_count )
        case 'newest':
            return sorted.sort( ( a, b ) => new Date( b.created_at ) - new Date( a.created_at ) )
        case 'freshest':
        default: {
            return sorted.sort( ( a, b ) => {
                const da = new Date( a.published_at || a.created_at )
                const db = new Date( b.published_at || b.created_at )
                return db - da
            } )
        }
    }
}
