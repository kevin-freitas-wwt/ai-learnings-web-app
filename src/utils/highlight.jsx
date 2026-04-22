// Wraps matched substrings in <mark> for search term highlighting.
// Returns a string when no term is active, or a React fragment when highlighting.
export function highlight( text, term ) {
    if ( !term || !text ) return text
    const escaped = term.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' )
    const parts = text.split( new RegExp( `(${escaped})`, 'gi' ) )
    if ( parts.length === 1 ) return text
    return parts.map( ( part, i ) =>
        part.toLowerCase() === term.toLowerCase()
            ? <mark key={i} className="search-highlight">{part}</mark>
            : part
    )
}
