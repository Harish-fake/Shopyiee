import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import ProductCard from '../components/ProductCard.jsx';
import Pagination from '../components/Pagination.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { ProductGridSkeleton } from '../components/Loader.jsx';
import { api } from '../api/client.js';
import { formatMoney, formatNumber } from '../utils/format.js';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating-desc', label: 'Highest rated' },
  { value: 'name-asc', label: 'Name: A to Z' },
];

const PRICE_BANDS = [
  { label: 'All prices', min: '', max: '' },
  { label: 'Under ₹2,000', min: '', max: '2000' },
  { label: '₹2,000 – ₹10,000', min: '2000', max: '10000' },
  { label: '₹10,000 – ₹40,000', min: '10000', max: '40000' },
  { label: 'Above ₹40,000', min: '40000', max: '' },
];

/** Full catalogue with filtering, sorting and pagination. */
export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') || 1);
  const sort = searchParams.get('sort') || 'newest';
  const categoryId = searchParams.get('categoryId') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const limit = 12;

  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/categories')
      .then((response) => setCategories(response?.data?.items ?? []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });
    if (categoryId) params.set('categoryId', categoryId);

    api
      .get(`/products?${params.toString()}`)
      .then((response) => {
        if (cancelled) return;

        let items = response?.data?.items ?? [];

        // Price bands are applied client-side so the URL stays shareable.
        if (minPrice) items = items.filter((item) => item.price >= Number(minPrice));
        if (maxPrice) items = items.filter((item) => item.price <= Number(maxPrice));

        setProducts(items);
        setPagination(response?.data?.pagination ?? { page: 1, total: 0, totalPages: 1 });
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          setPagination({ page: 1, total: 0, totalPages: 1 });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, sort, categoryId, minPrice, maxPrice, limit]);

  const updateParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const activeBand = PRICE_BANDS.findIndex((band) => band.min === minPrice && band.max === maxPrice);

  return (
    <div className="container section">
      <header className="page-head">
        <div>
          <h1>All products</h1>
          <p>{formatNumber(pagination.total)} products available</p>
        </div>
      </header>

      <div className="catalogue">
        <aside className="filters">
          <div className="filters__group">
            <h3>Category</h3>
            <button
              type="button"
              className={`filters__option ${!categoryId ? 'is-active' : ''}`}
              onClick={() => updateParam('categoryId', '')}
            >
              All categories
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`filters__option ${String(category.id) === String(categoryId) ? 'is-active' : ''}`}
                onClick={() => updateParam('categoryId', String(category.id))}
              >
                {category.name}
                <small>{category.productCount}</small>
              </button>
            ))}
          </div>

          <div className="filters__group">
            <h3>Price</h3>
            {PRICE_BANDS.map((band, index) => (
              <button
                key={band.label}
                type="button"
                className={`filters__option ${activeBand === index ? 'is-active' : ''}`}
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  if (band.min) next.set('minPrice', band.min);
                  else next.delete('minPrice');
                  if (band.max) next.set('maxPrice', band.max);
                  else next.delete('maxPrice');
                  next.delete('page');
                  setSearchParams(next);
                }}
              >
                {band.label}
              </button>
            ))}
          </div>

          {(categoryId || minPrice || maxPrice) && (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setSearchParams({ sort })}>
              Clear all filters
            </button>
          )}
        </aside>

        <div className="catalogue__main">
          <div className="toolbar">
            <span className="toolbar__count">
              Showing {products.length} of {formatNumber(pagination.total)}
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
          ) : products.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No products match those filters"
              message="Try widening your price range or choosing a different category."
              actionLabel="Reset filters"
              onAction={() => setSearchParams({})}
            />
          ) : (
            <>
              <div className="product-grid product-grid--3">
                {products.map((product) => (
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

          {products.length > 0 && (
            <p className="catalogue__hint">
              Free delivery on orders above {formatMoney(5000)}. Prices include all taxes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
