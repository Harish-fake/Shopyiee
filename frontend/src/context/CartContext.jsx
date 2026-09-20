import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

/**
 * Cart state.
 *
 * The cart itself is stored in MySQL; this provider only mirrors what the
 * server reports.  Totals shown in the interface come from the API, never from
 * client-side arithmetic.
 */

const EMPTY_CART = {
  items: [],
  itemCount: 0,
  distinctCount: 0,
  subtotal: 0,
  shippingFee: 0,
  discount: 0,
  total: 0,
  freeShippingThreshold: 5000,
};

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(EMPTY_CART);
      return EMPTY_CART;
    }

    setLoading(true);
    try {
      const response = await api.get('/cart');
      const next = response?.data?.cart ?? EMPTY_CART;
      setCart(next);
      return next;
    } catch {
      setCart(EMPTY_CART);
      return EMPTY_CART;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(async (productId, quantity = 1) => {
    const response = await api.post('/cart', { productId, quantity });
    const next = response?.data?.cart ?? EMPTY_CART;
    setCart(next);
    return next;
  }, []);

  const updateItem = useCallback(async (cartItemId, quantity) => {
    const response = await api.put(`/cart/${cartItemId}`, { quantity });
    const next = response?.data?.cart ?? EMPTY_CART;
    setCart(next);
    return next;
  }, []);

  const removeItem = useCallback(async (cartItemId) => {
    const response = await api.delete(`/cart/${cartItemId}`);
    const next = response?.data?.cart ?? EMPTY_CART;
    setCart(next);
    return next;
  }, []);

  const clear = useCallback(async () => {
    const response = await api.delete('/cart');
    const next = response?.data?.cart ?? EMPTY_CART;
    setCart(next);
    return next;
  }, []);

  const value = useMemo(
    () => ({ cart, loading, refresh, addItem, updateItem, removeItem, clear, setCart }),
    [cart, loading, refresh, addItem, updateItem, removeItem, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside a CartProvider');
  return context;
}
