import { useCallback, useEffect, useState } from 'react'
import { seedEntries } from '../data/seedEntries.js'
import { EntriesContext } from './useEntries.js'

export function EntriesProvider( { children } ) {
    const [entries, setEntries] = useState( [] )
    const [loading, setLoading] = useState( true )
    const [refreshKey, setRefreshKey] = useState( 0 )

    const refetch = useCallback( () => setRefreshKey( ( k ) => k + 1 ), [] )

    useEffect( () => {
        let cancelled = false

        async function load() {
            try {
                const res = await fetch( '/api/entries' )
                if ( !res.ok ) throw new Error( `HTTP ${res.status}` )
                const data = await res.json()
                if ( !cancelled ) setEntries( data )
            } catch ( err ) {
                console.warn( 'API fetch failed, falling back to seed data:', err.message )
                if ( !cancelled ) setEntries( seedEntries )
            } finally {
                if ( !cancelled ) setLoading( false )
            }
        }

        load()
        return () => { cancelled = true }
    }, [refreshKey] )

    return (
        <EntriesContext.Provider value={{ entries, loading, refetch }}>
            {children}
        </EntriesContext.Provider>
    )
}
