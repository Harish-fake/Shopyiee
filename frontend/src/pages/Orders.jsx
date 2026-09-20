import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import { PageLoader } from '../components/Loader.jsx';
import { api } from '../api/client.js';
import { ORDER_STATUSES, formatDate, formatMoney, titleCase } from '../utils/format.js';

/** Order history for the signed-in account. */
export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') || 1);
  const status = searchParams.get('status') || '';

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ page: String(page), limit: '10' });
    if (status) params.set('status', status);

    api
      .get(`/orders?${params.toString()}`)
      .then((response) => {
        if (cancelled) return;
        setOrders(response?.data?.items ?? []);
        setPagination(response?.data?.pagination ?? { page: 1, total: 0, totalPages: 1 });
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, status]);

  const setFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('status', value);
    else next.delete('status');
    next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="container section">
      <header className="page-head">
        <div>
          <h1>My orders</h1>
          <p>Track and review everything you have purchased</p>
        </div>
      </header>

      <div className="filter-chips">
        <button type="button" className={`chip ${!status ? 'is-active' : ''}`} onClick={() => setFilter('')}>
          All
        </button>
        {ORDER_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip ${status === value ? 'is-active' : ''}`}
            onClick={() => setFilter(value)}
          >
            {titleCase(value)}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader message="Loading your orders…" />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No orders yet"
          message="When you place an order it will appear here."
          actionLabel="Start shopping"
          actionTo="/products"
        />
      ) : (
        <>
          <ul className="order-list">
            {orders.map((order) => (
              <li key={order.id} className="order-card">
                <div className="order-card__head">
                  <div>
                    <Link to={`/orders/${order.id}`} className="order-card__number">
                      {order.orderNumber}
                    </Link>
                    <span className="order-card__date">Placed on {formatDate(order.createdAt)}</span>
                  </div>
                  <span className={`status status--${order.status.toLowerCase()}`}>{titleCase(order.status)}</span>
                </div>

                <div className="order-card__body">
                  <div className="order-card__thumbs">
                    {order.items.slice(0, 4).map((item) => (
                      <img key={item.id} src={item.productImage} alt={item.productName} width="56" height="56" />
                    ))}
                    {order.items.length > 4 && <span className="order-card__more">+{order.items.length - 4}</span>}
                  </div>

                  <div className="order-card__meta">
                    <span>
                      {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
                    </span>
                    <span>
                      {order.shipping.city}, {order.shipping.state}
                    </span>
                    <span className={`pay pay--${order.paymentStatus.toLowerCase()}`}>
                      {titleCase(order.paymentStatus)}
                    </span>
                  </div>

                  <div className="order-card__total">
                    <span>Total</span>
                    <strong>{formatMoney(order.total)}</strong>
                  </div>
                </div>

                <div className="order-card__actions">
                  <Link to={`/orders/${order.id}`} className="btn btn--outline btn--sm">
                    View details
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onChange={(nextPage) => {
              const next = new URLSearchParams(searchParams);
              next.set('page', String(nextPage));
              setSearchParams(next);
            }}
          />
        </>
      )}
    </div>
  );
}
