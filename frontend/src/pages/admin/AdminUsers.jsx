import { useEffect, useState } from 'react';

import { TableSkeleton } from '../../components/Loader.jsx';
import { api } from '../../api/client.js';
import { formatDate, formatMoney, formatNumber, initials } from '../../utils/format.js';

/** Customer directory. */
export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (term = '') => {
    setLoading(true);

    const params = new URLSearchParams({ limit: '200' });
    if (term.trim()) params.set('search', term.trim());

    api
      .get(`/admin/users?${params.toString()}`)
      .then((response) => {
        setUsers(response?.data?.items ?? []);
        setTotal(response?.data?.total ?? 0);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const submitted = (event) => {
    event.preventDefault();
    load(search);
  };

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div>
          <h1>Customers</h1>
          <p>{formatNumber(total)} registered accounts</p>
        </div>
      </header>

      <section className="panel">
        <header className="panel__head">
          <h2>Accounts</h2>
          <form className="admin-search" onSubmit={submitted}>
            <input
              type="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit" className="btn btn--outline btn--sm">
              Search
            </button>
          </form>
        </header>

        {loading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Phone</th>
                  <th className="table__num">Wallet</th>
                  <th>Joined</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="table__product">
                        <span className="table__avatar">{initials(user.name)}</span>
                        <div>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${user.role === 'ADMIN' ? 'badge--accent' : 'badge--neutral'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      {user.city ? (
                        <div className="table__stacked">
                          <span>{user.city}</span>
                          <small>{user.state}</small>
                        </div>
                      ) : (
                        <span className="text-muted">Not provided</span>
                      )}
                    </td>
                    <td>{user.phone || <span className="text-muted">—</span>}</td>
                    <td className="table__num">{formatMoney(user.walletBalance)}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <span className={`badge ${user.isActive ? 'badge--success' : 'badge--danger'}`}>
                        {user.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
