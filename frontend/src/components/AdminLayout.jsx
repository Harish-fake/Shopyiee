import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { initials } from '../utils/format.js';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: '▤', end: true },
  { to: '/admin/products', label: 'Products', icon: '▦' },
  { to: '/admin/orders', label: 'Orders', icon: '❐' },
  { to: '/admin/users', label: 'Customers', icon: '☺' },
  { to: '/admin/reviews', label: 'Reviews', icon: '★' },
];

/** Administration shell with a persistent sidebar. */
export default function AdminLayout() {
  const { user } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <img src="/images/logo.svg" alt="" width="30" height="30" />
          <div>
            <strong>ShopSphere</strong>
            <small>Administration</small>
          </div>
        </div>

        <nav className="admin-sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'is-active' : ''}`}
            >
              <span className="admin-nav-item__icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__user">
            <span className="admin-sidebar__avatar">{initials(user?.name)}</span>
            <div>
              <strong>{user?.name}</strong>
              <small>Administrator</small>
            </div>
          </div>
          <NavLink to="/" className="admin-nav-item admin-nav-item--muted">
            <span className="admin-nav-item__icon" aria-hidden="true">
              ↩
            </span>
            Back to store
          </NavLink>
        </div>
      </aside>

      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
