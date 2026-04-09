import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEntries } from '../../context/useEntries.js'
import { relativeTime, formatDate } from '../../utils/relativeTime.js'
import './EntryModal.css'

function EntryModal() {
    const { id } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { entries, loading, refetch } = useEntries()
    const entry = entries.find( ( e ) => e.id === id )

    const storedHearts = JSON.parse( localStorage.getItem( 'aih_hearts' ) || '[]' )
    const [hearted, setHearted] = useState( () => storedHearts.includes( id ) )
    const [heartCount, setHeartCount] = useState( entry ? entry.heart_count : 0 )

    const myName = localStorage.getItem( 'aih_submitter_name' ) || ''
    const isOwner = !!myName && !!entry?.submitter_name && myName === entry.submitter_name

    const [editing, setEditing] = useState( false )
    const [editBullets, setEditBullets] = useState( [] )
    const [editTags, setEditTags] = useState( [] )
    const [tagInput, setTagInput] = useState( '' )
    const [saving, setSaving] = useState( false )
    const [saveError, setSaveError] = useState( '' )

    const [confirmDelete, setConfirmDelete] = useState( false )
    const [deleting, setDeleting] = useState( false )
    const [copied, setCopied] = useState( false )

    function handleShare() {
        navigator.clipboard.writeText( window.location.href ).then( () => {
            setCopied( true )
            setTimeout( () => setCopied( false ), 2000 )
        } ).catch( () => {} )
    }

    async function handleDelete() {
        setDeleting( true )
        try {
            const res = await fetch( `/api/entries/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { submitter_name: myName } ),
            } )
            if ( res.ok ) {
                await refetch()
                navigate( '/' )
            }
        } catch {
            // ignore — button resets below
        } finally {
            setDeleting( false )
            setConfirmDelete( false )
        }
    }

    function startEdit() {
        setEditBullets( [...entry.summary] )
        setEditTags( [...entry.tags] )
        setTagInput( '' )
        setSaveError( '' )
        setEditing( true )
    }

    function cancelEdit() {
        setEditing( false )
        setTagInput( '' )
        setSaveError( '' )
    }

    function handleTagKeyDown( e ) {
        if ( ( e.key === 'Enter' || e.key === ',' ) && tagInput.trim() ) {
            e.preventDefault()
            const tag = tagInput.trim().toLowerCase().replace( /\s+/g, '-' ).replace( /[^a-z0-9-]/g, '' )
            if ( tag && !editTags.includes( tag ) ) setEditTags( [...editTags, tag] )
            setTagInput( '' )
        }
        if ( e.key === 'Backspace' && !tagInput && editTags.length > 0 ) {
            setEditTags( editTags.slice( 0, -1 ) )
        }
    }

    function removeEditTag( tag ) {
        setEditTags( editTags.filter( ( t ) => t !== tag ) )
    }

    function handleEditBulletChange( i, value ) {
        const next = [...editBullets]
        next[i] = value
        setEditBullets( next )
    }

    function addEditBullet() {
        setEditBullets( [...editBullets, ''] )
    }

    function removeEditBullet( i ) {
        if ( editBullets.length <= 1 ) return
        setEditBullets( editBullets.filter( ( _, idx ) => idx !== i ) )
    }

    async function saveBullets() {
        const trimmed = editBullets.filter( ( b ) => b.trim() )
        if ( !trimmed.length ) return
        setSaving( true )
        setSaveError( '' )
        try {
            const editRes = await fetch( `/api/entries/${id}/edit`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { summary: trimmed, tags: editTags, submitter_name: myName } ),
            } )
            if ( !editRes.ok ) {
                const { error } = await editRes.json().catch( () => ( {} ) )
                setSaveError( error || 'Save failed' )
                return
            }
            await refetch()
            setEditing( false )
        } catch {
            setSaveError( 'Save failed' )
        } finally {
            setSaving( false )
        }
    }

    const close = useCallback( () => {
        navigate( `/${location.search}` )
    }, [navigate, location.search] )

    const handleHeart = useCallback( async () => {
        const stored = JSON.parse( localStorage.getItem( 'aih_hearts' ) || '[]' )
        const delta = hearted ? -1 : 1
        if ( hearted ) {
            localStorage.setItem( 'aih_hearts', JSON.stringify( stored.filter( ( hid ) => hid !== id ) ) )
            setHearted( false )
            setHeartCount( ( c ) => c - 1 )
        } else {
            localStorage.setItem( 'aih_hearts', JSON.stringify( [...stored, id] ) )
            setHearted( true )
            setHeartCount( ( c ) => c + 1 )
        }
        fetch( `/api/entries/${id}/interact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( { action: 'heart', delta } ),
        } ).then( () => refetch() ).catch( () => {} )
    }, [hearted, id, refetch] )

    useEffect( () => {
        if ( !entry ) return
        fetch( `/api/entries/${id}/interact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( { action: 'click' } ),
        } ).catch( () => {} )
    }, [entry, id] )

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

    if ( loading ) return null

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

    const related = entries
        .filter( ( e ) => e.id !== entry.id && e.tags.some( ( t ) => entry.tags.includes( t ) ) )
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
                    <h2 className="entry-modal__title" id="entry-modal-title">{entry.title}</h2>
                    <div className="entry-modal__source-row">
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
                        {entry.published_at && (
                            <span className="entry-modal__published">{formatDate( entry.published_at )}</span>
                        )}
                    </div>
                </div>

                {editing ? (
                    <div className="entry-modal__edit-summary">
                        <div className="entry-modal__edit-bullets">
                            {editBullets.map( ( bullet, i ) => (
                                <div key={i} className="entry-modal__edit-bullet-row">
                                    <span className="entry-modal__edit-bullet-dot">·</span>
                                    <input
                                        type="text"
                                        className="entry-modal__edit-bullet-input"
                                        value={bullet}
                                        onChange={( e ) => handleEditBulletChange( i, e.target.value )}
                                        placeholder={`Learning ${i + 1}…`}
                                    />
                                    {editBullets.length > 1 && (
                                        <button
                                            type="button"
                                            className="entry-modal__edit-bullet-remove"
                                            onClick={() => removeEditBullet( i )}
                                            aria-label="Remove bullet"
                                        >×</button>
                                    )}
                                </div>
                            ) )}
                        </div>
                        <button type="button" className="entry-modal__edit-add" onClick={addEditBullet}>
                            + Add bullet
                        </button>
                        <div className="entry-modal__edit-tags-section">
                            <span className="entry-modal__edit-tags-label">Tags</span>
                            <div className="entry-modal__edit-tag-area">
                                {editTags.map( ( tag ) => (
                                    <span key={tag} className="entry-modal__edit-tag">
                                        #{tag}
                                        <button
                                            type="button"
                                            className="entry-modal__edit-tag-remove"
                                            onClick={() => removeEditTag( tag )}
                                            aria-label={`Remove tag ${tag}`}
                                        >×</button>
                                    </span>
                                ) )}
                                <input
                                    type="text"
                                    className="entry-modal__edit-tag-input"
                                    placeholder={editTags.length ? '' : 'Type a tag, press Enter or comma…'}
                                    value={tagInput}
                                    onChange={( e ) => setTagInput( e.target.value )}
                                    onKeyDown={handleTagKeyDown}
                                />
                            </div>
                        </div>
                        {saveError && <p className="entry-modal__edit-error">{saveError}</p>}
                        <div className="entry-modal__edit-actions">
                            <button type="button" className="entry-modal__edit-cancel" onClick={cancelEdit}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="entry-modal__edit-save"
                                onClick={saveBullets}
                                disabled={saving || !editBullets.filter( ( b ) => b.trim() ).length}
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="entry-modal__summary-wrap">
                        <ul className="entry-modal__summary">
                            {entry.summary.map( ( bullet, i ) => (
                                <li key={i}>{bullet}</li>
                            ) )}
                        </ul>
                        {isOwner && (
                            <button className="entry-modal__edit-trigger" onClick={startEdit}>
                                Edit learnings
                            </button>
                        )}
                    </div>
                )}

                {entry.tags.length > 0 && (
                    <div className="entry-modal__tags">
                        {entry.tags.map( ( tag ) => (
                            <button
                                key={tag}
                                className="entry-modal__tag"
                                onClick={() => navigate( `/?tags=${encodeURIComponent( tag )}` )}
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
                            <button
                                className="entry-modal__submitter"
                                onClick={() => navigate( `/?submitter=${encodeURIComponent( entry.submitter_name )}` )}
                                title={`See all posts by ${entry.submitter_name}`}
                            >
                                Shared by {entry.submitter_name}
                            </button>
                        )}
                        <span className="entry-modal__time">{relativeTime( entry.created_at )}</span>
                        {entry.reading_time && (
                            <span className="entry-modal__reading-time">
                                {entry.reading_time} min read
                            </span>
                        )}
                    </div>
                    <div className="entry-modal__footer-actions">
                        {isOwner && (
                            confirmDelete ? (
                                <div className="entry-modal__delete-confirm">
                                    <span className="entry-modal__delete-confirm-label">Remove this entry?</span>
                                    <button
                                        className="entry-modal__delete-yes"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                    >
                                        {deleting ? 'Removing…' : 'Yes, remove'}
                                    </button>
                                    <button
                                        className="entry-modal__delete-no"
                                        onClick={() => setConfirmDelete( false )}
                                        disabled={deleting}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className="entry-modal__delete-trigger"
                                    onClick={() => setConfirmDelete( true )}
                                >
                                    Remove
                                </button>
                            )
                        )}
                        <button
                            className="entry-modal__share"
                            onClick={handleShare}
                            aria-label="Copy link to clipboard"
                            title="Copy link"
                        >
                            {copied ? '✓' : (
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M7 1 L7 8" />
                                    <path d="M4.5 3.5 L7 1 L9.5 3.5" />
                                    <path d="M3 6 L2 6 C1.45 6 1 6.45 1 7 L1 12 C1 12.55 1.45 13 2 13 L12 13 C12.55 13 13 12.55 13 12 L13 7 C13 6.45 12.55 6 12 6 L11 6" />
                                </svg>
                            )}
                        </button>
                        <button
                            className={`entry-modal__heart${hearted ? ' entry-modal__heart--active' : ''}`}
                            onClick={handleHeart}
                            aria-label={hearted ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            {hearted ? '♥' : '♡'} {heartCount}
                        </button>
                    </div>
                </div>

                {related.length > 0 && (
                    <div className="entry-modal__related">
                        <p className="entry-modal__related-label">Related</p>
                        <div className="entry-modal__related-items">
                            {related.map( ( rel ) => {
                                const relHostname = new URL( rel.url ).hostname.replace( 'www.', '' )
                                const relFavicon = `https://www.google.com/s2/favicons?domain=${relHostname}&sz=32`
                                return (
                                    <button
                                        key={rel.id}
                                        className="entry-modal__related-card"
                                        onClick={() => navigate( `/entry/${rel.id}${location.search}` )}
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
