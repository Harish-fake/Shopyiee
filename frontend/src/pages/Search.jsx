import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import ProductCard from '../components/ProductCard.jsx';
import Pagination from '../components/Pagination.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SearchEcho from '../components/SearchEcho.jsx';
import { ProductGridSkeleton } from '../components/Loader.jsx';
import { api } from '../api/client.js';
import { formatNumber } from '../utils/format.js';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating-desc', label: 'Highest rated' },
  { value: 'name-asc', label: 'Name: A to Z' },
];

/** Search results. */
export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();

  const term = searchParams.get('q') || '';
  const page = Number(searchParams.get('page') || 1);
  const sort = searchParams.get('sort') || 'newest';
  const limit = 12;

  const [data, setData] = useState({ items: [], query: '', pagination: { total: 0, totalPages: 1, page: 1 } });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!term) {
      setData({ items: [], query: '', pagination: { total: 0, totalPages: 1, page: 1 } });
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ q: term, page: String(page), limit: String(limit), sort });

    api
      .get(`/products/search?${params.toString()}`)
      .then((response) => {
        if (cancelled) return;
        setData({
          items: response?.data?.items ?? [],
          query: response?.data?.query ?? '',
          pagination: response?.data?.pagination ?? { total: 0, totalPages: 1, page: 1 },
        });
      })
      .catch(() => {
        if (!cancelled) setData({ items: [], query: term, pagination: { total: 0, totalPages: 1, page: 1 } });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [term, page, sort, limit]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="container section">
      <header className="page-head">
        <div>
          <h1>
            Results for <SearchEcho html={data.query || term} />
          </h1>
          <p>
            {loading
              ? 'Searching the catalogue…'
              : `${formatNumber(data.pagination.total)} matching product${data.pagination.total === 1 ? '' : 's'}`}
          </p>
        </div>
      </header>

      <div className="toolbar">
        <span className="toolbar__count">Search term: “{term}”</span>
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
        <ProductGridSkeleton count={8} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={`No results for “${term}”`}
          message="Check the spelling, try a broader term, or browse the full catalogue."
          actionLabel="Browse all products"
          actionTo="/products"
        />
      ) : (
        <>
          <div className="product-grid product-grid--3">
            {data.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onChange={(nextPage) => updateParam('page', String(nextPage))}
          />
        </>
      )}
    </div>
  );
}
