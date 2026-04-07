import { useRef, useState } from 'react'
import { formatDate } from '../../utils/relativeTime.js'
import { Link, useNavigate } from 'react-router-dom'
import { TEAM } from '../../data/team.js'
import { useEntries } from '../../context/useEntries.js'
import { slugify } from '../../utils/slugify.js'
import './SubmitForm.css'

function SubmitForm( { back = '/' } ) {
    const navigate = useNavigate()
    const { entries, refetch } = useEntries()
    const nameInputRef = useRef( null )

    const allNames = [...new Set( [
        ...TEAM,
        ...entries.map( ( e ) => e.submitter_name ).filter( Boolean ),
    ] )].sort()

    const [url, setUrl] = useState( '' )
    const [title, setTitle] = useState( '' )
    const [bullets, setBullets] = useState( ['', '', ''] )
    const [generatingBullets, setGeneratingBullets] = useState( false )
    const [generateError, setGenerateError] = useState( '' )
    const [tags, setTags] = useState( [] )
    const [tagInput, setTagInput] = useState( '' )
    const [submitterName, setSubmitterName] = useState( () => localStorage.getItem( 'aih_submitter_name' ) || '' )
    const [readingTime, setReadingTime] = useState( '' )
    const [publishedAt, setPublishedAt] = useState( null )
    const [fetchingTitle, setFetchingTitle] = useState( false )
    const [duplicateEntry, setDuplicateEntry] = useState( null )
    const [nameMatches, setNameMatches] = useState( [] )
    const [showNameDropdown, setShowNameDropdown] = useState( false )

    async function handleUrlBlur() {
        const trimmed = url.trim()
        if ( !trimmed ) return

        const existing = entries.find( ( e ) => e.url.toLowerCase() === trimmed.toLowerCase() )
        setDuplicateEntry( existing || null )

        if ( !title.trim() ) {
            setFetchingTitle( true )
            try {
                const res = await fetch( `/api/fetch-title?url=${encodeURIComponent( trimmed )}` )
                if ( res.ok ) {
                    const data = await res.json()
                    if ( data.title ) setTitle( data.title )
                    if ( data.published_at ) setPublishedAt( data.published_at )
                }
            } catch {
                // gracefully skip — form works without auto-fill
            } finally {
                setFetchingTitle( false )
            }
        }
    }

    async function handleGenerateBullets() {
        if ( !url.trim() || generatingBullets ) return
        setGeneratingBullets( true )
        setGenerateError( '' )
        try {
            const res = await fetch( '/api/generate-bullets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { url: url.trim() } ),
            } )
            const data = await res.json()
            if ( res.ok && data.bullets?.length ) {
                setBullets( data.bullets )
            } else {
                setGenerateError( data.error || 'Could not generate learnings. Please fill them in manually.' )
            }
        } catch {
            setGenerateError( 'Could not reach the AI. Please fill them in manually.' )
        } finally {
            setGeneratingBullets( false )
        }
    }

    function handleBulletChange( index, value ) {
        const next = [...bullets]
        next[index] = value
        setBullets( next )
    }

    function addBullet() {
        setBullets( [...bullets, ''] )
    }

    function removeBullet( index ) {
        if ( bullets.length <= 1 ) return
        setBullets( bullets.filter( ( _, i ) => i !== index ) )
    }

    function handleTagKeyDown( e ) {
        if ( ( e.key === 'Enter' || e.key === ',' ) && tagInput.trim() ) {
            e.preventDefault()
            const tag = tagInput.trim().toLowerCase().replace( /\s+/g, '-' ).replace( /[^a-z0-9-]/g, '' )
            if ( tag && !tags.includes( tag ) ) setTags( [...tags, tag] )
            setTagInput( '' )
        }
        if ( e.key === 'Backspace' && !tagInput && tags.length > 0 ) {
            setTags( tags.slice( 0, -1 ) )
        }
    }

    function handleNameChange( value ) {
        setSubmitterName( value )
        if ( value.length >= 1 ) {
            const q = value.toLowerCase()
            const matches = allNames.filter( ( name ) =>
                name.toLowerCase().startsWith( q ) ||
                name.toLowerCase().includes( ` ${q}` )
            ).slice( 0, 6 )
            setNameMatches( matches )
            setShowNameDropdown( matches.length > 0 )
        } else {
            setNameMatches( [] )
            setShowNameDropdown( false )
        }
    }

    function selectName( name ) {
        setSubmitterName( name )
        setShowNameDropdown( false )
        setNameMatches( [] )
    }

    async function handleSubmit( e ) {
        e.preventDefault()
        if ( duplicateEntry ) return

        const trimmedBullets = bullets.filter( ( b ) => b.trim() )
        if ( !trimmedBullets.length ) return

        if ( submitterName.trim() ) {
            localStorage.setItem( 'aih_submitter_name', submitterName.trim() )
        }

        const newEntry = {
            id: slugify( title.trim() ),
            url: url.trim(),
            title: title.trim(),
            summary: trimmedBullets,
            tags,
            click_count: 0,
            heart_count: 0,
            created_at: new Date().toISOString(),
            submitter_name: submitterName.trim() || null,
            reading_time: readingTime ? Number( readingTime ) : null,
            published_at: publishedAt ?? null,
        }

        const res = await fetch( '/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( newEntry ),
        } )

        if ( !res.ok ) {
            const { error } = await res.json().catch( () => ( {} ) )
            console.error( 'Failed to save entry:', error ?? res.status )
            return
        }

        await refetch()

        navigate( back )
    }

    const validBullets = bullets.filter( ( b ) => b.trim() ).length > 0
    const isValid = url.trim() && title.trim() && validBullets && !duplicateEntry

    return (
        <form className="submit-form" onSubmit={handleSubmit} noValidate>

            <div className="submit-form__field">
                <label className="submit-form__label" htmlFor="sf-url">URL</label>
                <input
                    id="sf-url"
                    type="url"
                    className="submit-form__input"
                    placeholder="https://…"
                    value={url}
                    onChange={( e ) => { setUrl( e.target.value ); setDuplicateEntry( null ) }}
                    onBlur={handleUrlBlur}
                    required
                />
                {duplicateEntry && (
                    <p className="submit-form__hint submit-form__hint--warn">
                        This URL was already submitted.{' '}
                        <Link to={`/entry/${duplicateEntry.id}`} className="submit-form__hint-link">
                            View existing entry ↗
                        </Link>
                    </p>
                )}
            </div>

            <div className="submit-form__field">
                <label className="submit-form__label" htmlFor="sf-title">
                    Title
                    {fetchingTitle && <span className="submit-form__fetching"> · Fetching…</span>}
                </label>
                <input
                    id="sf-title"
                    type="text"
                    className="submit-form__input"
                    placeholder="Article or resource title"
                    value={title}
                    onChange={( e ) => setTitle( e.target.value )}
                    required
                />
                {publishedAt && (
                    <p className="submit-form__hint submit-form__hint--published">
                        Published {formatDate( publishedAt )}
                    </p>
                )}
            </div>

            <div className="submit-form__field">
                <label className="submit-form__label">Key Learnings</label>
                <div className="submit-form__learnings-header">
                    <p className="submit-form__hint">What are a few (3-5ish) things someone should take away?</p>
                    <button
                        type="button"
                        className="submit-form__generate"
                        onClick={handleGenerateBullets}
                        disabled={!url.trim() || generatingBullets}
                        title={!url.trim() ? 'Enter a URL first' : 'Generate with AI'}
                    >
                        {generatingBullets ? 'Generating…' : '✦ Generate with AI'}
                    </button>
                </div>
                {generateError && (
                    <p className="submit-form__generate-error">{generateError}</p>
                )}
                <div className="submit-form__bullets">
                    {bullets.map( ( bullet, i ) => (
                        <div key={i} className="submit-form__bullet-row">
                            <span className="submit-form__bullet-dot">·</span>
                            <input
                                type="text"
                                className="submit-form__input submit-form__bullet-input"
                                placeholder={`Learning ${i + 1}…`}
                                value={bullet}
                                onChange={( e ) => handleBulletChange( i, e.target.value )}
                            />
                            {bullets.length > 1 && (
                                <button
                                    type="button"
                                    className="submit-form__bullet-remove"
                                    onClick={() => removeBullet( i )}
                                    aria-label="Remove bullet"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    ) )}
                    <button type="button" className="submit-form__add-bullet" onClick={addBullet}>
                        + Add bullet
                    </button>
                </div>
            </div>

            <div className="submit-form__field">
                <label className="submit-form__label" htmlFor="sf-tags">Tags</label>
                <div className="submit-form__tag-area">
                    {tags.map( ( tag ) => (
                        <span key={tag} className="submit-form__tag">
                            #{tag}
                            <button
                                type="button"
                                className="submit-form__tag-remove"
                                onClick={() => setTags( tags.filter( ( t ) => t !== tag ) )}
                                aria-label={`Remove tag ${tag}`}
                            >×</button>
                        </span>
                    ) )}
                    <input
                        id="sf-tags"
                        type="text"
                        className="submit-form__tag-input"
                        placeholder={tags.length ? '' : 'Type a tag, press Enter or comma…'}
                        value={tagInput}
                        onChange={( e ) => setTagInput( e.target.value )}
                        onKeyDown={handleTagKeyDown}
                    />
                </div>
            </div>

            <div className="submit-form__row">
                <div className="submit-form__field submit-form__field--grow">
                    <label className="submit-form__label" htmlFor="sf-name">Your Name</label>
                    <div className="submit-form__autocomplete">
                        <input
                            id="sf-name"
                            ref={nameInputRef}
                            type="text"
                            className="submit-form__input"
                            placeholder="Firstname L."
                            value={submitterName}
                            onChange={( e ) => handleNameChange( e.target.value )}
                            onBlur={() => setTimeout( () => setShowNameDropdown( false ), 150 )}
                            autoComplete="off"
                        />
                        {showNameDropdown && (
                            <ul className="submit-form__dropdown">
                                {nameMatches.map( ( name ) => (
                                    <li key={name}>
                                        <button
                                            type="button"
                                            className="submit-form__dropdown-item"
                                            onMouseDown={() => selectName( name )}
                                        >
                                            {name}
                                        </button>
                                    </li>
                                ) )}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="submit-form__field">
                    <label className="submit-form__label" htmlFor="sf-reading-time">
                        Reading Time (min)
                    </label>
                    <input
                        id="sf-reading-time"
                        type="number"
                        className="submit-form__input submit-form__input--narrow"
                        placeholder="5"
                        min="1"
                        max="120"
                        value={readingTime}
                        onChange={( e ) => setReadingTime( e.target.value )}
                    />
                </div>
            </div>

            <div className="submit-form__actions">
                <button type="button" className="submit-form__cancel" onClick={() => navigate( back )}>
                    Cancel
                </button>
                <button type="submit" className="submit-form__submit" disabled={!isValid}>
                    Submit Learning
                </button>
            </div>

        </form>
    )
}

export default SubmitForm
