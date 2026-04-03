import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useKeyboardNav } from '../../hooks/useKeyboardNav.js'
import { seedEntries } from '../../data/seedEntries.js'
import { filterEntries } from '../../utils/filterEntries.js'
import { sortEntries } from '../../utils/sortEntries.js'
import EntryCard from '../EntryCard/EntryCard.jsx'
import './EntryFeed.css'

function EntryFeed() {
    const [searchParams] = useSearchParams()
    const search = searchParams.get( 'search' ) || ''
    const category = searchParams.get( 'category' ) || ''
    const sort = searchParams.get( 'sort' ) || 'newest'

    const [lastVisit] = useState( () => localStorage.getItem( 'aih_last_visit' ) )

    useEffect( () => {
        localStorage.setItem( 'aih_last_visit', new Date().toISOString() )
    }, [] )

    const filtered = filterEntries( seedEntries, { search, category } )
    const sorted = sortEntries( filtered, sort )

    const { focusedIndex } = useKeyboardNav( sorted )

    let newEntries = []
    let oldEntries = sorted
    let newCount = 0

    if ( lastVisit && sort === 'newest' ) {
        const cutoff = new Date( lastVisit )
        newEntries = sorted.filter( ( e ) => new Date( e.created_at ) > cutoff )
        oldEntries = sorted.filter( ( e ) => new Date( e.created_at ) <= cutoff )
        newCount = newEntries.length
    }

    const showDivider = newEntries.length > 0 && oldEntries.length > 0

    if ( sorted.length === 0 ) {
        return (
            <p className="entry-feed__empty">
                No learnings match your search. Try different keywords or clear the filters.
            </p>
        )
    }

    return (
        <div className="entry-feed">
            {newEntries.map( ( entry, i ) => (
                <div key={entry.id} className="entry-feed__item">
                    <EntryCard entry={entry} focused={focusedIndex === i} />
                </div>
            ) )}

            {showDivider && (
                <div className="entry-feed__divider">
                    <span>Previously seen</span>
                </div>
            )}

            {oldEntries.map( ( entry, i ) => (
                <div key={entry.id} className="entry-feed__item">
                    <EntryCard entry={entry} focused={focusedIndex === newCount + i} />
                </div>
            ) )}
        </div>
    )
}

export default EntryFeed
