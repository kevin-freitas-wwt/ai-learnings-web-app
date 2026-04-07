import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEntries } from '../../context/useEntries.js'
import './FilterBar.css'

function FilterBar() {
    const [searchParams, setSearchParams] = useSearchParams()
    const search = searchParams.get( 'search' ) || ''
    const tags = ( searchParams.get( 'tags' ) || '' ).split( ',' ).filter( Boolean )
    const sort = searchParams.get( 'sort' ) || 'freshest'
    const submitter = searchParams.get( 'submitter' ) || ''

    const { entries } = useEntries()
    const people = [...new Set(
        entries.map( ( e ) => e.submitter_name ).filter( Boolean )
    )].sort()

    const topTags = Object.entries(
        entries.flatMap( ( e ) => e.tags ).reduce( ( acc, t ) => {
            acc[t] = ( acc[t] || 0 ) + 1
            return acc
        }, {} )
    )
        .sort( ( a, b ) => b[1] - a[1] )
        .slice( 0, 15 )
        .map( ( [t] ) => t )

    const [personInput, setPersonInput] = useState( '' )
    const [personMatches, setPersonMatches] = useState( [] )
    const [showPersonDropdown, setShowPersonDropdown] = useState( false )
    const personInputRef = useRef( null )

    function setParam( key, value ) {
        const next = new URLSearchParams( searchParams )
        if ( value ) {
            next.set( key, value )
        } else {
            next.delete( key )
        }
        setSearchParams( next, { replace: true } )
    }

    function toggleTag( t ) {
        const next = new URLSearchParams( searchParams )
        const updated = tags.includes( t )
            ? tags.filter( ( x ) => x !== t )
            : [...tags, t]
        if ( updated.length > 0 ) {
            next.set( 'tags', updated.join( ',' ) )
        } else {
            next.delete( 'tags' )
        }
        setSearchParams( next, { replace: true } )
    }

    function handlePersonFocus() {
        const matches = personInput.trim()
            ? people.filter( ( n ) => n.toLowerCase().includes( personInput.toLowerCase() ) )
            : people
        setPersonMatches( matches )
        setShowPersonDropdown( matches.length > 0 )
    }

    function handlePersonChange( value ) {
        setPersonInput( value )
        const q = value.toLowerCase()
        const matches = q
            ? people.filter( ( n ) => n.toLowerCase().includes( q ) )
            : people
        setPersonMatches( matches )
        setShowPersonDropdown( matches.length > 0 )
    }

    function selectPerson( name ) {
        setParam( 'submitter', name )
        setPersonInput( '' )
        setShowPersonDropdown( false )
    }

    function clearPerson() {
        setParam( 'submitter', '' )
        setPersonInput( '' )
        setShowPersonDropdown( false )
        personInputRef.current?.focus()
    }

    return (
        <div className="filter-bar">
            <div className="filter-bar__top">
                <input
                    type="search"
                    className="filter-bar__search"
                    placeholder="Search titles, summaries, tags…"
                    value={search}
                    onChange={( e ) => setParam( 'search', e.target.value )}
                />
                {people.length > 0 && (
                    <div className="filter-bar__person-wrap">
                        {submitter ? (
                            <div className="filter-bar__person-selected">
                                <span className="filter-bar__person-selected-name">{submitter}</span>
                                <button
                                    className="filter-bar__person-clear"
                                    onClick={clearPerson}
                                    aria-label="Clear person filter"
                                >×</button>
                            </div>
                        ) : (
                            <div className="filter-bar__person-autocomplete">
                                <input
                                    ref={personInputRef}
                                    type="text"
                                    className="filter-bar__person-input"
                                    placeholder="Filter by person…"
                                    value={personInput}
                                    onChange={( e ) => handlePersonChange( e.target.value )}
                                    onFocus={handlePersonFocus}
                                    onBlur={() => setTimeout( () => setShowPersonDropdown( false ), 150 )}
                                    autoComplete="off"
                                />
                                {showPersonDropdown && (
                                    <ul className="filter-bar__person-dropdown">
                                        {personMatches.map( ( name ) => (
                                            <li key={name}>
                                                <button
                                                    type="button"
                                                    className="filter-bar__person-dropdown-item"
                                                    onMouseDown={() => selectPerson( name )}
                                                >
                                                    {name}
                                                </button>
                                            </li>
                                        ) )}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                )}
                <select
                    className="filter-bar__sort"
                    value={sort}
                    onChange={( e ) => setParam( 'sort', e.target.value )}
                    aria-label="Sort order"
                >
                    <option value="freshest">Freshest</option>
                    <option value="newest">Recently Added</option>
                    <option value="most-clicked">Most Clicked</option>
                    <option value="most-faved">Most Fav&apos;d</option>
                </select>
            </div>
            {topTags.length > 0 && (
                <div className="filter-bar__tags" role="group" aria-label="Filter by tag">
                    {tags.length > 0 && (
                        <button
                            className="filter-bar__tag-clear"
                            onClick={() => setParam( 'tags', '' )}
                        >
                            clear all
                        </button>
                    )}
                    {topTags.map( ( t ) => (
                        <button
                            key={t}
                            className={`filter-bar__tag${tags.includes( t ) ? ' filter-bar__tag--active' : ''}`}
                            onClick={() => toggleTag( t )}
                        >
                            #{t}{tags.includes( t ) && <span className="filter-bar__tag-x">×</span>}
                        </button>
                    ) )}
                </div>
            )}
            {tags.filter( ( t ) => !topTags.includes( t ) ).length > 0 && (
                <div className="filter-bar__overflow-tags">
                    {tags.filter( ( t ) => !topTags.includes( t ) ).map( ( t ) => (
                        <div key={t} className="filter-bar__active-tag">
                            <span className="filter-bar__active-tag-label">#{t}</span>
                            <button
                                className="filter-bar__active-tag-remove"
                                onClick={() => toggleTag( t )}
                                aria-label={`Remove tag ${t}`}
                            >
                                ×
                            </button>
                        </div>
                    ) )}
                </div>
            )}
        </div>
    )
}

export default FilterBar
