import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../api/client.js';
import { formatMoney, initials } from '../utils/format.js';

/** Primary storefront navigation. */
export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [term, setTerm] = useState(searchParams.get('q') || '');
  const [categories, setCategories] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    api
      .get('/categories')
      .then((response) => setCategories(response?.data?.items ?? []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setTerm(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    const trimmed = term.trim();
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/products');
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    setMobileOpen(false);
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="navbar__inner container">
        <button
          type="button"
          className="navbar__burger"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <Link to="/" className="navbar__brand">
          <img src="/images/logo.svg" alt="" width="36" height="36" />
          <span>
            Shop<strong>Sphere</strong>
          </span>
        </Link>

        <form className="navbar__search" onSubmit={submitSearch} role="search">
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search for laptops, phones, headphones…"
            aria-label="Search products"
          />
          <button type="submit" aria-label="Search">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M16.5 16.5L21 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </form>

        <nav className={`navbar__links ${mobileOpen ? 'is-open' : ''}`}>
          <NavLink to="/" end className="navbar__link">
            Home
          </NavLink>
          <NavLink to="/products" className="navbar__link">
            Products
          </NavLink>

          <div className="navbar__dropdown">
            <button type="button" className="navbar__link navbar__link--button">
              Categories
              <span aria-hidden="true">▾</span>
            </button>
            <div className="navbar__dropdown-menu">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/categories/${category.id}`}
                  className="navbar__dropdown-item"
                  onClick={() => setMobileOpen(false)}
                >
                  <img src={category.image} alt="" width="28" height="28" />
                  <span>{category.name}</span>
                  <small>{category.productCount}</small>
                </Link>
              ))}
            </div>
          </div>

          {isAuthenticated && (
            <NavLink to="/orders" className="navbar__link">
              Orders
            </NavLink>
          )}
        </nav>

        <div className="navbar__actions">
          <Link to="/wishlist" className="navbar__icon" aria-label="Wishlist" title="Wishlist">
            <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
              <path
                d="M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7 3C19 15.6 12 20 12 20z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </Link>

          <Link to="/cart" className="navbar__icon" aria-label="Cart" title="Cart">
            <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
              <path
                d="M4 5h2l2 10h10l2-7H7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="9.5" cy="19" r="1.6" fill="currentColor" />
              <circle cx="17" cy="19" r="1.6" fill="currentColor" />
            </svg>
            {cart.itemCount > 0 && <span className="navbar__badge">{cart.itemCount}</span>}
          </Link>

          {isAuthenticated ? (
            <div className="navbar__account" ref={menuRef}>
              <button
                type="button"
                className="navbar__avatar"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span>{initials(user.name)}</span>
              </button>

              {menuOpen && (
                <div className="navbar__menu" role="menu">
                  <div className="navbar__menu-header">
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                    <span className="navbar__wallet">{formatMoney(user.walletBalance)}</span>
                  </div>
                  <Link to="/profile" className="navbar__menu-item" onClick={() => setMenuOpen(false)}>
                    My profile
                  </Link>
                  <Link to="/orders" className="navbar__menu-item" onClick={() => setMenuOpen(false)}>
                    My orders
                  </Link>
                  <Link to="/wallet" className="navbar__menu-item" onClick={() => setMenuOpen(false)}>
                    Wallet
                  </Link>
                  <Link to="/wishlist" className="navbar__menu-item" onClick={() => setMenuOpen(false)}>
                    Wishlist
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="navbar__menu-item navbar__menu-item--accent" onClick={() => setMenuOpen(false)}>
                      Admin panel
                    </Link>
                  )}
                  <button type="button" className="navbar__menu-item navbar__menu-item--danger" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="navbar__auth">
              <Link to="/login" className="btn btn--ghost btn--sm">
                Sign in
              </Link>
              <Link to="/register" className="btn btn--primary btn--sm">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
