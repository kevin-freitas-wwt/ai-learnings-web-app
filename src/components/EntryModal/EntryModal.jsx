import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { seedEntries } from '../../data/seedEntries.js'
import { relativeTime } from '../../utils/relativeTime.js'
import './EntryModal.css'

function EntryModal() {
    const { id } = useParams()
    const navigate = useNavigate()
    const entry = seedEntries.find( ( e ) => e.id === id )

    const storedHearts = JSON.parse( localStorage.getItem( 'aih_hearts' ) || '[]' )
    const [hearted, setHearted] = useState( () => storedHearts.includes( id ) )
    const [heartCount, setHeartCount] = useState( entry ? entry.heart_count : 0 )

    const close = useCallback( () => {
        navigate( '/' )
    }, [navigate] )

    const handleHeart = useCallback( () => {
        const stored = JSON.parse( localStorage.getItem( 'aih_hearts' ) || '[]' )
        if ( hearted ) {
            localStorage.setItem( 'aih_hearts', JSON.stringify( stored.filter( ( hid ) => hid !== id ) ) )
            setHearted( false )
            setHeartCount( ( c ) => c - 1 )
        } else {
            localStorage.setItem( 'aih_hearts', JSON.stringify( [...stored, id] ) )
            setHearted( true )
            setHeartCount( ( c ) => c + 1 )
        }
    }, [hearted, id] )

    useEffect( () => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [] )

    useEffect( () => {
        function handleKeyDown( e ) {
            const tag = document.activeElement?.tagName
            if ( tag === 'INPUT' || tag === 'TEXTAREA' ) return
            if ( e.key === 'Escape' ) close()
            if ( e.key === 'h' || e.key === 'H' ) handleHeart()
        }
        document.addEventListener( 'keydown', handleKeyDown )
        return () => document.removeEventListener( 'keydown', handleKeyDown )
    }, [close, handleHeart] )

    if ( !entry ) {
        return (
            <div className="entry-modal__backdrop" onClick={close}>
                <div
                    className="entry-modal"
                    role="dialog"
                    aria-modal="true"
                    onClick={( e ) => e.stopPropagation()}
                >
                    <button className="entry-modal__close" onClick={close} aria-label="Close">✕</button>
                    <p className="entry-modal__not-found">Entry not found.</p>
                </div>
            </div>
        )
    }

    const hostname = new URL( entry.url ).hostname.replace( 'www.', '' )
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`

    const related = seedEntries
        .filter( ( e ) => e.id !== entry.id && e.category === entry.category )
        .sort( ( a, b ) => b.heart_count - a.heart_count )
        .slice( 0, 5 )

    return (
        <div className="entry-modal__backdrop" onClick={close}>
            <div
                className="entry-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="entry-modal-title"
                onClick={( e ) => e.stopPropagation()}
            >
                <button className="entry-modal__close" onClick={close} aria-label="Close">✕</button>

                <div className="entry-modal__header">
                    <button
                        className="entry-modal__category"
                        onClick={() => navigate( `/?category=${encodeURIComponent( entry.category )}` )}
                        title={`Filter by ${entry.category}`}
                    >
                        {entry.category}
                    </button>
                    <h2 className="entry-modal__title" id="entry-modal-title">{entry.title}</h2>
                    <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="entry-modal__source"
                    >
                        <img
                            src={faviconUrl}
                            alt=""
                            className="entry-modal__favicon"
                            width="16"
                            height="16"
                        />
                        <span className="entry-modal__domain">{hostname}</span>
                        <span className="entry-modal__external">↗</span>
                    </a>
                </div>

                <ul className="entry-modal__summary">
                    {entry.summary.map( ( bullet, i ) => (
                        <li key={i}>{bullet}</li>
                    ) )}
                </ul>

                {entry.tags.length > 0 && (
                    <div className="entry-modal__tags">
                        {entry.tags.map( ( tag ) => (
                            <button
                                key={tag}
                                className="entry-modal__tag"
                                onClick={() => navigate( `/?tag=${encodeURIComponent( tag )}` )}
                                title={`Filter by #${tag}`}
                            >
                                #{tag}
                            </button>
                        ) )}
                    </div>
                )}

                <div className="entry-modal__footer">
                    <div className="entry-modal__meta">
                        {entry.submitter_name && (
                            <span className="entry-modal__submitter">
                                Shared by {entry.submitter_name}
                            </span>
                        )}
                        <span className="entry-modal__time">{relativeTime( entry.created_at )}</span>
                        {entry.reading_time && (
                            <span className="entry-modal__reading-time">
                                {entry.reading_time} min read
                            </span>
                        )}
                    </div>
                    <button
                        className={`entry-modal__heart${hearted ? ' entry-modal__heart--active' : ''}`}
                        onClick={handleHeart}
                        aria-label={hearted ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        {hearted ? '♥' : '♡'} {heartCount}
                    </button>
                </div>

                {related.length > 0 && (
                    <div className="entry-modal__related">
                        <p className="entry-modal__related-label">More in {entry.category}</p>
                        <div className="entry-modal__related-items">
                            {related.map( ( rel ) => {
                                const relHostname = new URL( rel.url ).hostname.replace( 'www.', '' )
                                const relFavicon = `https://www.google.com/s2/favicons?domain=${relHostname}&sz=32`
                                return (
                                    <button
                                        key={rel.id}
                                        className="entry-modal__related-card"
                                        onClick={() => navigate( `/entry/${rel.id}` )}
                                    >
                                        <div className="entry-modal__related-card-source">
                                            <img src={relFavicon} alt="" width="12" height="12" />
                                            <span className="entry-modal__related-card-domain">{relHostname}</span>
                                            {rel.reading_time && (
                                                <span className="entry-modal__related-card-time">
                                                    {rel.reading_time} min
                                                </span>
                                            )}
                                        </div>
                                        <p className="entry-modal__related-card-title">{rel.title}</p>
                                    </button>
                                )
                            } )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default EntryModal
