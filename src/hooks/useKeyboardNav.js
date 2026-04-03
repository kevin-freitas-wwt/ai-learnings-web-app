import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function useKeyboardNav( entries ) {
    const [focusedIndex, setFocusedIndex] = useState( -1 )
    const navigate = useNavigate()
    const entriesRef = useRef( entries )
    const focusedRef = useRef( focusedIndex )

    useEffect( () => {
        entriesRef.current = entries
    }, [entries] )

    useEffect( () => {
        focusedRef.current = focusedIndex
    }, [focusedIndex] )

    const handleKeyDown = useCallback( ( e ) => {
        const tag = document.activeElement?.tagName
        if ( tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ) return

        switch ( e.key ) {
            case 'j':
            case 'J':
                e.preventDefault()
                setFocusedIndex( ( i ) => Math.min( i + 1, entriesRef.current.length - 1 ) )
                break
            case 'k':
            case 'K':
                e.preventDefault()
                setFocusedIndex( ( i ) => Math.max( i - 1, 0 ) )
                break
            case 'Enter': {
                const idx = focusedRef.current
                if ( idx >= 0 && entriesRef.current[idx] ) {
                    e.preventDefault()
                    navigate( `/entry/${entriesRef.current[idx].id}` )
                }
                break
            }
        }
    }, [navigate] )

    useEffect( () => {
        window.addEventListener( 'keydown', handleKeyDown )
        return () => window.removeEventListener( 'keydown', handleKeyDown )
    }, [handleKeyDown] )

    const effectiveFocusedIndex = focusedIndex >= 0 && focusedIndex < entries.length
        ? focusedIndex
        : -1

    return { focusedIndex: effectiveFocusedIndex }
}
