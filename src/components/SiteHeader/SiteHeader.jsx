import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEntries } from '../../context/useEntries.js'
import { exportHearts } from '../../utils/exportHearts.js'
import './SiteHeader.css'

const SLOT_EMOJIS = ['🎲', '🔮', '🌀', '⚡️', '🎯', '✨', '🎪', '🌈', '🎭', '🦄', '🚀', '💡', '🧠', '🎨', '🔥', '💫']

function pickEmoji() {
    return SLOT_EMOJIS[ Math.floor( Math.random() * SLOT_EMOJIS.length ) ]
}

function SiteHeader() {
    const navigate = useNavigate()
    const location = useLocation()
    const { entries } = useEntries()
    const [hasHearts] = useState( () => {
        const ids = JSON.parse( localStorage.getItem( 'aih_hearts' ) || '[]' )
        return ids.length > 0
    } )
    const [slotState, setSlotState] = useState( null )
    const intervalsRef = useRef( [] )

    function handleRandom() {
        if ( !entries.length || slotState ) return

        const initialReels = [
            { emoji: pickEmoji(), landed: false },
            { emoji: pickEmoji(), landed: false },
            { emoji: pickEmoji(), landed: false },
        ]
        setSlotState( { reels: initialReels } )

        intervalsRef.current = initialReels.map( ( _, i ) =>
            setInterval( () => {
                setSlotState( ( prev ) => {
                    if ( !prev || prev.reels[i].landed ) return prev
                    const next = [...prev.reels]
                    next[i] = { ...next[i], emoji: pickEmoji() }
                    return { reels: next }
                } )
            }, 55 )
        )

        function landReel( i ) {
            clearInterval( intervalsRef.current[i] )
            setSlotState( ( prev ) => {
                if ( !prev ) return prev
                const next = [...prev.reels]
                next[i] = { emoji: pickEmoji(), landed: true }
                return { reels: next }
            } )
        }

        setTimeout( () => landReel( 0 ), 650 )
        setTimeout( () => landReel( 1 ), 1000 )
        setTimeout( () => landReel( 2 ), 1300 )
        setTimeout( () => {
            setSlotState( null )
            const random = entries[ Math.floor( Math.random() * entries.length ) ]
            navigate( `/entry/${random.id}` )
        }, 1900 )
    }

    function handleExport() {
        exportHearts( entries )
    }

    return (
        <>
            {slotState && (
                <div className="slot-machine" aria-hidden="true">
                    <div className="slot-machine__cabinet">
                        <span className="slot-machine__label">✦ Random</span>
                        <div className="slot-machine__reels">
                            <div className="slot-machine__payline" />
                            {slotState.reels.map( ( reel, i ) => (
                                <div
                                    key={i}
                                    className={`slot-machine__reel${reel.landed ? ' slot-machine__reel--landed' : ' slot-machine__reel--spinning'}`}
                                >
                                    {reel.emoji}
                                </div>
                            ) )}
                        </div>
                        <span className="slot-machine__sub">Finding something good…</span>
                    </div>
                </div>
            )}
            <header className="site-header">
                <Link to="/" className="site-header__logo">
                    <h1>AI Learnings Hub</h1>
                </Link>
                <nav className="site-header__nav">
                    {hasHearts && (
                        <button className="site-header__export" onClick={handleExport} title="Export your hearted learnings">
                            ♥ Export
                        </button>
                    )}
                    <button className="site-header__random" onClick={handleRandom} disabled={!!slotState}>
                        ✦ Random
                    </button>
                    <Link
                        to="/submit"
                        state={{ back: location.search }}
                        className="site-header__submit"
                    >
                        + Submit
                    </Link>
                </nav>
            </header>
        </>
    )
}

export default SiteHeader
