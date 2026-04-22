import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { formatDate } from '../../utils/relativeTime.js'
import { highlight } from '../../utils/highlight.jsx'
import { useReadIds } from '../../hooks/useReadIds.js'
import './EntryCard.css'

function EntryCard( { entry, focused, lastVisit } ) {
    const { id, url, title, summary, reading_time, published_at, og_image } = entry
    const readIds = useReadIds()
    const isUnread = !!lastVisit
        && new Date( entry.created_at ) > new Date( lastVisit )
        && !readIds.has( id )
    const hostname = new URL( url ).hostname.replace( 'www.', '' )
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
    const cardRef = useRef( null )
    const location = useLocation()
    const searchTerm = new URLSearchParams( location.search ).get( 'search' ) || ''

    useEffect( () => {
        if ( focused && cardRef.current ) {
            cardRef.current.scrollIntoView( { behavior: 'smooth', block: 'nearest' } )
        }
    }, [focused] )

    return (
        <Link
            ref={cardRef}
            to={`/entry/${id}${location.search}`}
            className={`entry-card${focused ? ' entry-card--focused' : ''}`}
        >
            {og_image && (
                <img
                    src={og_image}
                    alt=""
                    className="entry-card__thumbnail"
                    onError={( e ) => { e.currentTarget.style.display = 'none' }}
                />
            )}
            {isUnread && <span className="entry-card__unread" aria-label="Unread" />}
            <h2 className="entry-card__title">{highlight( title, searchTerm )}</h2>
            <ul className="entry-card__summary">
                {summary.slice( 0, 2 ).map( ( bullet, i ) => (
                    <li key={i}>{highlight( bullet, searchTerm )}</li>
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
