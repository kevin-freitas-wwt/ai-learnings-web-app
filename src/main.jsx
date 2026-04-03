import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import RootLayout from './components/RootLayout/RootLayout.jsx'
import EntryModal from './components/EntryModal/EntryModal.jsx'
import FeedPage from './pages/FeedPage.jsx'
import SubmitPage from './pages/SubmitPage.jsx'

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
        ],
    },
] )

createRoot( document.getElementById( 'root' ) ).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>,
)
