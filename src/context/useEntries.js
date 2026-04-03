import { createContext, useContext } from 'react'

export const EntriesContext = createContext( null )

export function useEntries() {
    return useContext( EntriesContext )
}
