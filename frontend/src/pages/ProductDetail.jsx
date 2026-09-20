import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import Rating from '../components/Rating.jsx';
import ProductCard from '../components/ProductCard.jsx';
import ReviewList from '../components/ReviewList.jsx';
import ReviewForm from '../components/ReviewForm.jsx';
import { PageLoader, Spinner } from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api/client.js';
import { formatMoney, formatNumber } from '../utils/format.js';

/** Product page with reviews and related items. */
export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { user, isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const toast = useToast();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);

    api
      .get(`/products/${id}`)
      .then((response) => {
        setProduct(response?.data?.product ?? null);
        setReviews(response?.data?.reviews ?? []);
        setRelated(response?.data?.related ?? []);
      })
      .catch((apiError) => setError(apiError.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    setQuantity(1);
    setShowForm(false);
    setEditingReview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSaved(false);
      return;
    }
    api
      .get('/wishlist')
      .then((response) => {
        const items = response?.data?.items ?? [];
        setSaved(items.some((item) => String(item.productId) === String(id)));
      })
      .catch(() => setSaved(false));
  }, [id, isAuthenticated]);

  const handleAddToCart = async (redirect = false) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/products/${id}` } });
      return;
    }

    setAdding(true);
    try {
      await addItem(product.id, quantity);
      toast.success(`${product.name} added to your cart`);
      if (redirect) navigate('/checkout');
    } catch (apiError) {
      toast.error(apiError.message);
    } finally {
      setAdding(false);
    }
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/products/${id}` } });
      return;
    }

    try {
      if (saved) {
        await api.delete(`/wishlist/${product.id}`);
        setSaved(false);
        toast.info('Removed from your wishlist');
      } else {
        await api.post('/wishlist', { productId: product.id });
        setSaved(true);
        toast.success('Saved to your wishlist');
      }
    } catch (apiError) {
      toast.error(apiError.message);
    }
  };

  const handleDeleteReview = async (review) => {
    if (!window.confirm('Delete this review? This cannot be undone.')) return;

    try {
      await api.delete(`/reviews/${review.id}`);
      toast.info('Your review has been deleted');
      load();
    } catch (apiError) {
      toast.error(apiError.message);
    }
  };

  if (loading) return <PageLoader message="Loading product…" />;

  if (error || !product) {
    return (
      <div className="container section">
        <EmptyState
          icon="🔎"
          title="Product not found"
          message="This product may have been removed or the link may be incorrect."
          actionLabel="Browse all products"
          actionTo="/products"
        />
      </div>
    );
  }

  const myReview = user ? reviews.find((review) => review.userId === user.id) : null;
  const canReview = Boolean(user) && !myReview;

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to={`/categories/${product.categoryId}`}>{product.categoryName}</Link>
        <span>/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail">
        <div className="product-detail__gallery">
          <img src={product.image} alt={product.name} width="800" height="800" />
          {product.discountPercent > 0 && (
            <span className="badge badge--danger product-detail__discount">-{product.discountPercent}% off</span>
          )}
        </div>

        <div className="product-detail__info">
          <span className="product-detail__brand">{product.brand}</span>
          <h1>{product.name}</h1>

          <div className="product-detail__meta">
            <Rating value={product.rating} count={product.reviewCount} size="md" />
            <span className="product-detail__sku">Product ID: {product.id}</span>
          </div>

          <div className="product-detail__price">
            <span className="price price--xl">{formatMoney(product.price)}</span>
            {product.originalPrice > product.price && (
              <>
                <span className="price price--strike">{formatMoney(product.originalPrice)}</span>
                <span className="badge badge--success">Save {formatMoney(product.originalPrice - product.price)}</span>
              </>
            )}
          </div>

          <p className="product-detail__description">{product.description}</p>

          <ul className="product-detail__facts">
            <li>
              <span>Availability</span>
              <strong className={product.inStock ? 'text-success' : 'text-danger'}>
                {product.inStock ? `${formatNumber(product.stock)} in stock` : 'Out of stock'}
              </strong>
            </li>
            <li>
              <span>Category</span>
              <strong>{product.categoryName}</strong>
            </li>
            <li>
              <span>Delivery</span>
              <strong>2–4 business days</strong>
            </li>
            <li>
              <span>Returns</span>
              <strong>7 days, no questions asked</strong>
            </li>
          </ul>

          <div className="product-detail__buy">
            <div className="qty">
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max="99"
                value={quantity}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  setQuantity(Number.isFinite(next) ? Math.min(99, Math.max(1, next)) : 1);
                }}
                aria-label="Quantity"
              />
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.min(99, value + 1))}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <button
              type="button"
              className="btn btn--outline btn--lg"
              onClick={() => handleAddToCart(false)}
              disabled={adding || !product.inStock}
            >
              {adding ? <Spinner size="sm" /> : 'Add to cart'}
            </button>

            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => handleAddToCart(true)}
              disabled={adding || !product.inStock}
            >
              Buy now
            </button>

            <button
              type="button"
              className={`btn btn--ghost btn--lg product-detail__wish ${saved ? 'is-saved' : ''}`}
              onClick={handleWishlist}
              aria-pressed={saved}
            >
              {saved ? '♥ Saved' : '♡ Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Reviews -------------------------------------------------------------- */}
      <section className="section product-reviews" id="reviews">
        <header className="section__head">
          <div>
            <h2>Customer reviews</h2>
            <p>
              {product.reviewCount > 0
                ? `${formatNumber(product.reviewCount)} review${product.reviewCount === 1 ? '' : 's'} · average ${product.rating.toFixed(1)} out of 5`
                : 'No reviews yet'}
            </p>
          </div>
          {canReview && (
            <button type="button" className="btn btn--primary" onClick={() => setShowForm((open) => !open)}>
              {showForm ? 'Close' : 'Write a review'}
            </button>
          )}
        </header>

        {!isAuthenticated && (
          <p className="notice">
            <Link to="/login">Sign in</Link> to write a review.
          </p>
        )}

        {(showForm || editingReview) && (
          <ReviewForm
            productId={product.id}
            existing={editingReview}
            onSaved={() => {
              setShowForm(false);
              setEditingReview(null);
              load();
            }}
            onCancel={() => {
              setShowForm(false);
              setEditingReview(null);
            }}
          />
        )}

        <ReviewList
          reviews={reviews}
          currentUserId={user?.id ?? null}
          onEdit={(review) => {
            setEditingReview(review);
            setShowForm(false);
            window.scrollTo({ top: document.getElementById('reviews')?.offsetTop ?? 0, behavior: 'smooth' });
          }}
          onDelete={handleDeleteReview}
        />
      </section>

      {/* Related -------------------------------------------------------------- */}
      {related.length > 0 && (
        <section className="section">
          <header className="section__head">
            <div>
              <h2>You may also like</h2>
              <p>More from {product.categoryName}</p>
            </div>
            <Link to={`/categories/${product.categoryId}`} className="link-arrow">
              View category →
            </Link>
          </header>

          <div className="product-grid product-grid--4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
