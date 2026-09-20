import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import EmptyState from '../components/EmptyState.jsx';
import { Spinner } from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api/client.js';
import { formatMoney } from '../utils/format.js';

const EMPTY_SHIPPING = {
  name: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
};

/** Checkout: delivery details, order summary and payment from the wallet. */
export default function Checkout() {
  const navigate = useNavigate();
  const { user, syncBalance } = useAuth();
  const { cart, refresh } = useCart();
  const toast = useToast();

  const [shipping, setShipping] = useState(EMPTY_SHIPPING);
  const [totals, setTotals] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [errors, setErrors] = useState({});

  // Pre-fill the delivery form from the saved profile.
  useEffect(() => {
    if (!user) return;
    setShipping({
      name: user.name ?? '',
      phone: user.phone ?? '',
      address: user.address ?? '',
      city: user.city ?? '',
      state: user.state ?? '',
      postalCode: user.postalCode ?? '',
    });
  }, [user]);

  // Ask the server for authoritative totals for the current cart.
  useEffect(() => {
    if (!cart.items.length) {
      setTotals(null);
      return;
    }

    api
      .post('/checkout/preview', {})
      .then((response) => setTotals(response?.data ?? null))
      .catch(() => setTotals(null));
  }, [cart.items.length, cart.total]);

  const update = (field) => (event) => {
    setShipping((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!shipping.name.trim() || shipping.name.trim().length < 2) next.name = 'Please enter the recipient name';
    if (!shipping.phone.trim() || shipping.phone.trim().length < 6) next.phone = 'Please enter a contact number';
    if (!shipping.address.trim() || shipping.address.trim().length < 4) next.address = 'Please enter the street address';
    if (!shipping.city.trim()) next.city = 'Please enter the city';
    if (!shipping.state.trim()) next.state = 'Please enter the state';
    if (!shipping.postalCode.trim()) next.postalCode = 'Please enter the postal code';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    if (!validate()) {
      toast.error('Please complete the delivery details');
      return;
    }

    setPlacing(true);
    try {
      // The order summary shown above is sent along with the request, exactly as
      // an ordinary storefront would. What the server does with those figures is
      // covered in docs/security-testing.md.
      const payload = {
        items: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.unitPrice,
        })),
        total: totals?.total ?? cart.total,
        shippingFee: totals?.shippingFee ?? cart.shippingFee,
        shipping,
      };

      const response = await api.post('/checkout', payload);
      const order = response?.data?.order;

      await Promise.all([refresh(), syncBalance()]);

      toast.success(`Order ${order.orderNumber} placed successfully`);
      navigate(`/orders/${order.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPlacing(false);
    }
  };

  if (!cart.items.length) {
    return (
      <div className="container section">
        <h1 className="page-title">Checkout</h1>
        <EmptyState
          icon="🧾"
          title="Nothing to check out"
          message="Add a few products to your cart first."
          actionLabel="Browse products"
          actionTo="/products"
        />
      </div>
    );
  }

  const balance = Number(user?.walletBalance ?? 0);
  const total = totals?.total ?? cart.total;
  const shortfall = Math.max(0, total - balance);

  return (
    <div className="container section">
      <header className="page-head">
        <div>
          <h1>Checkout</h1>
          <p>Confirm your delivery details and pay from your wallet</p>
        </div>
      </header>

      <form className="checkout-layout" onSubmit={placeOrder}>
        <div className="checkout-main">
          <section className="panel">
            <h2>Delivery details</h2>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="ship-name">Full name</label>
                <input id="ship-name" type="text" value={shipping.name} onChange={update('name')} maxLength={120} />
                {errors.name && <small className="field__error">{errors.name}</small>}
              </div>

              <div className="field">
                <label htmlFor="ship-phone">Phone number</label>
                <input id="ship-phone" type="tel" value={shipping.phone} onChange={update('phone')} maxLength={30} />
                {errors.phone && <small className="field__error">{errors.phone}</small>}
              </div>

              <div className="field field--full">
                <label htmlFor="ship-address">Street address</label>
                <input
                  id="ship-address"
                  type="text"
                  value={shipping.address}
                  onChange={update('address')}
                  maxLength={255}
                />
                {errors.address && <small className="field__error">{errors.address}</small>}
              </div>

              <div className="field">
                <label htmlFor="ship-city">City</label>
                <input id="ship-city" type="text" value={shipping.city} onChange={update('city')} maxLength={80} />
                {errors.city && <small className="field__error">{errors.city}</small>}
              </div>

              <div className="field">
                <label htmlFor="ship-state">State</label>
                <input id="ship-state" type="text" value={shipping.state} onChange={update('state')} maxLength={80} />
                {errors.state && <small className="field__error">{errors.state}</small>}
              </div>

              <div className="field">
                <label htmlFor="ship-postal">Postal code</label>
                <input
                  id="ship-postal"
                  type="text"
                  value={shipping.postalCode}
                  onChange={update('postalCode')}
                  maxLength={20}
                />
                {errors.postalCode && <small className="field__error">{errors.postalCode}</small>}
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Review your items</h2>
            <ul className="checkout-items">
              {cart.items.map((item) => (
                <li key={item.id}>
                  <img src={item.image} alt="" width="72" height="72" />
                  <div className="checkout-items__info">
                    <strong>{item.name}</strong>
                    <span>
                      {formatMoney(item.unitPrice)} × {item.quantity}
                    </span>
                  </div>
                  <span className="checkout-items__total">{formatMoney(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="checkout-summary">
          <h2>Payment</h2>

          <div className="wallet-card">
            <span className="wallet-card__label">ShopSphere wallet</span>
            <strong className="wallet-card__balance">{formatMoney(balance)}</strong>
            <small>Simulated store credit — no card required</small>
          </div>

          <dl className="summary-list">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(totals?.subtotal ?? cart.subtotal)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>
                {(totals?.shippingFee ?? cart.shippingFee) === 0
                  ? <span className="text-success">Free</span>
                  : formatMoney(totals?.shippingFee ?? cart.shippingFee)}
              </dd>
            </div>
            <div className="summary-list__total">
              <dt>Total to pay</dt>
              <dd>{formatMoney(total)}</dd>
            </div>
            <div>
              <dt>Balance after payment</dt>
              <dd>{formatMoney(Math.max(0, balance - total))}</dd>
            </div>
          </dl>

          {shortfall > 0 && (
            <p className="notice notice--warning">
              Your wallet is short by {formatMoney(shortfall)}. <Link to="/wallet">Top up your wallet</Link> to
              continue.
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={placing || shortfall > 0}>
            {placing ? <Spinner size="sm" /> : `Place order · ${formatMoney(total)}`}
          </button>

          <Link to="/cart" className="btn btn--ghost btn--block">
            Back to cart
          </Link>

          <p className="summary-note">
            By placing this order you agree to the demonstration terms of service. No real payment is processed.
          </p>
        </aside>
      </form>
    </div>
  );
}
