import { useEffect, useRef, useState } from 'react'
import './PodcastTest.css'

function PodcastTest() {
    const [scriptText, setScriptText] = useState( '' )
    const [weekLabel, setWeekLabel] = useState( '' )
    const [scriptLoading, setScriptLoading] = useState( false )
    const [scriptError, setScriptError] = useState( null )
    const [copied, setCopied] = useState( false )

    const [audioUrl, setAudioUrl] = useState( null )
    const [audioLoading, setAudioLoading] = useState( false )
    const [audioStep, setAudioStep] = useState( '' )
    const [audioError, setAudioError] = useState( null )
    const [audioUsage, setAudioUsage] = useState( null )

    const [musicPreviewUrl, setMusicPreviewUrl] = useState( null )
    const [musicPreviewSource, setMusicPreviewSource] = useState( null )
    const [musicPreviewLoading, setMusicPreviewLoading] = useState( false )
    const [musicPreviewError, setMusicPreviewError] = useState( null )
    const [musicTrackName, setMusicTrackName] = useState( null )
    const prevAudioUrl = useRef( null )
    const stepTimers = useRef( [] )
    const scriptRef = useRef( null )

    useEffect( () => {
        const el = scriptRef.current
        if ( !el ) return
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
    }, [scriptText] )

    async function handleGenerateScript() {
        setScriptLoading( true )
        setScriptError( null )
        setAudioUrl( null )
        try {
            const res = await fetch( '/api/podcast' )
            if ( !res.ok ) throw new Error( `Server error ${res.status}` )
            const data = await res.json()
            if ( !data.script?.length ) throw new Error( 'No entries found for this week' )
            setScriptText( data.script.map( ( seg ) => seg.text ).join( '\n\n' ) )
            setWeekLabel( `${data.weekStart}–${data.weekEnd}` )
        } catch ( err ) {
            setScriptError( err.message )
        } finally {
            setScriptLoading( false )
        }
    }

    function clearStepTimers() {
        stepTimers.current.forEach( clearTimeout )
        stepTimers.current = []
    }

    async function handleGenerateAudio() {
        setAudioLoading( true )
        setAudioError( null )
        setAudioUrl( null )
        if ( prevAudioUrl.current ) URL.revokeObjectURL( prevAudioUrl.current )

        // Show timed steps that match the real server pipeline
        setAudioStep( 'Connecting to ElevenLabs…' )
        clearStepTimers()
        const schedule = [
            [2000,  'Generating voice…'],
            [8000,  'Fetching background music…'],
            [14000, 'Mixing audio tracks…'],
        ]
        schedule.forEach( ( [delay, label] ) => {
            stepTimers.current.push( setTimeout( () => setAudioStep( label ), delay ) )
        } )

        try {
            // Split on blank lines so SSML breaks land between each entry paragraph
            const script = scriptText.split( /\n\n+/ ).filter( Boolean ).map( ( text ) => ( { text } ) )
            const res = await fetch( '/api/podcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { script } ),
            } )
            if ( !res.ok ) {
                const err = await res.json().catch( () => ( {} ) )
                throw new Error( err.error || `Server error ${res.status}` )
            }
            const used = res.headers.get( 'x-elevenlabs-characters-used' )
            const limit = res.headers.get( 'x-elevenlabs-characters-limit' )
            const resetUnix = res.headers.get( 'x-elevenlabs-reset-unix' )
            if ( used && limit ) {
                const resetDate = resetUnix
                    ? new Date( Number( resetUnix ) * 1000 ).toLocaleDateString( 'en-US', { month: 'long', day: 'numeric' } )
                    : null
                setAudioUsage( { used: Number( used ), limit: Number( limit ), resetDate } )
            }
            const blob = await res.blob()
            const url = URL.createObjectURL( blob )
            prevAudioUrl.current = url
            setAudioUrl( url )
        } catch ( err ) {
            setAudioError( err.message )
        } finally {
            clearStepTimers()
            setAudioLoading( false )
            setAudioStep( '' )
        }
    }

    async function handleMusicPreview() {
        setMusicPreviewLoading( true )
        setMusicPreviewUrl( null )
        setMusicPreviewSource( null )
        setMusicPreviewError( null )
        setMusicTrackName( null )
        try {
            const res = await fetch( '/api/podcast?preview=music' )
            const data = await res.json()
            setMusicPreviewUrl( data.url || null )
            setMusicPreviewSource( data.source )
            setMusicPreviewError( data.jamendoError || null )
            setMusicTrackName( data.trackName || null )
        } catch {
            setMusicPreviewSource( 'error' )
        } finally {
            setMusicPreviewLoading( false )
        }
    }

    async function handleCopy() {
        await navigator.clipboard.writeText( scriptText )
        setCopied( true )
        setTimeout( () => setCopied( false ), 2000 )
    }

    return (
        <div className="podcast-test">
            <div className="podcast-test__page-header">
                <h1 className="podcast-test__title">Podcast Test</h1>
                <p className="podcast-test__desc">Generate and preview the weekly AI Learnings podcast before it goes out.</p>
            </div>

            <section className="podcast-test__section">
                <div className="podcast-test__section-header">
                    <div>
                        <h2 className="podcast-test__section-title">Script</h2>
                        {weekLabel && <span className="podcast-test__week-label">{weekLabel}</span>}
                    </div>
                    <div className="podcast-test__section-actions">
                        {scriptText && (
                            <button
                                className="podcast-test__btn podcast-test__btn--secondary"
                                onClick={handleCopy}
                            >
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        )}
                        <button
                            className="podcast-test__btn"
                            onClick={handleGenerateScript}
                            disabled={scriptLoading}
                        >
                            {scriptLoading ? 'Generating…' : 'Generate Script'}
                        </button>
                    </div>
                </div>

                {scriptError && <p className="podcast-test__error">{scriptError}</p>}

                <textarea
                    ref={scriptRef}
                    className="podcast-test__script"
                    value={scriptText}
                    onChange={( e ) => setScriptText( e.target.value )}
                    placeholder="Paste or generate a script…"
                    disabled={scriptLoading}
                />
            </section>

            <section className="podcast-test__section">
                <div className="podcast-test__section-header">
                    <div>
                        <h2 className="podcast-test__section-title">Audio</h2>
                        {audioLoading && audioStep && (
                            <span className="podcast-test__step">{audioStep}</span>
                        )}
                        {!audioLoading && !audioUrl && scriptText && (
                            <span className="podcast-test__hint">Includes ambient background music</span>
                        )}
                    </div>
                    <button
                        className="podcast-test__btn"
                        onClick={handleGenerateAudio}
                        disabled={audioLoading || !scriptText}
                    >
                        {audioLoading ? 'Generating…' : 'Generate Audio'}
                    </button>
                </div>

                {audioError && <p className="podcast-test__error">{audioError}</p>}

                {!audioUrl && !audioLoading && !audioError && (
                    <div className="podcast-test__empty">
                        Audio player will appear here after generation.
                    </div>
                )}

                {audioUrl && (
                    <>
                        <audio
                            className="podcast-test__player"
                            controls
                            src={audioUrl}
                        />
                        <a
                            className="podcast-test__btn podcast-test__btn--secondary podcast-test__download"
                            href={audioUrl}
                            download={`AI Learnings Hub${weekLabel ? ` for ${weekLabel}` : ''}.mp3`}
                        >
                            Save MP3
                        </a>
                    </>
                )}

                {audioUsage && (
                    <p className="podcast-test__usage">
                        ElevenLabs: {audioUsage.used.toLocaleString()} / {audioUsage.limit.toLocaleString()} characters used
                        {audioUsage.resetDate && ` — resets ${audioUsage.resetDate}`}
                    </p>
                )}
            </section>

            <section className="podcast-test__section">
                <div className="podcast-test__section-header">
                    <div>
                        <h2 className="podcast-test__section-title">Backing Track</h2>
                        {musicPreviewSource === 'jamendo' && (
                            <span className="podcast-test__hint">
                                {musicTrackName ? musicTrackName : 'Sourced from Jamendo'}
                            </span>
                        )}
                        {musicPreviewSource === 'custom' && <span className="podcast-test__hint">Using PODCAST_MUSIC_URL override</span>}
                        {musicPreviewSource === 'bundled' && <span className="podcast-test__hint">Using bundled track</span>}
                        {musicPreviewError && <span className="podcast-test__hint podcast-test__hint--warn">Jamendo: {musicPreviewError}</span>}
                        {musicPreviewSource === 'error' && <span className="podcast-test__hint">Could not load track</span>}
                    </div>
                    <button
                        className="podcast-test__btn podcast-test__btn--secondary"
                        onClick={handleMusicPreview}
                        disabled={musicPreviewLoading}
                    >
                        {musicPreviewLoading ? 'Fetching…' : 'Preview Backing Track'}
                    </button>
                </div>

                {!musicPreviewSource && !musicPreviewLoading && (
                    <div className="podcast-test__empty">
                        Preview the background music track that will be used in generated audio.
                    </div>
                )}

                {( musicPreviewSource || musicPreviewLoading ) && (
                    <audio
                        className="podcast-test__player"
                        controls
                        src={musicPreviewUrl || ''}
                    />
                )}
            </section>
        </div>
    )
}

export default PodcastTest
