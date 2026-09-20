import { useState } from 'react';
import { Link } from 'react-router-dom';

import Rating from './Rating.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api/client.js';
import { formatMoney } from '../utils/format.js';

/** Catalogue tile with add-to-cart and wishlist actions. */
export default function ProductCard({ product, saved = false, onWishlistChange = null }) {
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [isSaved, setIsSaved] = useState(saved);

  const handleAddToCart = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      toast.info('Please sign in to add items to your cart');
      return;
    }

    setBusy(true);
    try {
      await addItem(product.id, 1);
      toast.success(`${product.name} added to your cart`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleWishlist = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      toast.info('Please sign in to save items');
      return;
    }

    try {
      if (isSaved) {
        await api.delete(`/wishlist/${product.id}`);
        setIsSaved(false);
        toast.info('Removed from your wishlist');
      } else {
        await api.post('/wishlist', { productId: product.id });
        setIsSaved(true);
        toast.success('Saved to your wishlist');
      }
      onWishlistChange?.();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const outOfStock = !product.inStock;

  return (
    <article className="product-card">
      <Link to={`/products/${product.id}`} className="product-card__media">
        <img src={product.image} alt={product.name} loading="lazy" width="800" height="800" />
        {product.discountPercent > 0 && (
          <span className="badge badge--danger product-card__discount">-{product.discountPercent}%</span>
        )}
        {outOfStock && <span className="product-card__out">Out of stock</span>}

        <button
          type="button"
          className={`product-card__wish ${isSaved ? 'is-saved' : ''}`}
          onClick={handleWishlist}
          aria-label={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
          title={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          {isSaved ? '♥' : '♡'}
        </button>
      </Link>

      <div className="product-card__body">
        <span className="product-card__brand">{product.brand}</span>

        <h3 className="product-card__title">
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>

        <Rating value={product.rating} count={product.reviewCount} />

        <div className="product-card__price">
          <span className="price">{formatMoney(product.price)}</span>
          {product.originalPrice > product.price && (
            <span className="price price--strike">{formatMoney(product.originalPrice)}</span>
          )}
        </div>

        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={handleAddToCart}
          disabled={busy || outOfStock}
        >
          {outOfStock ? 'Out of stock' : busy ? 'Adding…' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}
