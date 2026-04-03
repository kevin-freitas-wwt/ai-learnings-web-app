import { useSearchParams } from 'react-router-dom'
import { CATEGORIES } from '../../data/categories.js'
import './FilterBar.css'

function FilterBar() {
    const [searchParams, setSearchParams] = useSearchParams()
    const search = searchParams.get( 'search' ) || ''
    const category = searchParams.get( 'category' ) || ''
    const sort = searchParams.get( 'sort' ) || 'newest'

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
        </div>
    )
}

export default FilterBar
