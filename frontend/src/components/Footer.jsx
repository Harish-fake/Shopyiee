import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client.js';

/** Site footer with shop links, help links and category shortcuts. */
export default function Footer() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api
      .get('/categories')
      .then((response) => setCategories(response?.data?.items ?? []))
      .catch(() => setCategories([]));
  }, []);

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__column footer__column--brand">
          <Link to="/" className="footer__brand">
            <img src="/images/logo.svg" alt="" width="34" height="34" />
            <span>
              Shop<strong>Sphere</strong>
            </span>
          </Link>
          <p>
            Everyday electronics, computing gear and home essentials at prices that make sense. Free delivery on
            orders above ₹5,000.
          </p>
          <div className="footer__social" aria-hidden="true">
            <span>◎</span>
            <span>✦</span>
            <span>✉</span>
          </div>
        </div>

        <div className="footer__column">
          <h4>Shop</h4>
          <ul>
            <li>
              <Link to="/products">All products</Link>
            </li>
            <li>
              <Link to="/products?sort=price-asc">Best value</Link>
            </li>
            <li>
              <Link to="/products?sort=rating-desc">Top rated</Link>
            </li>
            <li>
              <Link to="/wishlist">Wishlist</Link>
            </li>
          </ul>
        </div>

        <div className="footer__column">
          <h4>Categories</h4>
          <ul>
            {categories.slice(0, 5).map((category) => (
              <li key={category.id}>
                <Link to={`/categories/${category.id}`}>{category.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer__column">
          <h4>Your account</h4>
          <ul>
            <li>
              <Link to="/profile">Profile</Link>
            </li>
            <li>
              <Link to="/orders">Order history</Link>
            </li>
            <li>
              <Link to="/wallet">Wallet</Link>
            </li>
            <li>
              <Link to="/cart">Cart</Link>
            </li>
          </ul>
        </div>

        <div className="footer__column">
          <h4>Help</h4>
          <ul>
            <li>
              <Link to="/products">Delivery information</Link>
            </li>
            <li>
              <Link to="/products">Returns policy</Link>
            </li>
            <li>
              <Link to="/products">Contact support</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="container footer__bottom">
        <p>© {new Date().getFullYear()} ShopSphere. A demonstration storefront.</p>
        <p className="footer__note">
          Prices are shown in Indian Rupees. Wallet balances and payments are simulated and stored locally — no real
          payment provider is connected.
        </p>
      </div>
    </footer>
  );
}
