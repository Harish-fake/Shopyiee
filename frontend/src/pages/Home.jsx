import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import ProductCard from '../components/ProductCard.jsx';
import { ProductGridSkeleton } from '../components/Loader.jsx';
import { api } from '../api/client.js';
import { formatNumber } from '../utils/format.js';

const PERKS = [
  { icon: '🚚', title: 'Free delivery', text: 'On every order above ₹5,000' },
  { icon: '↩️', title: '7-day returns', text: 'Changed your mind? Send it back' },
  { icon: '🛡️', title: '2-year warranty', text: 'On all electronics and appliances' },
  { icon: '💬', title: 'Real support', text: 'Help from people, seven days a week' },
];

/** Landing page: hero, categories, featured and newest products. */
export default function Home() {
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [demoUsers, setDemoUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get('/categories'),
      api.get('/products/featured?limit=8'),
      api.get('/products/new-arrivals?limit=8'),
      api.get('/products/top-rated?limit=4'),
    ])
      .then(([categoriesResponse, featuredResponse, arrivalsResponse, ratedResponse]) => {
        if (cancelled) return;
        setCategories(categoriesResponse?.data?.items ?? []);
        setFeatured(featuredResponse?.data?.items ?? []);
        setNewArrivals(arrivalsResponse?.data?.items ?? []);
        setTopRated(ratedResponse?.data?.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * INTENTIONALLY VULNERABLE: the storefront calls the unauthenticated
   * GET /users endpoint and renders the plaintext demo credentials it returns.
   * This is here to demonstrate sensitive-information exposure.
   */
  useEffect(() => {
    let cancelled = false;

    api
      .get('/users')
      .then((response) => {
        if (!cancelled) setDemoUsers(response?.data?.users ?? []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home">
      {/* Hero ---------------------------------------------------------------- */}
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__content">
            <span className="hero__eyebrow">Season sale · up to 25% off</span>
            <h1 className="hero__title">
              Everything you need,
              <br />
              delivered to your door
            </h1>
            <p className="hero__text">
              Laptops, smartphones, gaming gear, home appliances and everyday essentials — all in one place, with
              free delivery over ₹5,000.
            </p>
            <div className="hero__actions">
              <Link to="/products" className="btn btn--primary btn--lg">
                Start shopping
              </Link>
              <Link to="/products?sort=rating-desc" className="btn btn--outline-light btn--lg">
                Top rated picks
              </Link>
            </div>
            <dl className="hero__stats">
              <div>
                <dt>Products</dt>
                <dd>45+</dd>
              </div>
              <div>
                <dt>Categories</dt>
                <dd>7</dd>
              </div>
              <div>
                <dt>Happy customers</dt>
                <dd>12k+</dd>
              </div>
            </dl>
          </div>

          <div className="hero__art" aria-hidden="true">
            <img src="/images/hero.jpg" alt="" width="1200" height="520" />
          </div>
        </div>
      </section>

      {/* Perks --------------------------------------------------------------- */}
      <section className="container perks">
        {PERKS.map((perk) => (
          <div key={perk.title} className="perk">
            <span className="perk__icon" aria-hidden="true">
              {perk.icon}
            </span>
            <div>
              <strong>{perk.title}</strong>
              <p>{perk.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Categories ---------------------------------------------------------- */}
      <section className="container section">
        <header className="section__head">
          <div>
            <h2>Shop by category</h2>
            <p>Find exactly what you are looking for</p>
          </div>
          <Link to="/products" className="link-arrow">
            Browse everything →
          </Link>
        </header>

        <div className="category-grid">
          {categories.map((category) => (
            <Link key={category.id} to={`/categories/${category.id}`} className="category-card">
              <img src={category.image} alt="" width="600" height="600" loading="lazy" />
              <div className="category-card__body">
                <strong>{category.name}</strong>
                <small>{formatNumber(category.productCount)} products</small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured ------------------------------------------------------------ */}
      <section className="container section">
        <header className="section__head">
          <div>
            <h2>Featured this week</h2>
            <p>Hand-picked products our customers love</p>
          </div>
          <Link to="/products" className="link-arrow">
            View all →
          </Link>
        </header>

        {loading ? <ProductGridSkeleton count={8} /> : (
          <div className="product-grid">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* New arrivals -------------------------------------------------------- */}
      <section className="container section">
        <header className="section__head">
          <div>
            <h2>New arrivals</h2>
            <p>Fresh stock added to the catalogue</p>
          </div>
          <Link to="/products?sort=newest" className="link-arrow">
            View all →
          </Link>
        </header>

        {loading ? <ProductGridSkeleton count={4} /> : (
          <div className="product-grid product-grid--4">
            {newArrivals.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Top rated ----------------------------------------------------------- */}
      {topRated.length > 0 && (
        <section className="container section">
          <header className="section__head">
            <div>
              <h2>Top rated by customers</h2>
              <p>The highest scoring products in the store</p>
            </div>
            <Link to="/products?sort=rating-desc" className="link-arrow">
              View all →
            </Link>
          </header>

          <div className="product-grid product-grid--4">
            {topRated.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Exposed credentials endpoint --------------------------------------- */}
      <section className="container section">
        <div className="credentials-panel">
          <header className="section__head">
            <div>
              <h2>Exposed credentials endpoint</h2>
              <p>
                This deliberately vulnerable build serves plaintext demo passwords from{' '}
                <a href="/users" target="_blank" rel="noreferrer">
                  <code>GET /users</code>
                </a>{' '}
                with no authentication. Anyone can read working credentials for every account.
              </p>
            </div>
            <a href="/users" target="_blank" rel="noreferrer" className="link-arrow">
              Open /users →
            </a>
          </header>

          {demoUsers.length > 0 ? (
            <div className="credentials-table-wrap">
              <table className="credentials-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Password</th>
                  </tr>
                </thead>
                <tbody>
                  {demoUsers.map((user) => (
                    <tr key={user.email}>
                      <td>
                        <span className={`badge ${user.role === 'ADMIN' ? 'badge--accent' : 'badge--neutral'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <code>{user.email}</code>
                      </td>
                      <td>
                        <code>{user.password}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="credentials-panel__empty">Loading credentials from /users…</p>
          )}
        </div>
      </section>

      {/* Wallet callout ------------------------------------------------------ */}
      <section className="container section">
        <div className="callout">
          <div>
            <h3>Your ShopSphere wallet</h3>
            <p>
              Every account starts with ₹10,000 in store credit. Top up any time and check out in a single step — no
              card details required.
            </p>
          </div>
          <Link to="/wallet" className="btn btn--primary btn--lg">
            Open my wallet
          </Link>
        </div>
      </section>
    </div>
  );
}
