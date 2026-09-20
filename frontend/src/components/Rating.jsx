import { formatNumber } from '../utils/format.js';

/** Star rating with an optional review count. */
export default function Rating({ value = 0, count = null, size = 'sm', showValue = true }) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  const percentage = (rating / 5) * 100;

  return (
    <span className={`rating rating--${size}`} title={`${rating.toFixed(1)} out of 5`}>
      <span className="rating__stars" aria-hidden="true">
        <span className="rating__track">★★★★★</span>
        <span className="rating__fill" style={{ width: `${percentage}%` }}>
          ★★★★★
        </span>
      </span>
      {showValue && <span className="rating__value">{rating.toFixed(1)}</span>}
      {count !== null && count !== undefined && (
        <span className="rating__count">({formatNumber(count)})</span>
      )}
      <span className="visually-hidden">{`Rated ${rating.toFixed(1)} out of 5`}</span>
    </span>
  );
}
