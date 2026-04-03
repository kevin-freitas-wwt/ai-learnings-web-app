import SubmitForm from '../components/SubmitForm/SubmitForm.jsx'
import './SubmitPage.css'

function SubmitPage() {
    return (
        <div className="submit-page">
            <h1 className="submit-page__title">Submit a Learning</h1>
            <p className="submit-page__description">
                Share a link that taught you something worth passing on.
            </p>
            <SubmitForm />
        </div>
    )
}

export default SubmitPage
