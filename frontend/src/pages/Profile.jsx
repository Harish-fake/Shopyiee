import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Spinner } from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api/client.js';
import { formatDate, formatMoney, initials } from '../utils/format.js';

/** Account overview, address book and password change. */
export default function Profile() {
  const { user, updateProfile, changePassword } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('details');
  const [details, setDetails] = useState({ name: '', phone: '', address: '', city: '', state: '', postalCode: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [stats, setStats] = useState({ orders: 0, reviews: 0, wishlist: 0 });

  useEffect(() => {
    if (!user) return;
    setDetails({
      name: user.name ?? '',
      phone: user.phone ?? '',
      address: user.address ?? '',
      city: user.city ?? '',
      state: user.state ?? '',
      postalCode: user.postalCode ?? '',
    });
  }, [user]);

  useEffect(() => {
    Promise.all([
      api.get('/orders?limit=1').catch(() => null),
      api.get('/reviews/mine').catch(() => null),
      api.get('/wishlist').catch(() => null),
    ]).then(([orders, reviews, wishlist]) => {
      setStats({
        orders: orders?.data?.pagination?.total ?? 0,
        reviews: reviews?.data?.total ?? 0,
        wishlist: wishlist?.data?.total ?? 0,
      });
    });
  }, []);

  const saveDetails = async (event) => {
    event.preventDefault();
    setSavingDetails(true);
    try {
      await updateProfile(details);
      toast.success('Your details have been saved');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingDetails(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();

    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('The new passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(passwords.currentPassword, passwords.newPassword);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Your password has been updated');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container section">
      <header className="page-head">
        <div>
          <h1>My account</h1>
          <p>Manage your details, addresses and password</p>
        </div>
      </header>

      <div className="profile-layout">
        <aside className="profile-card">
          <div className="profile-card__avatar">{initials(user.name)}</div>
          <h2>{user.name}</h2>
          <p className="profile-card__email">{user.email}</p>

          <div className="profile-card__wallet">
            <span>Wallet balance</span>
            <strong>{formatMoney(user.walletBalance)}</strong>
            <Link to="/wallet" className="btn btn--ghost btn--xs">
              Manage wallet
            </Link>
          </div>

          <dl className="profile-card__stats">
            <div>
              <dt>Orders</dt>
              <dd>{stats.orders}</dd>
            </div>
            <div>
              <dt>Reviews</dt>
              <dd>{stats.reviews}</dd>
            </div>
            <div>
              <dt>Wishlist</dt>
              <dd>{stats.wishlist}</dd>
            </div>
          </dl>

          <p className="profile-card__since">Member since {formatDate(user.createdAt)}</p>
          {user.role === 'ADMIN' && (
            <Link to="/admin" className="btn btn--primary btn--block">
              Open admin panel
            </Link>
          )}
        </aside>

        <div className="profile-main">
          <div className="tabs">
            <button
              type="button"
              className={`tabs__tab ${tab === 'details' ? 'is-active' : ''}`}
              onClick={() => setTab('details')}
            >
              Personal details
            </button>
            <button
              type="button"
              className={`tabs__tab ${tab === 'address' ? 'is-active' : ''}`}
              onClick={() => setTab('address')}
            >
              Delivery address
            </button>
            <button
              type="button"
              className={`tabs__tab ${tab === 'security' ? 'is-active' : ''}`}
              onClick={() => setTab('security')}
            >
              Password
            </button>
          </div>

          {tab === 'details' && (
            <form className="panel" onSubmit={saveDetails}>
              <h2>Personal details</h2>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="p-name">Full name</label>
                  <input
                    id="p-name"
                    type="text"
                    value={details.name}
                    onChange={(event) => setDetails({ ...details, name: event.target.value })}
                    maxLength={120}
                  />
                </div>
                <div className="field">
                  <label htmlFor="p-email">Email address</label>
                  <input id="p-email" type="email" value={user.email} disabled />
                  <small className="field__hint">The email address cannot be changed</small>
                </div>
                <div className="field">
                  <label htmlFor="p-phone">Phone number</label>
                  <input
                    id="p-phone"
                    type="tel"
                    value={details.phone}
                    onChange={(event) => setDetails({ ...details, phone: event.target.value })}
                    maxLength={30}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn--primary" disabled={savingDetails}>
                {savingDetails ? <Spinner size="sm" /> : 'Save changes'}
              </button>
            </form>
          )}

          {tab === 'address' && (
            <form className="panel" onSubmit={saveDetails}>
              <h2>Delivery address</h2>
              <p className="panel__intro">This address is pre-filled at checkout.</p>
              <div className="form-grid">
                <div className="field field--full">
                  <label htmlFor="p-address">Street address</label>
                  <input
                    id="p-address"
                    type="text"
                    value={details.address}
                    onChange={(event) => setDetails({ ...details, address: event.target.value })}
                    maxLength={255}
                  />
                </div>
                <div className="field">
                  <label htmlFor="p-city">City</label>
                  <input
                    id="p-city"
                    type="text"
                    value={details.city}
                    onChange={(event) => setDetails({ ...details, city: event.target.value })}
                    maxLength={80}
                  />
                </div>
                <div className="field">
                  <label htmlFor="p-state">State</label>
                  <input
                    id="p-state"
                    type="text"
                    value={details.state}
                    onChange={(event) => setDetails({ ...details, state: event.target.value })}
                    maxLength={80}
                  />
                </div>
                <div className="field">
                  <label htmlFor="p-postal">Postal code</label>
                  <input
                    id="p-postal"
                    type="text"
                    value={details.postalCode}
                    onChange={(event) => setDetails({ ...details, postalCode: event.target.value })}
                    maxLength={20}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn--primary" disabled={savingDetails}>
                {savingDetails ? <Spinner size="sm" /> : 'Save address'}
              </button>
            </form>
          )}

          {tab === 'security' && (
            <form className="panel" onSubmit={savePassword}>
              <h2>Change password</h2>
              <div className="form-grid">
                <div className="field field--full">
                  <label htmlFor="p-current">Current password</label>
                  <input
                    id="p-current"
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="p-new">New password</label>
                  <input
                    id="p-new"
                    type="password"
                    value={passwords.newPassword}
                    onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
                    autoComplete="new-password"
                    required
                  />
                  <small className="field__hint">At least 8 characters, with a letter and a number</small>
                </div>
                <div className="field">
                  <label htmlFor="p-confirm">Confirm new password</label>
                  <input
                    id="p-confirm"
                    type="password"
                    value={passwords.confirmPassword}
                    onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn--primary" disabled={savingPassword}>
                {savingPassword ? <Spinner size="sm" /> : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
