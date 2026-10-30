'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
};

type ToastState = {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ type, message, action, durationMs }) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const ttl = durationMs ?? (action ? 12_000 : 3500);
    set((s) => ({
      toasts: [...s.toasts, { id, type, message, action, durationMs: ttl }],
    }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, ttl);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

function getStyle(type: ToastType) {
  if (type === 'success') {
    return {
      iconWell: 'bg-success-subtle text-success-text',
      icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
    };
  }
  if (type === 'error') {
    return {
      iconWell: 'bg-danger-subtle text-danger-text',
      icon: <XCircle className="h-4 w-4" aria-hidden />,
    };
  }
  return {
    iconWell: 'bg-bg-sunken text-text-secondary',
    icon: <Info className="h-4 w-4" aria-hidden />,
  };
}

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const style = getStyle(toast.type);
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              role={toast.type === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-raised p-3 shadow-overlay"
            >
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-border-focus"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
              <div className="flex flex-col gap-2 pr-8 text-sm text-text-primary">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.iconWell}`}
                  >
                    {style.icon}
                  </span>
                  <p className="pt-0.5 leading-snug">{toast.message}</p>
                </div>
                {toast.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      dismiss(toast.id);
                    }}
                    className="ml-8 self-start rounded-lg border border-accent-border bg-accent-subtle px-3 py-1.5 text-xs font-semibold text-accent-text transition-colors hover:border-accent-solid"
                  >
                    {toast.action.label}
                  </button>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function useToast() {
  const push = useToastStore((state) => state.push);
  return useMemo(
    () => ({
      success: (
        message: string,
        action?: { label: string; onClick: () => void },
      ) => push({ type: 'success', message, action }),
      error: (message: string) => push({ type: 'error', message }),
      info: (message: string) => push({ type: 'info', message }),
    }),
    [push],
  );
}
