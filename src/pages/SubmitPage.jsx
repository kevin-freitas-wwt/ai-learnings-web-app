import { useLocation, useNavigate } from 'react-router-dom'
import SubmitForm from '../components/SubmitForm/SubmitForm.jsx'
import './SubmitPage.css'

function SubmitPage() {
    const { state } = useLocation()
    const navigate = useNavigate()
    const back = `/${state?.back || ''}`

    return (
        <div className="submit-page">
            <div className="submit-page__header">
                <div>
                    <h1 className="submit-page__title">Submit a Learning</h1>
                    <p className="submit-page__description">
                        Share a link that taught you something worth passing on.
                    </p>
                </div>
                <button
                    className="submit-page__close"
                    onClick={() => navigate( back )}
                    aria-label="Close"
                >✕</button>
            </div>
            <SubmitForm back={back} />
        </div>
    )
}

export default SubmitPage
