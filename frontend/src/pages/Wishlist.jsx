import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import EmptyState from '../components/EmptyState.jsx';
import Rating from '../components/Rating.jsx';
import { PageLoader, Spinner } from '../components/Loader.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api/client.js';
import { formatMoney } from '../utils/format.js';

/** Saved products with quick actions. */
export default function Wishlist() {
  const { refresh } = useCart();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .get('/wishlist')
      .then((response) => setItems(response?.data?.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (item) => {
    setBusyId(item.productId);
    try {
      await api.delete(`/wishlist/${item.productId}`);
      setItems((current) => current.filter((entry) => entry.productId !== item.productId));
      toast.info(`${item.name} removed from your wishlist`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const moveToCart = async (item) => {
    setBusyId(item.productId);
    try {
      await api.post(`/wishlist/${item.productId}/move-to-cart`, { quantity: 1 });
      await refresh();
      setItems((current) => current.filter((entry) => entry.productId !== item.productId));
      toast.success(`${item.name} moved to your cart`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PageLoader message="Loading your wishlist…" />;

  return (
    <div className="container section">
      <header className="page-head">
        <div>
          <h1>My wishlist</h1>
          <p>{items.length} saved product{items.length === 1 ? '' : 's'}</p>
        </div>
        {items.length > 0 && (
          <Link to="/products" className="btn btn--ghost">
            Continue shopping
          </Link>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon="♡"
          title="Your wishlist is empty"
          message="Tap the heart on any product to save it for later."
          actionLabel="Browse products"
          actionTo="/products"
        />
      ) : (
        <ul className="wishlist">
          {items.map((item) => (
            <li key={item.id} className="wishlist__item">
              <Link to={`/products/${item.productId}`} className="wishlist__image">
                <img src={item.image} alt={item.name} width="200" height="200" />
              </Link>

              <div className="wishlist__info">
                <span className="wishlist__brand">{item.brand}</span>
                <h3>
                  <Link to={`/products/${item.productId}`}>{item.name}</Link>
                </h3>
                <Rating value={item.rating} count={item.reviewCount} />

                <div className="wishlist__price">
                  <span className="price">{formatMoney(item.price)}</span>
                  {item.originalPrice > item.price && (
                    <span className="price price--strike">{formatMoney(item.originalPrice)}</span>
                  )}
                </div>

                <p className={item.inStock ? 'text-success' : 'text-danger'}>
                  {item.inStock ? 'In stock' : 'Out of stock'}
                </p>

                <div className="wishlist__actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => moveToCart(item)}
                    disabled={!item.inStock || busyId === item.productId}
                  >
                    {busyId === item.productId ? <Spinner size="sm" /> : 'Move to cart'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--danger-text"
                    onClick={() => remove(item)}
                    disabled={busyId === item.productId}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
