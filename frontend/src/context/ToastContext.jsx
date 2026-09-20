import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/** Lightweight notification stack used for confirmations and errors. */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, tone = 'info', duration = 4000) => {
      const id = nextId.current;
      nextId.current += 1;

      setToasts((current) => [...current, { id, message, tone }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);

      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      notify,
      success: (message) => notify(message, 'success'),
      error: (message) => notify(message, 'danger'),
      info: (message) => notify(message, 'info'),
      dismiss,
    }),
    [notify, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <span className="toast__message">{toast.message}</span>
            <button type="button" className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context;
}
