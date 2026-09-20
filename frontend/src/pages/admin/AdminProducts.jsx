import { useEffect, useState } from 'react';

import Pagination from '../../components/Pagination.jsx';
import { TableSkeleton, Spinner } from '../../components/Loader.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../api/client.js';
import { formatMoney, formatNumber } from '../../utils/format.js';

const EMPTY_FORM = {
  name: '',
  brand: '',
  description: '',
  price: '',
  originalPrice: '',
  stock: '',
  categoryId: '',
  image: '/images/products/placeholder.svg',
  isFeatured: false,
  isActive: true,
};

/** Product catalogue management. */
export default function AdminProducts() {
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get(`/admin/products?page=${page}&limit=15`)
      .then((response) => {
        setProducts(response?.data?.items ?? []);
        setPagination(response?.data?.pagination ?? { page: 1, total: 0, totalPages: 1 });
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    api
      .get('/categories')
      .then((response) => setCategories(response?.data?.items ?? []))
      .catch(() => setCategories([]));
  }, []);

  const openCreate = () => {
    setEditing('new');
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? '' });
  };

  const openEdit = (product) => {
    setEditing(product.id);
    setForm({
      name: product.name,
      brand: product.brand ?? '',
      description: product.description ?? '',
      price: String(product.price),
      originalPrice: product.originalPrice ? String(product.originalPrice) : '',
      stock: String(product.stock),
      categoryId: String(product.categoryId),
      image: product.image ?? '',
      isFeatured: product.isFeatured,
      isActive: product.isActive,
    });
  };

  const closeForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      description: form.description.trim() || null,
      price: Number(form.price),
      originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
      stock: Number(form.stock),
      categoryId: Number(form.categoryId),
      image: form.image.trim() || null,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
    };

    try {
      if (editing === 'new') {
        await api.post('/admin/products', payload);
        toast.success('Product created');
      } else {
        await api.put(`/admin/products/${editing}`, payload);
        toast.success('Product updated');
      }
      closeForm();
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (product) => {
    if (!window.confirm(`Remove "${product.name}" from the catalogue?`)) return;

    try {
      await api.delete(`/admin/products/${product.id}`);
      toast.info('Product removed from the catalogue');
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const visible = search
    ? products.filter(
        (product) =>
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          (product.brand ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : products;

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div>
          <h1>Products</h1>
          <p>{formatNumber(pagination.total)} products in the catalogue</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          + Add product
        </button>
      </header>

      {editing !== null && (
        <form className="panel admin-form" onSubmit={save}>
          <header className="panel__head">
            <h2>{editing === 'new' ? 'New product' : 'Edit product'}</h2>
            <button type="button" className="btn btn--ghost btn--sm" onClick={closeForm}>
              Cancel
            </button>
          </header>

          <div className="form-grid">
            <div className="field field--full">
              <label htmlFor="ap-name">Product name</label>
              <input
                id="ap-name"
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                maxLength={200}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="ap-brand">Brand</label>
              <input
                id="ap-brand"
                type="text"
                value={form.brand}
                onChange={(event) => setForm({ ...form, brand: event.target.value })}
                maxLength={100}
              />
            </div>

            <div className="field">
              <label htmlFor="ap-category">Category</label>
              <select
                id="ap-category"
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                required
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="ap-price">Price (₹)</label>
              <input
                id="ap-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="ap-original">Compare-at price (₹)</label>
              <input
                id="ap-original"
                type="number"
                min="0"
                step="0.01"
                value={form.originalPrice}
                onChange={(event) => setForm({ ...form, originalPrice: event.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="ap-stock">Stock quantity</label>
              <input
                id="ap-stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(event) => setForm({ ...form, stock: event.target.value })}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="ap-image">Image path</label>
              <input
                id="ap-image"
                type="text"
                value={form.image}
                onChange={(event) => setForm({ ...form, image: event.target.value })}
                maxLength={255}
              />
            </div>

            <div className="field field--full">
              <label htmlFor="ap-description">Description</label>
              <textarea
                id="ap-description"
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                maxLength={4000}
              />
            </div>

            <div className="field field--inline">
              <label>
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })}
                />
                Feature on the home page
              </label>
            </div>

            <div className="field field--inline">
              <label>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                Visible in the store
              </label>
            </div>
          </div>

          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? <Spinner size="sm" /> : editing === 'new' ? 'Create product' : 'Save changes'}
          </button>
        </form>
      )}

      <section className="panel">
        <header className="panel__head">
          <h2>Catalogue</h2>
          <input
            type="search"
            className="input-inline"
            placeholder="Filter by name or brand…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </header>

        {loading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="table__num">Price</th>
                  <th className="table__num">Stock</th>
                  <th>Status</th>
                  <th className="table__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="table__product">
                        <img src={product.image} alt="" width="40" height="40" />
                        <div>
                          <strong>{product.name}</strong>
                          <small>{product.brand}</small>
                        </div>
                      </div>
                    </td>
                    <td>{product.categoryName}</td>
                    <td className="table__num">{formatMoney(product.price)}</td>
                    <td className={`table__num ${product.stock <= 10 ? 'text-warning' : ''}`}>{product.stock}</td>
                    <td>
                      <span className={`badge ${product.isActive ? 'badge--success' : 'badge--neutral'}`}>
                        {product.isActive ? 'Active' : 'Hidden'}
                      </span>
                      {product.isFeatured && <span className="badge badge--accent">Featured</span>}
                    </td>
                    <td className="table__actions">
                      <button type="button" className="btn btn--ghost btn--xs" onClick={() => openEdit(product)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs btn--danger-text"
                        onClick={() => remove(product)}
                      >
                        Delete
                      </button>
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
