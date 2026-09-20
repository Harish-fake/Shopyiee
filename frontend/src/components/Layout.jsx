import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

/** Public storefront shell: header, routed content, footer. */
export default function Layout() {
  const { pathname, search } = useLocation();

  // Return to the top of the page whenever the route changes.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, search]);

  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
