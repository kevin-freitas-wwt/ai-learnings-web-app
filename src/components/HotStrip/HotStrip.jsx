import { Link } from 'react-router-dom'
import { useEntries } from '../../context/useEntries.js'
import './HotStrip.css'

function HotStrip() {
    const { entries } = useEntries()
    const hot = [...entries]
        .sort( ( a, b ) => ( b.click_count + b.heart_count ) - ( a.click_count + a.heart_count ) )
        .slice( 0, 4 )

    return (
        <div className="hot-strip">
            <span className="hot-strip__label">Hot right now</span>
            <div className="hot-strip__items">
                {hot.map( ( entry ) => (
                    <Link key={entry.id} to={`/entry/${entry.id}`} className="hot-strip__item">
                        <span className="hot-strip__title">{entry.title}</span>
                    </Link>
                ) )}
            </div>
        </div>
    )
}

export default HotStrip
