import { useEffect, useState } from 'react';

import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

/** Create or edit a review for a product. */
export default function ReviewForm({ productId, existing = null, onSaved, onCancel = null }) {
  const toast = useToast();

  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setRating(existing?.rating ?? 5);
    setTitle(existing?.title ?? '');
    setComment(existing?.comment ?? '');
  }, [existing]);

  const submit = async (event) => {
    event.preventDefault();

    if (!comment.trim()) {
      toast.error('Please write a short review before submitting');
      return;
    }

    setSubmitting(true);
    try {
      if (existing) {
        await api.put(`/reviews/${existing.id}`, { rating, title, comment });
        toast.success('Your review has been updated');
      } else {
        await api.post('/reviews', { productId, rating, title, comment });
        toast.success('Thanks! Your review has been published');
      }
      setTitle('');
      setComment('');
      setRating(5);
      onSaved?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="review-form" onSubmit={submit}>
      <h3 className="review-form__heading">{existing ? 'Edit your review' : 'Write a review'}</h3>

      <div className="field">
        <label htmlFor="review-rating">Your rating</label>
        <div className="star-picker" id="review-rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={`star-picker__star ${star <= rating ? 'is-active' : ''}`}
              onClick={() => setRating(star)}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              aria-pressed={star === rating}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="review-title">Headline</label>
        <input
          id="review-title"
          type="text"
          value={title}
          maxLength={160}
          placeholder="Sum up your experience in a few words"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="review-comment">Your review</label>
        <textarea
          id="review-comment"
          rows={4}
          value={comment}
          maxLength={4000}
          placeholder="What did you like or dislike about this product?"
          onChange={(event) => setComment(event.target.value)}
          required
        />
        <small className="field__hint">{comment.length}/4000 characters</small>
      </div>

      <div className="review-form__actions">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Saving…' : existing ? 'Save changes' : 'Submit review'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
