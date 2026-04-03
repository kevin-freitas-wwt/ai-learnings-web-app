import { Link } from 'react-router-dom'
import { seedEntries } from '../../data/seedEntries.js'
import './HotStrip.css'

function HotStrip() {
    const hot = [...seedEntries]
        .sort( ( a, b ) => ( b.click_count + b.heart_count ) - ( a.click_count + a.heart_count ) )
        .slice( 0, 4 )

    return (
        <div className="hot-strip">
            <span className="hot-strip__label">Hot right now</span>
            <div className="hot-strip__items">
                {hot.map( ( entry ) => (
                    <Link key={entry.id} to={`/entry/${entry.id}`} className="hot-strip__item">
                        <span className="hot-strip__title">{entry.title}</span>
                        <span className="hot-strip__stats">
                            {entry.heart_count}♥ &middot; {entry.click_count} clicks
                        </span>
                    </Link>
                ) )}
            </div>
        </div>
    )
}

export default HotStrip
