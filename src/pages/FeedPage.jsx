import { Outlet } from 'react-router-dom'
import EntryFeed from '../components/EntryFeed/EntryFeed.jsx'
import FilterBar from '../components/FilterBar/FilterBar.jsx'
import HotStrip from '../components/HotStrip/HotStrip.jsx'

function FeedPage() {
    return (
        <div className="feed-page">
            <HotStrip />
            <FilterBar />
            <EntryFeed />
            <Outlet />
        </div>
    )
}

export default FeedPage
