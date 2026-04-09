import { Outlet } from 'react-router-dom'
import SiteHeader from '../SiteHeader/SiteHeader.jsx'
import WelcomeModal from '../WelcomeModal/WelcomeModal.jsx'
import './RootLayout.css'

function RootLayout() {
    return (
        <>
            <WelcomeModal />
            <SiteHeader />
            <main className="root-layout__main">
                <Outlet />
            </main>
        </>
    )
}

export default RootLayout
