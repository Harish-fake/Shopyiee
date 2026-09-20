import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Spinner } from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

/** Sign-in page. */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const redirectTo = location.state?.from || '/';

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const user = await login(email.trim(), password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(redirectTo, { replace: true });
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__head">
          <img src="/images/logo.svg" alt="" width="44" height="44" />
          <h1>Welcome back</h1>
          <p>Sign in to continue shopping</p>
        </div>

        {error && <div className="alert alert--danger">{error}</div>}

        <form onSubmit={submit} className="auth-form">
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="field__group">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="field__suffix"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : 'Sign in'}
          </button>
        </form>

        <p className="auth-card__footer">
          New to ShopSphere? <Link to="/register">Create an account</Link>
        </p>

        <div className="auth-card__demo">
          <strong>Demo accounts</strong>
          <ul>
            <li>
              <span>Customer</span>
              <code>priya@example.test / UserDemo#2024</code>
            </li>
            <li>
              <span>Administrator</span>
              <code>admin@shopsphere.test / AdminDemo#2024</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
