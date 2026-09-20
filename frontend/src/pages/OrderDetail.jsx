import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import EmptyState from '../components/EmptyState.jsx';
import { PageLoader, Spinner } from '../components/Loader.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api/client.js';
import { ORDER_STATUSES, formatDateTime, formatMoney, titleCase } from '../utils/format.js';

/** Single order with its line items, delivery details and status timeline. */
export default function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);

    api
      .get(`/orders/${id}`)
      .then((response) => setOrder(response?.data?.order ?? null))
      .catch((apiError) => setError(apiError.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cancelOrder = async () => {
    if (!window.confirm('Cancel this order? Any payment will be refunded to your wallet.')) return;

    setCancelling(true);
    try {
      await api.post(`/orders/${id}/cancel`);
      toast.success('Your order has been cancelled and refunded');
      load();
    } catch (apiError) {
      toast.error(apiError.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <PageLoader message="Loading order…" />;

  if (error || !order) {
    return (
      <div className="container section">
        <EmptyState
          icon="🧾"
          title="Order not found"
          message="We could not find an order with that reference."
          actionLabel="Back to my orders"
          actionTo="/orders"
        />
      </div>
    );
  }

  const currentStep = ORDER_STATUSES.indexOf(order.status);
  const canCancel = ['PENDING', 'PROCESSING'].includes(order.status);

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/orders">My orders</Link>
        <span>/</span>
        <span aria-current="page">{order.orderNumber}</span>
      </nav>

      <header className="page-head">
        <div>
          <h1>Order {order.orderNumber}</h1>
          <p>Placed on {formatDateTime(order.createdAt)}</p>
        </div>
        <span className={`status status--${order.status.toLowerCase()}`}>{titleCase(order.status)}</span>
      </header>

      {order.status !== 'CANCELLED' && (
        <ol className="timeline">
          {ORDER_STATUSES.slice(0, 4).map((step, index) => (
            <li key={step} className={`timeline__step ${index <= currentStep ? 'is-done' : ''}`}>
              <span className="timeline__dot" />
              <span className="timeline__label">{titleCase(step)}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="order-detail-layout">
        <section className="panel">
          <h2>Items in this order</h2>

          <ul className="order-lines">
            {order.items.map((item) => (
              <li key={item.id}>
                <img src={item.productImage} alt="" width="72" height="72" />
                <div className="order-lines__info">
                  {item.productId ? (
                    <Link to={`/products/${item.productId}`}>{item.productName}</Link>
                  ) : (
                    <span>{item.productName}</span>
                  )}
                  <span className="order-lines__unit">
                    {formatMoney(item.unitPrice)} × {item.quantity}
                  </span>
                </div>
                <span className="order-lines__total">{formatMoney(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="summary-list summary-list--right">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(order.subtotal)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{order.shippingFee === 0 ? <span className="text-success">Free</span> : formatMoney(order.shippingFee)}</dd>
            </div>
            {order.discount > 0 && (
              <div>
                <dt>Discount</dt>
                <dd className="text-success">−{formatMoney(order.discount)}</dd>
              </div>
            )}
            <div className="summary-list__total">
              <dt>Total</dt>
              <dd>{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>

        <aside className="order-side">
          <div className="panel">
            <h2>Delivery address</h2>
            <address className="address-block">
              <strong>{order.shipping.name}</strong>
              <span>{order.shipping.address}</span>
              <span>
                {order.shipping.city}, {order.shipping.state} {order.shipping.postalCode}
              </span>
              <span>{order.shipping.phone}</span>
            </address>
          </div>

          <div className="panel">
            <h2>Payment</h2>
            <dl className="kv">
              <div>
                <dt>Method</dt>
                <dd>ShopSphere wallet</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`pay pay--${order.paymentStatus.toLowerCase()}`}>
                    {titleCase(order.paymentStatus)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{formatMoney(order.total)}</dd>
              </div>
            </dl>
          </div>

          <div className="panel">
            <h2>Need help?</h2>
            <p className="panel__intro">
              Questions about this order? Quote reference <strong>{order.orderNumber}</strong> when you contact
              support.
            </p>
            {canCancel && (
              <button type="button" className="btn btn--outline btn--danger-text btn--block" onClick={cancelOrder} disabled={cancelling}>
                {cancelling ? <Spinner size="sm" /> : 'Cancel order'}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
