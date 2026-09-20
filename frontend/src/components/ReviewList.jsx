import Rating from './Rating.jsx';
import EmptyState from './EmptyState.jsx';
import { formatDate, initials } from '../utils/format.js';

/**
 * Customer reviews for a product.
 *
 * The review body is inserted as markup because the API returns it in a
 * presentation-ready form.  See docs/security-testing.md for how the server
 * prepares that value.
 */
export default function ReviewList({ reviews = [], onEdit = null, onDelete = null, currentUserId = null }) {
  if (!reviews.length) {
    return (
      <EmptyState
        icon="✍️"
        title="No reviews yet"
        message="Be the first to share your experience with this product."
      />
    );
  }

  return (
    <ul className="review-list">
      {reviews.map((review) => {
        const isOwn = currentUserId !== null && review.userId === currentUserId;

        return (
          <li key={review.id} className="review">
            <div className="review__avatar" aria-hidden="true">
              {initials(review.authorName)}
            </div>

            <div className="review__body">
              <div className="review__head">
                <div>
                  <strong className="review__author">
                    {review.authorName}
                    {isOwn && <span className="badge badge--neutral review__own">You</span>}
                  </strong>
                  <div className="review__meta">
                    <Rating value={review.rating} showValue={false} size="sm" />
                    <span>{formatDate(review.createdAt)}</span>
                    {review.updatedAt && review.updatedAt !== review.createdAt && <span>· edited</span>}
                  </div>
                </div>

                {isOwn && (onEdit || onDelete) && (
                  <div className="review__actions">
                    {onEdit && (
                      <button type="button" className="btn btn--ghost btn--xs" onClick={() => onEdit(review)}>
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button type="button" className="btn btn--ghost btn--xs btn--danger-text" onClick={() => onDelete(review)}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {review.title && <h4 className="review__title">{review.title}</h4>}

              <div
                className="review__text"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: review.commentHtml ?? '' }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
