import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Rating from '../../components/Rating.jsx';
import { TableSkeleton } from '../../components/Loader.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../api/client.js';
import { formatDate, formatNumber, initials } from '../../utils/format.js';

/** Review moderation. */
export default function AdminReviews() {
  const toast = useToast();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    api
      .get('/admin/reviews?limit=200')
      .then((response) => setReviews(response?.data?.items ?? []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (review) => {
    if (!window.confirm('Delete this review permanently?')) return;

    try {
      await api.delete(`/admin/reviews/${review.id}`);
      setReviews((current) => current.filter((entry) => entry.id !== review.id));
      toast.info('Review deleted');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const visible = reviews.filter((review) => {
    if (filter === 'low') return review.rating <= 2;
    if (filter === 'high') return review.rating >= 4;
    return true;
  });

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div>
          <h1>Reviews</h1>
          <p>{formatNumber(reviews.length)} reviews submitted</p>
        </div>
      </header>

      <div className="admin-toolbar">
        <div className="filter-chips filter-chips--inline">
          <button type="button" className={`chip ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
            All
          </button>
          <button type="button" className={`chip ${filter === 'high' ? 'is-active' : ''}`} onClick={() => setFilter('high')}>
            Positive (4–5★)
          </button>
          <button type="button" className={`chip ${filter === 'low' ? 'is-active' : ''}`} onClick={() => setFilter('low')}>
            Critical (1–2★)
          </button>
        </div>
      </div>

      <section className="panel">
        {loading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Customer</th>
                  <th>Rating</th>
                  <th>Review</th>
                  <th>Date</th>
                  <th className="table__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <Link to={`/products/${review.productId}`} className="link-inline">
                        {review.productName}
                      </Link>
                    </td>
                    <td>
                      <div className="table__product">
                        <span className="table__avatar">{initials(review.authorName)}</span>
                        <strong>{review.authorName}</strong>
                      </div>
                    </td>
                    <td>
                      <Rating value={review.rating} showValue={false} />
                    </td>
                    <td className="table__wrap">
                      {review.title && <strong>{review.title}</strong>}
                      <div
                        className="table__excerpt"
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{ __html: review.commentHtml ?? '' }}
                      />
                    </td>
                    <td>{formatDate(review.createdAt)}</td>
                    <td className="table__actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs btn--danger-text"
                        onClick={() => remove(review)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
