import { useNavigate } from 'react-router-dom'
import { useEntries } from '../context/useEntries.js'
import { CATEGORIES } from '../data/categories.js'
import { computeCategoryCounts, totalCount } from '../utils/computeStats.js'
import './StatsPage.css'

function StatsPage() {
    const navigate = useNavigate()
    const { entries, loading } = useEntries()
    const counts = computeCategoryCounts( entries, CATEGORIES )
    const total = totalCount( entries )

    return (
        <div className="stats-page">
            <div className="stats-page__header">
                <div>
                    <h1 className="stats-page__title">Stats</h1>
                    <p className="stats-page__description">
                        Counts of learnings by category.
                    </p>
                </div>
                <button
                    className="stats-page__close"
                    onClick={() => navigate( '/' )}
                    aria-label="Close"
                >✕</button>
            </div>

            {loading ? (
                <p className="stats-page__loading">Loading…</p>
            ) : (
                <>
                    <p className="stats-page__total">Total entries: {total}</p>
                    <ul className="stats-page__list">
                        {Object.entries( counts ).map( ( [category, count] ) => (
                            <li key={category} className="stats-page__item">
                                <span className="stats-page__item-label">{category}</span>
                                <span className="stats-page__item-count">{count}</span>
                            </li>
                        ) )}
                    </ul>
                </>
            )}
        </div>
    )
}

export default StatsPage
