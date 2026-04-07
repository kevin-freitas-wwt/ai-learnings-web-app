export function formatDate( dateStr ) {
    if ( !dateStr ) return null
    const d = new Date( dateStr )
    if ( isNaN( d.getTime() ) ) return null
    return d.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric', year: 'numeric' } )
}

export function relativeTime( dateStr ) {
    const now = new Date()
    const date = new Date( dateStr )
    const seconds = Math.floor( ( now - date ) / 1000 )

    if ( seconds < 60 ) return 'just now'

    const minutes = Math.floor( seconds / 60 )
    if ( minutes < 60 ) return `${minutes}m ago`

    const hours = Math.floor( minutes / 60 )
    if ( hours < 24 ) return `${hours}h ago`

    const days = Math.floor( hours / 24 )
    if ( days === 1 ) return 'yesterday'
    if ( days < 7 ) return `${days} days ago`

    const weeks = Math.floor( days / 7 )
    if ( weeks === 1 ) return 'last week'
    if ( weeks < 4 ) return `${weeks} weeks ago`

    const months = Math.floor( days / 30 )
    if ( months === 1 ) return 'last month'
    return `${months} months ago`
}
