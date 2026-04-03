import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { seedEntries } from '../../data/seedEntries.js'
import { exportHearts } from '../../utils/exportHearts.js'
import './SiteHeader.css'

function SiteHeader() {
    const navigate = useNavigate()
    const [hasHearts] = useState( () => {
        const ids = JSON.parse( localStorage.getItem( 'aih_hearts' ) || '[]' )
        return ids.length > 0
    } )

    function handleRandom() {
        const random = seedEntries[ Math.floor( Math.random() * seedEntries.length ) ]
        navigate( `/entry/${random.id}` )
    }

    function handleExport() {
        exportHearts( seedEntries )
    }

    return (
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
                <button className="site-header__random" onClick={handleRandom}>
                    ✦ Random
                </button>
                <Link to="/submit" className="site-header__submit">
                    + Submit
                </Link>
            </nav>
        </header>
    )
}

export default SiteHeader
