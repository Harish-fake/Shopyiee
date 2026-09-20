import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import EmptyState from '../components/EmptyState.jsx';
import { PageLoader, Spinner } from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api/client.js';
import { formatDateTime, formatMoney, titleCase } from '../utils/format.js';

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000];

/**
 * Simulated wallet.
 *
 * Balances, deposits and refunds are rows in a local MySQL table. No bank,
 * card network or payment provider is involved at any point.
 */
export default function Wallet() {
  const { syncBalance } = useAuth();
  const toast = useToast();

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('1000');
  const [depositing, setDepositing] = useState(false);
  const [filter, setFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/wallet'), api.get('/wallet/transactions?limit=50')])
      .then(([walletResponse, txResponse]) => {
        setWallet(walletResponse?.data ?? null);
        setTransactions(txResponse?.data?.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const deposit = async (event) => {
    event.preventDefault();

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter an amount greater than zero');
      return;
    }

    setDepositing(true);
    try {
      await api.post('/wallet/deposit', { amount: value, description: 'Wallet top-up' });
      await syncBalance();
      toast.success(`${formatMoney(value)} added to your wallet`);
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDepositing(false);
    }
  };

  if (loading && !wallet) return <PageLoader message="Loading your wallet…" />;

  const visibleTransactions = filter ? transactions.filter((entry) => entry.type === filter) : transactions;

  return (
    <div className="container section">
      <header className="page-head">
        <div>
          <h1>My wallet</h1>
          <p>Simulated store credit for demonstration purposes</p>
        </div>
      </header>

      <div className="wallet-layout">
        <div className="wallet-main">
          <section className="wallet-hero">
            <div className="wallet-hero__top">
              <span className="wallet-hero__label">Available balance</span>
              <span className="wallet-hero__chip">Store credit</span>
            </div>
            <strong className="wallet-hero__amount">{formatMoney(wallet?.balance ?? 0)}</strong>
            <p className="wallet-hero__note">
              Use this balance at checkout. Top-ups are simulated and never involve a real payment method.
            </p>

            <dl className="wallet-hero__stats">
              <div>
                <dt>Added</dt>
                <dd>{formatMoney(wallet?.summary?.totalDeposited ?? 0)}</dd>
              </div>
              <div>
                <dt>Spent</dt>
                <dd>{formatMoney(wallet?.summary?.totalSpent ?? 0)}</dd>
              </div>
              <div>
                <dt>Refunded</dt>
                <dd>{formatMoney(wallet?.summary?.totalRefunded ?? 0)}</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <header className="panel__head">
              <h2>Transaction history</h2>
              <div className="filter-chips filter-chips--inline">
                <button type="button" className={`chip ${!filter ? 'is-active' : ''}`} onClick={() => setFilter('')}>
                  All
                </button>
                {['DEPOSIT', 'PURCHASE', 'REFUND'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`chip ${filter === type ? 'is-active' : ''}`}
                    onClick={() => setFilter(type)}
                  >
                    {titleCase(type)}
                  </button>
                ))}
              </div>
            </header>

            {visibleTransactions.length === 0 ? (
              <EmptyState icon="📄" title="No transactions yet" message="Your wallet activity will appear here." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Reference</th>
                      <th className="table__num">Amount</th>
                      <th className="table__num">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTransactions.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDateTime(entry.createdAt)}</td>
                        <td>
                          {entry.description}
                          {entry.orderNumber && (
                            <>
                              {' '}
                              <Link to={`/orders/${entry.orderId}`} className="link-inline">
                                {entry.orderNumber}
                              </Link>
                            </>
                          )}
                        </td>
                        <td>
                          <code className="code-inline">{entry.reference}</code>
                        </td>
                        <td className={`table__num ${entry.type === 'PURCHASE' ? 'text-danger' : 'text-success'}`}>
                          {entry.type === 'PURCHASE' ? '−' : '+'}
                          {formatMoney(entry.amount)}
                        </td>
                        <td className="table__num">{formatMoney(entry.balanceAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="wallet-side">
          <section className="panel">
            <h2>Add funds</h2>
            <p className="panel__intro">Choose an amount or enter your own.</p>

            <div className="quick-amounts">
              {QUICK_AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`quick-amounts__option ${Number(amount) === value ? 'is-active' : ''}`}
                  onClick={() => setAmount(String(value))}
                >
                  {formatMoney(value)}
                </button>
              ))}
            </div>

            <form onSubmit={deposit}>
              <div className="field">
                <label htmlFor="amount">Amount</label>
                <input
                  id="amount"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>

              <button type="submit" className="btn btn--primary btn--block" disabled={depositing}>
                {depositing ? <Spinner size="sm" /> : 'Add to wallet'}
              </button>
            </form>

            <p className="summary-note">
              Simulated top-up. No card details are collected and no external service is contacted.
            </p>
          </section>

          <section className="panel">
            <h2>Recent purchases</h2>
            {wallet?.recentPurchases?.length ? (
              <ul className="mini-list">
                {wallet.recentPurchases.map((purchase) => (
                  <li key={purchase.id}>
                    <div>
                      <Link to={`/orders/${purchase.id}`}>{purchase.orderNumber}</Link>
                      <small>{formatDateTime(purchase.createdAt)}</small>
                    </div>
                    <strong>{formatMoney(purchase.total)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel__intro">You have not placed any orders yet.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
