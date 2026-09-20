import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import ProductCard from '../components/ProductCard.jsx';
import Pagination from '../components/Pagination.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { ProductGridSkeleton, PageLoader } from '../components/Loader.jsx';
import { api } from '../api/client.js';
import { formatNumber } from '../utils/format.js';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating-desc', label: 'Highest rated' },
  { value: 'name-asc', label: 'Name: A to Z' },
];

/** Products within a single category. */
export default function Category() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') || 1);
  const sort = searchParams.get('sort') || 'newest';
  const limit = 12;

  const [category, setCategory] = useState(null);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });

    api
      .get(`/categories/${id}/products?${params.toString()}`)
      .then((response) => {
        if (cancelled) return;
        setCategory(response?.data?.category ?? null);
        setItems(response?.data?.items ?? []);
        setPagination(response?.data?.pagination ?? { page: 1, total: 0, totalPages: 1 });
      })
      .catch((apiError) => {
        if (!cancelled) setError(apiError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, page, sort, limit]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  if (loading && !category) return <PageLoader message="Loading category…" />;

  if (error) {
    return (
      <div className="container section">
        <EmptyState
          icon="🧭"
          title="Category not found"
          message="The category you are looking for is no longer available."
          actionLabel="Browse all products"
          actionTo="/products"
        />
      </div>
    );
  }

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/products">Products</Link>
        <span>/</span>
        <span aria-current="page">{category?.name}</span>
      </nav>

      <header className="page-head">
        <div>
          <h1>{category?.name}</h1>
          <p>{category?.description}</p>
        </div>
        <span className="page-head__meta">{formatNumber(pagination.total)} products</span>
      </header>

      <div className="toolbar">
        <span className="toolbar__count">
          Showing {items.length} of {formatNumber(pagination.total)}
        </span>
        <label className="toolbar__sort">
          Sort by
          <select value={sort} onChange={(event) => updateParam('sort', event.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <ProductGridSkeleton count={9} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="📦"
          title="Nothing in this category yet"
          message="New stock is added regularly — check back soon."
          actionLabel="Browse all products"
          actionTo="/products"
        />
      ) : (
        <>
          <div className="product-grid product-grid--3">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onChange={(nextPage) => updateParam('page', String(nextPage))}
          />
        </>
      )}
    </div>
  );
}
