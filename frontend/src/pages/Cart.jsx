import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import EmptyState from '../components/EmptyState.jsx';
import { Spinner } from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatMoney, formatNumber } from '../utils/format.js';

/** Shopping cart. Totals come from the server, not from local arithmetic. */
export default function Cart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, updateItem, removeItem, clear, loading } = useCart();
  const toast = useToast();

  const [busyId, setBusyId] = useState(null);

  const changeQuantity = async (item, quantity) => {
    setBusyId(item.id);
    try {
      await updateItem(item.id, quantity);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item) => {
    setBusyId(item.id);
    try {
      await removeItem(item.id);
      toast.info(`${item.name} removed from your cart`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const emptyCart = async () => {
    if (!window.confirm('Remove everything from your cart?')) return;
    try {
      await clear();
      toast.info('Your cart is now empty');
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (!cart.items.length) {
    return (
      <div className="container section">
        <h1 className="page-title">Your cart</h1>
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          message="Browse the catalogue and add something you like."
          actionLabel="Start shopping"
          actionTo="/products"
        />
      </div>
    );
  }

  const remainingForFreeShipping = Math.max(0, cart.freeShippingThreshold - cart.subtotal);

  return (
    <div className="container section">
      <header className="page-head">
        <div>
          <h1>Your cart</h1>
          <p>{formatNumber(cart.itemCount)} item(s) ready to go</p>
        </div>
        <button type="button" className="btn btn--ghost btn--danger-text" onClick={emptyCart}>
          Empty cart
        </button>
      </header>

      <div className="cart-layout">
        <div className="cart-items">
          {cart.items.map((item) => (
            <article key={item.id} className="cart-item">
              <Link to={`/products/${item.productId}`} className="cart-item__image">
                <img src={item.image} alt={item.name} width="160" height="160" />
              </Link>

              <div className="cart-item__details">
                <span className="cart-item__brand">{item.brand}</span>
                <h3>
                  <Link to={`/products/${item.productId}`}>{item.name}</Link>
                </h3>
                <p className="cart-item__unit">{formatMoney(item.unitPrice)} each</p>
                {!item.inStock && <p className="text-danger">Currently out of stock</p>}
                {item.inStock && item.stock <= 5 && (
                  <p className="text-warning">Only {item.stock} left in stock</p>
                )}

                <div className="cart-item__controls">
                  <div className="qty qty--sm">
                    <button
                      type="button"
                      onClick={() => changeQuantity(item, item.quantity - 1)}
                      disabled={item.quantity <= 1 || busyId === item.id}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={item.quantity}
                      onChange={(event) => {
                        const next = Number.parseInt(event.target.value, 10);
                        if (Number.isFinite(next) && next >= 1 && next <= 99) changeQuantity(item, next);
                      }}
                      aria-label={`Quantity for ${item.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => changeQuantity(item, item.quantity + 1)}
                      disabled={item.quantity >= 99 || busyId === item.id}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn btn--ghost btn--xs btn--danger-text"
                    onClick={() => remove(item)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? <Spinner size="sm" /> : 'Remove'}
                  </button>
                </div>
              </div>

              <div className="cart-item__total">{formatMoney(item.lineTotal)}</div>
            </article>
          ))}
        </div>

        <aside className="cart-summary">
          <h2>Order summary</h2>

          <dl className="summary-list">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(cart.subtotal)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{cart.shippingFee === 0 ? <span className="text-success">Free</span> : formatMoney(cart.shippingFee)}</dd>
            </div>
            {cart.discount > 0 && (
              <div>
                <dt>Discount</dt>
                <dd className="text-success">−{formatMoney(cart.discount)}</dd>
              </div>
            )}
            <div className="summary-list__total">
              <dt>Total</dt>
              <dd>{formatMoney(cart.total)}</dd>
            </div>
          </dl>

          {remainingForFreeShipping > 0 && (
            <p className="summary-note">
              Add {formatMoney(remainingForFreeShipping)} more for free delivery.
            </p>
          )}

          <div className="summary-wallet">
            <span>Wallet balance</span>
            <strong>{formatMoney(user?.walletBalance ?? 0)}</strong>
          </div>

          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </button>

          <Link to="/products" className="btn btn--ghost btn--block">
            Continue shopping
          </Link>

          {loading && <p className="summary-note">Updating…</p>}
        </aside>
      </div>
    </div>
  );
}
