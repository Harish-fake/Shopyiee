import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Spinner } from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

/** Account creation page. */
export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Please enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) next.email = 'Please enter a valid email address';
    if (form.password.length < 8) next.password = 'Use at least 8 characters';
    else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      next.password = 'Include at least one letter and one number';
    }
    if (form.password !== form.confirmPassword) next.confirmPassword = 'The passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || null,
      });

      toast.success(`Welcome to ShopSphere, ${user.name.split(' ')[0]}!`);
      navigate('/');
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <div className="auth-card__head">
          <img src="/images/logo.svg" alt="" width="44" height="44" />
          <h1>Create your account</h1>
          <p>New accounts start with ₹10,000 in store credit</p>
        </div>

        {errors.form && <div className="alert alert--danger">{errors.form}</div>}

        <form onSubmit={submit} className="auth-form">
          <div className="form-grid">
            <div className="field field--full">
              <label htmlFor="reg-name">Full name</label>
              <input id="reg-name" type="text" value={form.name} onChange={update('name')} maxLength={120} required />
              {errors.name && <small className="field__error">{errors.name}</small>}
            </div>

            <div className="field">
              <label htmlFor="reg-email">Email address</label>
              <input id="reg-email" type="email" value={form.email} onChange={update('email')} required />
              {errors.email && <small className="field__error">{errors.email}</small>}
            </div>

            <div className="field">
              <label htmlFor="reg-phone">Phone number (optional)</label>
              <input id="reg-phone" type="tel" value={form.phone} onChange={update('phone')} maxLength={30} />
            </div>

            <div className="field">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                value={form.password}
                onChange={update('password')}
                autoComplete="new-password"
                required
              />
              {errors.password ? (
                <small className="field__error">{errors.password}</small>
              ) : (
                <small className="field__hint">At least 8 characters, with a letter and a number</small>
              )}
            </div>

            <div className="field">
              <label htmlFor="reg-confirm">Confirm password</label>
              <input
                id="reg-confirm"
                type="password"
                value={form.confirmPassword}
                onChange={update('confirmPassword')}
                autoComplete="new-password"
                required
              />
              {errors.confirmPassword && <small className="field__error">{errors.confirmPassword}</small>}
            </div>
          </div>

          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : 'Create account'}
          </button>
        </form>

        <p className="auth-card__footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
