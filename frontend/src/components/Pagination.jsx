/**
 * Page selector.
 *
 * Renders a compact window of page numbers with first/last controls so long
 * catalogues stay navigable.
 */
export default function Pagination({ page = 1, totalPages = 1, onChange }) {
  if (totalPages <= 1) return null;

  const windowSize = 2;
  const pages = [];

  const start = Math.max(1, page - windowSize);
  const end = Math.min(totalPages, page + windowSize);

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('…');
  }
  for (let index = start; index <= end; index += 1) pages.push(index);
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('…');
    pages.push(totalPages);
  }

  const go = (target) => {
    if (target < 1 || target > totalPages || target === page) return;
    onChange(target);
  };

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="pagination__button"
        onClick={() => go(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        ‹
      </button>

      {pages.map((entry, index) =>
        entry === '…' ? (
          <span key={`gap-${index}`} className="pagination__gap">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            className={`pagination__button ${entry === page ? 'is-active' : ''}`}
            onClick={() => go(entry)}
            aria-current={entry === page ? 'page' : undefined}
          >
            {entry}
          </button>
        )
      )}

      <button
        type="button"
        className="pagination__button"
        onClick={() => go(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
