import { Link, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { PageLoader } from './Loader.jsx';

/**
 * Gate for administration pages.
 *
 * The check reads the role from the session as reported by the server. It is a
 * convenience only - every administration endpoint performs its own
 * authorization check server-side.
 */
export default function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader message="Checking your session…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (!isAdmin) {
    return (
      <div className="container section">
        <div className="panel panel--centered">
          <h2>Administrator access required</h2>
          <p>Your account does not have permission to view the administration area.</p>
          <Link to="/" className="btn btn--primary">
            Back to the store
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
