import { Link } from 'react-router-dom';

/** Friendly placeholder shown when a list has no content. */
export default function EmptyState({
  icon = '📦',
  title = 'Nothing here yet',
  message = '',
  actionLabel = null,
  actionTo = null,
  onAction = null,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {message && <p className="empty-state__message">{message}</p>}
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn btn--primary">
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionTo && (
        <button type="button" className="btn btn--primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
