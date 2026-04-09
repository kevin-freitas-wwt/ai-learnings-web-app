import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { EntriesProvider } from './context/EntriesContext.jsx'
import RootLayout from './components/RootLayout/RootLayout.jsx'
import EntryModal from './components/EntryModal/EntryModal.jsx'
import FeedPage from './pages/FeedPage.jsx'
import SubmitPage from './pages/SubmitPage.jsx'
import PodcastTest from './pages/PodcastTest/PodcastTest.jsx'

const router = createBrowserRouter( [
    {
        path: '/',
        element: <RootLayout />,
        children: [
            {
                element: <FeedPage />,
                children: [
                    {
                        index: true,
                        element: <></>,
                    },
                    {
                        path: 'entry/:id',
                        element: <EntryModal />,
                    },
                ],
            },
            {
                path: 'submit',
                element: <SubmitPage />,
            },
            {
                path: 'podcast-test',
                element: <PodcastTest />,
            },
        ],
    },
] )

createRoot( document.getElementById( 'root' ) ).render(
    <StrictMode>
        <EntriesProvider>
            <RouterProvider router={router} />
        </EntriesProvider>
    </StrictMode>,
)
