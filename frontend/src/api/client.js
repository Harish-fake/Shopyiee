import axios from 'axios';

/**
 * Shared HTTP client.
 *
 * `withCredentials` keeps the HTTP-only session cookie attached to every
 * request.  Responses follow the shape `{ success, data }` or
 * `{ success: false, error: { message, code } }`; the interceptor below
 * normalises failures into an `ApiError` so components can handle them
 * uniformly.
 */

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

/** Cache the CSRF token issued by the server. */
let csrfToken = null;

export function setCsrfToken(token) {
  csrfToken = token;
}

export async function fetchCsrfToken() {
  const { data } = await client.get('/auth/csrf');
  csrfToken = data?.data?.csrfToken ?? null;
  return csrfToken;
}

client.interceptors.request.use((config) => {
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes((config.method || '').toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.error?.message || 'Something went wrong. Please try again.';
      return Promise.reject(new ApiError(message, status, data?.error?.code, data?.error?.details));
    }
    if (error.request) {
      return Promise.reject(new ApiError('The server could not be reached. Please check your connection.', 0, 'NETWORK'));
    }
    return Promise.reject(new ApiError(error.message, 0, 'CLIENT'));
  }
);

/* -------------------------------------------------------------------------- */
/* Convenience wrappers                                                        */
/* -------------------------------------------------------------------------- */

export const api = {
  get: (url, config) => client.get(url, config).then((response) => response.data),
  post: (url, body, config) => client.post(url, body, config).then((response) => response.data),
  put: (url, body, config) => client.put(url, body, config).then((response) => response.data),
  delete: (url, config) => client.delete(url, config).then((response) => response.data),
};

export default client;
