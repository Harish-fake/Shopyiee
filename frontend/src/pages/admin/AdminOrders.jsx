import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Pagination from '../../components/Pagination.jsx';
import { TableSkeleton } from '../../components/Loader.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../api/client.js';
import { ORDER_STATUSES, formatDate, formatMoney, formatNumber, titleCase } from '../../utils/format.js';

/** Order fulfilment queue. */
export default function AdminOrders() {
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);

    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());

    api
      .get(`/admin/orders?${params.toString()}`)
      .then((response) => {
        setOrders(response?.data?.items ?? []);
        setPagination(response?.data?.pagination ?? { page: 1, total: 0, totalPages: 1 });
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  const changeStatus = async (order, nextStatus) => {
    setBusyId(order.id);
    try {
      await api.put(`/admin/orders/${order.id}/status`, { status: nextStatus });
      setOrders((current) =>
        current.map((entry) => (entry.id === order.id ? { ...entry, status: nextStatus } : entry))
      );
      toast.success(`${order.orderNumber} marked as ${titleCase(nextStatus)}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div>
          <h1>Orders</h1>
          <p>{formatNumber(pagination.total)} orders in total</p>
        </div>
      </header>

      <div className="admin-toolbar">
        <div className="filter-chips filter-chips--inline">
          <button type="button" className={`chip ${!status ? 'is-active' : ''}`} onClick={() => { setStatus(''); setPage(1); }}>
            All
          </button>
          {ORDER_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              className={`chip ${status === value ? 'is-active' : ''}`}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {titleCase(value)}
            </button>
          ))}
        </div>

        <form
          className="admin-search"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            load();
          }}
        >
          <input
            type="search"
            placeholder="Search order number, name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" className="btn btn--outline btn--sm">
            Search
          </button>
        </form>
      </div>

      <section className="panel">
        {loading ? (
          <TableSkeleton rows={8} columns={7} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th className="table__num">Total</th>
                  <th>Payment</th>
                  <th>Status</th>
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
                    <td>
                      <div className="table__stacked">
                        <strong>{order.customerName}</strong>
                        <small>{order.customerEmail}</small>
                      </div>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>{order.itemCount}</td>
                    <td className="table__num">{formatMoney(order.total)}</td>
                    <td>
                      <span className={`pay pay--${order.paymentStatus.toLowerCase()}`}>
                        {titleCase(order.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      <select
                        className="select-inline"
                        value={order.status}
                        onChange={(event) => changeStatus(order, event.target.value)}
                        disabled={busyId === order.id}
                        aria-label={`Status for ${order.orderNumber}`}
                      >
                        {ORDER_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {titleCase(value)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={setPage} />
      </section>
    </div>
  );
}
