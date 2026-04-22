import { useState, useEffect } from 'react'

const KEY = 'aih_read'

export function useReadIds() {
    const [readIds, setReadIds] = useState(
        () => new Set( JSON.parse( localStorage.getItem( KEY ) || '[]' ) )
    )

    useEffect( () => {
        function sync() {
            setReadIds( new Set( JSON.parse( localStorage.getItem( KEY ) || '[]' ) ) )
        }
        window.addEventListener( 'aih:read', sync )
        return () => window.removeEventListener( 'aih:read', sync )
    }, [] )

    return readIds
}

export function markRead( id ) {
    const current = new Set( JSON.parse( localStorage.getItem( KEY ) || '[]' ) )
    if ( current.has( id ) ) return
    current.add( id )
    localStorage.setItem( KEY, JSON.stringify( [...current] ) )
    window.dispatchEvent( new Event( 'aih:read' ) )
}
