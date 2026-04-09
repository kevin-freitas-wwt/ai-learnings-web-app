import { useRef, useState } from 'react'
import './WelcomeModal.css'

const hasName = !!localStorage.getItem( 'aih_submitter_name' )

function WelcomeModal() {
    const [done, setDone] = useState( hasName )
    const [first, setFirst] = useState( '' )
    const [last, setLast] = useState( '' )
    const firstRef = useRef( null )

    if ( done ) return null

    function handleSubmit( e ) {
        e.preventDefault()
        const f = first.trim()
        const l = last.trim()
        if ( !f || !l ) return
        localStorage.setItem( 'aih_submitter_name', `${f} ${l[0].toUpperCase()}.` )
        setDone( true )
    }

    const isValid = first.trim().length > 0 && last.trim().length > 0

    return (
        <div className="welcome-modal__backdrop">
            <div className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title">
                <h2 className="welcome-modal__title" id="welcome-modal-title">Welcome to AI Learnings Hub</h2>
                <p className="welcome-modal__desc">Digital&rsquo;s place for sharing and finding AI learnings. What&rsquo;s your name?</p>
                <form className="welcome-modal__form" onSubmit={handleSubmit}>
                    <div className="welcome-modal__fields">
                        <input
                            ref={firstRef}
                            type="text"
                            className="welcome-modal__input"
                            placeholder="First name"
                            value={first}
                            onChange={( e ) => setFirst( e.target.value )}
                            autoComplete="given-name"
                            autoFocus
                            required
                        />
                        <input
                            type="text"
                            className="welcome-modal__input"
                            placeholder="Last name"
                            value={last}
                            onChange={( e ) => setLast( e.target.value )}
                            autoComplete="family-name"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="welcome-modal__submit"
                        disabled={!isValid}
                    >
                        Get started
                    </button>
                </form>
            </div>
        </div>
    )
}

export default WelcomeModal
