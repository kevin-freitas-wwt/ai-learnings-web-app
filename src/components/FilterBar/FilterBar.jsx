import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CATEGORIES } from '../../data/categories.js'
import { useEntries } from '../../context/useEntries.js'
import './FilterBar.css'

function FilterBar() {
    const [searchParams, setSearchParams] = useSearchParams()
    const search = searchParams.get( 'search' ) || ''
    const category = searchParams.get( 'category' ) || ''
    const tag = searchParams.get( 'tag' ) || ''
    const sort = searchParams.get( 'sort' ) || 'newest'
    const submitter = searchParams.get( 'submitter' ) || ''

    const { entries } = useEntries()
    const people = [...new Set(
        entries.map( ( e ) => e.submitter_name ).filter( Boolean )
    )].sort()

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

    function handleCategoryClick( cat ) {
        setParam( 'category', category === cat ? '' : cat )
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
                <select
                    className="filter-bar__sort"
                    value={sort}
                    onChange={( e ) => setParam( 'sort', e.target.value )}
                    aria-label="Sort order"
                >
                    <option value="newest">Newest</option>
                    <option value="most-clicked">Most Clicked</option>
                    <option value="most-faved">Most Fav&apos;d</option>
                </select>
            </div>
            {tag && (
                <div className="filter-bar__active-tag">
                    <span className="filter-bar__active-tag-label">Tag: #{tag}</span>
                    <button
                        className="filter-bar__active-tag-remove"
                        onClick={() => setParam( 'tag', '' )}
                        aria-label="Remove tag filter"
                    >
                        ×
                    </button>
                </div>
            )}
            <div className="filter-bar__bottom">
                <div className="filter-bar__categories" role="group" aria-label="Filter by category">
                    <button
                        className={`filter-bar__cat${!category ? ' filter-bar__cat--active' : ''}`}
                        onClick={() => setParam( 'category', '' )}
                    >
                        All
                    </button>
                    {CATEGORIES.map( ( cat ) => (
                        <button
                            key={cat}
                            className={`filter-bar__cat${category === cat ? ' filter-bar__cat--active' : ''}`}
                            onClick={() => handleCategoryClick( cat )}
                        >
                            {cat}
                        </button>
                    ) )}
                </div>
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
            </div>
        </div>
    )
}

export default FilterBar
