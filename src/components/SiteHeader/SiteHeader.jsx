import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useEntries } from '../../context/useEntries.js'
import { exportHearts } from '../../utils/exportHearts.js'
import './SiteHeader.css'

function SiteHeader() {
    const navigate = useNavigate()
    const { entries } = useEntries()
    const [hasHearts] = useState( () => {
        const ids = JSON.parse( localStorage.getItem( 'aih_hearts' ) || '[]' )
        return ids.length > 0
    } )

    function handleRandom() {
        if ( !entries.length ) return
        const random = entries[ Math.floor( Math.random() * entries.length ) ]
        navigate( `/entry/${random.id}` )
    }

    function handleExport() {
        exportHearts( entries )
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
