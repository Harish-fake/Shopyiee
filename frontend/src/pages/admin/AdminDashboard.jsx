import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageLoader } from '../../components/Loader.jsx';
import { api } from '../../api/client.js';
import { formatDate, formatMoney, formatNumber, titleCase } from '../../utils/format.js';

/** Business overview for the administration area. */
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/admin/stats'), api.get('/admin/orders?limit=6')])
      .then(([statsResponse, ordersResponse]) => {
        setStats(statsResponse?.data ?? null);
        setOrders(ordersResponse?.data?.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader message="Loading dashboard…" />;

  const cards = [
    { label: 'Total sales', value: formatMoney(stats?.totalSales ?? 0), tone: 'accent', icon: '₹' },
    { label: 'Orders', value: formatNumber(stats?.totalOrders ?? 0), tone: 'info', icon: '❐' },
    { label: 'Customers', value: formatNumber(stats?.totalUsers ?? 0), tone: 'neutral', icon: '☺' },
    { label: 'Products', value: formatNumber(stats?.totalProducts ?? 0), tone: 'neutral', icon: '▦' },
    { label: 'Pending', value: formatNumber(stats?.pendingOrders ?? 0), tone: 'warning', icon: '◷' },
    { label: 'Delivered', value: formatNumber(stats?.completedOrders ?? 0), tone: 'success', icon: '✓' },
    { label: 'Shipped', value: formatNumber(stats?.shippedOrders ?? 0), tone: 'info', icon: '➤' },
    { label: 'Low stock', value: formatNumber(stats?.lowStockProducts ?? 0), tone: 'danger', icon: '!' },
  ];

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div>
          <h1>Dashboard</h1>
          <p>Store performance at a glance</p>
        </div>
        <Link to="/admin/products" className="btn btn--primary">
          Add a product
        </Link>
      </header>

      <div className="stat-grid">
        {cards.map((card) => (
          <div key={card.label} className={`stat-card stat-card--${card.tone}`}>
            <span className="stat-card__icon" aria-hidden="true">
              {card.icon}
            </span>
            <span className="stat-card__label">{card.label}</span>
            <strong className="stat-card__value">{card.value}</strong>
          </div>
        ))}
      </div>

      <div className="admin-columns">
        <section className="panel">
          <header className="panel__head">
            <h2>Recent orders</h2>
            <Link to="/admin/orders" className="link-arrow">
              View all →
            </Link>
          </header>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="table__num">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/orders/${order.id}`} className="link-inline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>{order.customerName}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <span className={`status status--${order.status.toLowerCase()}`}>{titleCase(order.status)}</span>
                    </td>
                    <td className="table__num">{formatMoney(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <header className="panel__head">
            <h2>Low stock</h2>
            <Link to="/admin/products" className="link-arrow">
              Manage →
            </Link>
          </header>

          {stats?.lowStockItems?.length ? (
            <ul className="mini-list">
              {stats.lowStockItems.map((item) => (
                <li key={item.id}>
                  <div className="mini-list__product">
                    <img src={item.image} alt="" width="36" height="36" />
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.categoryName}</small>
                    </div>
                  </div>
                  <span className={item.stock <= 5 ? 'text-danger' : 'text-warning'}>{item.stock} left</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel__intro">All products are comfortably in stock.</p>
          )}
        </section>
      </div>
    </div>
  );
}
