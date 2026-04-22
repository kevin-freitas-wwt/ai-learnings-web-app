import './SkeletonCard.css'

function SkeletonCard( { showImage, delay = 0 } ) {
    return (
        <div className="skeleton-card" style={{ '--skeleton-delay': `${delay}s` }}>
            {showImage && <div className="skeleton-card__image" />}
            <div className="skeleton-card__title" />
            <div className="skeleton-card__title skeleton-card__title--short" />
            <div className="skeleton-card__bullets">
                <div className="skeleton-card__bullet" />
                <div className="skeleton-card__bullet skeleton-card__bullet--short" />
            </div>
            <div className="skeleton-card__footer">
                <div className="skeleton-card__favicon" />
                <div className="skeleton-card__domain" />
            </div>
        </div>
    )
}

export default SkeletonCard
