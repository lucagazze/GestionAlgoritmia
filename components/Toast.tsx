import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<{ showToast: (msg: string, type?: ToastType) => void } | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast debe usarse dentro de ToastProvider");
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`
            flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-right-5 fade-in duration-300
            ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : ''}
            ${toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : ''}
            ${toast.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200' : ''}
          `}>
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4" />}
            {toast.type === 'info' && <Info className="w-4 h-4" />}
            <span>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="ml-4 hover:opacity-70"><X className="w-3 h-3"/></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
