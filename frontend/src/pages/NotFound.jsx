import { Link } from 'react-router-dom';

/** 404 page for unknown routes. */
export default function NotFound() {
  return (
    <div className="container section">
      <div className="not-found">
        <span className="not-found__code">404</span>
        <h1>We could not find that page</h1>
        <p>The link may be broken or the page may have been moved.</p>
        <div className="not-found__actions">
          <Link to="/" className="btn btn--primary btn--lg">
            Back to home
          </Link>
          <Link to="/products" className="btn btn--outline btn--lg">
            Browse products
          </Link>
        </div>
      </div>
    </div>
  );
}
