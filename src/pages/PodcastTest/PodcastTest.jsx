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
    const [audioError, setAudioError] = useState( null )
    const prevAudioUrl = useRef( null )
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

    async function handleGenerateAudio() {
        setAudioLoading( true )
        setAudioError( null )
        if ( prevAudioUrl.current ) URL.revokeObjectURL( prevAudioUrl.current )
        try {
            const script = [{ text: scriptText }]
            const res = await fetch( '/api/podcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { script } ),
            } )
            if ( !res.ok ) {
                const err = await res.json().catch( () => ( {} ) )
                throw new Error( err.error || `Server error ${res.status}` )
            }
            const blob = await res.blob()
            const url = URL.createObjectURL( blob )
            prevAudioUrl.current = url
            setAudioUrl( url )
        } catch ( err ) {
            setAudioError( err.message )
        } finally {
            setAudioLoading( false )
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

                {!scriptText && !scriptLoading && !scriptError && (
                    <div className="podcast-test__empty">
                        Script will appear here. Click Generate Script to pull the top 5 entries from the last 7 days.
                    </div>
                )}

                {( scriptText || scriptLoading ) && (
                    <textarea
                        ref={scriptRef}
                        className="podcast-test__script"
                        value={scriptText}
                        onChange={( e ) => setScriptText( e.target.value )}
                        placeholder="Generating…"
                        disabled={scriptLoading}
                    />
                )}
            </section>

            <section className="podcast-test__section">
                <div className="podcast-test__section-header">
                    <div>
                        <h2 className="podcast-test__section-title">Audio</h2>
                        {audioLoading && (
                            <span className="podcast-test__hint">Generating audio, this may take ~30 seconds…</span>
                        )}
                        {!audioLoading && !audioUrl && scriptText && (
                            <span className="podcast-test__hint">Includes auto-selected ambient background music</span>
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
                    <audio
                        className="podcast-test__player"
                        controls
                        src={audioUrl}
                    />
                )}
            </section>
        </div>
    )
}

export default PodcastTest
