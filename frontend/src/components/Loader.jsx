/** Spinner, page-level loader and product-card skeletons. */

export function Spinner({ size = 'md', label = 'Loading' }) {
  return (
    <span className={`spinner spinner--${size}`} role="status" aria-label={label}>
      <span className="spinner__ring" />
    </span>
  );
}

export function PageLoader({ message = 'Loading…' }) {
  return (
    <div className="page-loader">
      <Spinner size="lg" />
      <p>{message}</p>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-card">
          <div className="skeleton skeleton--image" />
          <div className="skeleton skeleton--line" style={{ width: '80%' }} />
          <div className="skeleton skeleton--line" style={{ width: '55%' }} />
          <div className="skeleton skeleton--line" style={{ width: '35%' }} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }) {
  return (
    <div className="table-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="table-skeleton__row">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <div key={columnIndex} className="skeleton skeleton--line" />
          ))}
        </div>
      ))}
    </div>
  );
}
