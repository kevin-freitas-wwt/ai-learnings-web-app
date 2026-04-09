import { useRef, useState } from 'react'
import './PodcastTest.css'

function PodcastTest() {
    const [script, setScript] = useState( [] )
    const [weekLabel, setWeekLabel] = useState( '' )
    const [scriptLoading, setScriptLoading] = useState( false )
    const [scriptError, setScriptError] = useState( null )
    const [copied, setCopied] = useState( false )

    const [audioUrl, setAudioUrl] = useState( null )
    const [audioLoading, setAudioLoading] = useState( false )
    const [audioError, setAudioError] = useState( null )
    const prevAudioUrl = useRef( null )

    async function handleGenerateScript() {
        setScriptLoading( true )
        setScriptError( null )
        setAudioUrl( null )
        try {
            const res = await fetch( '/api/podcast' )
            if ( !res.ok ) throw new Error( `Server error ${res.status}` )
            const data = await res.json()
            if ( !data.script?.length ) throw new Error( 'No entries found for this week' )
            setScript( data.script )
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

    function updateSegment( index, field, value ) {
        setScript( ( prev ) => prev.map( ( seg, i ) => i === index ? { ...seg, [field]: value } : seg ) )
    }

    function removeSegment( index ) {
        setScript( ( prev ) => prev.filter( ( _, i ) => i !== index ) )
    }

    function addSegment() {
        setScript( ( prev ) => [...prev, { speaker: 'host1', text: '' }] )
    }

    async function handleCopy() {
        const text = script.map( ( seg ) => `${seg.speaker === 'host1' ? 'Alex' : 'Jordan'}: ${seg.text}` ).join( '\n\n' )
        await navigator.clipboard.writeText( text )
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
                        {script.length > 0 && (
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

                {script.length === 0 && !scriptLoading && !scriptError && (
                    <div className="podcast-test__empty">
                        Script will appear here. Click Generate Script to pull the top 5 entries from the last 7 days.
                    </div>
                )}

                {script.length > 0 && (
                    <div className="podcast-test__segments">
                        {script.map( ( seg, i ) => (
                            <div key={i} className="podcast-test__segment">
                                <button
                                    className={`podcast-test__speaker podcast-test__speaker--${seg.speaker}`}
                                    onClick={() => updateSegment( i, 'speaker', seg.speaker === 'host1' ? 'host2' : 'host1' )}
                                    title="Click to toggle speaker"
                                >
                                    {seg.speaker === 'host1' ? 'Alex' : 'Jordan'}
                                </button>
                                <textarea
                                    className="podcast-test__segment-text"
                                    value={seg.text}
                                    rows={Math.max( 2, Math.ceil( seg.text.length / 72 ) )}
                                    onChange={( e ) => updateSegment( i, 'text', e.target.value )}
                                />
                                <button
                                    className="podcast-test__segment-remove"
                                    onClick={() => removeSegment( i )}
                                    aria-label="Remove segment"
                                >✕</button>
                            </div>
                        ) )}
                        <button className="podcast-test__add-segment" onClick={addSegment}>
                            + Add segment
                        </button>
                    </div>
                )}
            </section>

            <section className="podcast-test__section">
                <div className="podcast-test__section-header">
                    <div>
                        <h2 className="podcast-test__section-title">Audio</h2>
                        {!audioLoading && !audioUrl && script.length > 0 && (
                            <span className="podcast-test__hint">Takes ~20–30 seconds via ElevenLabs</span>
                        )}
                        {audioLoading && (
                            <span className="podcast-test__hint">Generating audio, this may take ~30 seconds…</span>
                        )}
                    </div>
                    <button
                        className="podcast-test__btn"
                        onClick={handleGenerateAudio}
                        disabled={audioLoading || script.length === 0}
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
