import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { formatDate } from '../../utils/relativeTime.js'
import './EntryCard.css'

function EntryCard( { entry, focused } ) {
    const { id, url, title, summary, reading_time, published_at } = entry
    const hostname = new URL( url ).hostname.replace( 'www.', '' )
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
    const cardRef = useRef( null )
    const location = useLocation()

    useEffect( () => {
        if ( focused && cardRef.current ) {
            cardRef.current.scrollIntoView( { behavior: 'smooth', block: 'nearest' } )
        }
    }, [focused] )

    return (
        <Link
            ref={cardRef}
            to={`/entry/${id}`}
            state={{ back: location.search }}
            className={`entry-card${focused ? ' entry-card--focused' : ''}`}
        >
            <h2 className="entry-card__title">{title}</h2>
            <ul className="entry-card__summary">
                {summary.slice( 0, 2 ).map( ( bullet, i ) => (
                    <li key={i}>{bullet}</li>
                ) )}
            </ul>
            {summary.length > 2 && (
                <p className="entry-card__more">…and {summary.length - 2} more</p>
            )}
            <div className="entry-card__footer">
                <div className="entry-card__source">
                    <img
                        src={faviconUrl}
                        alt=""
                        className="entry-card__favicon"
                        width="14"
                        height="14"
                    />
                    <span className="entry-card__domain">{hostname}</span>
                    {published_at && (
                        <span className="entry-card__published">{formatDate( published_at )}</span>
                    )}
                </div>
                <div className="entry-card__details">
                    {reading_time && (
                        <span className="entry-card__reading-time">{reading_time} min</span>
                    )}
                </div>
            </div>
        </Link>
    )
}

export default EntryCard
