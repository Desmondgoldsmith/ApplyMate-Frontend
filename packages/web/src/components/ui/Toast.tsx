'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
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
    set((s) => ({ toasts: [...s.toasts, { id, type, message, action, durationMs: ttl }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, ttl);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

function getStyle(type: ToastType) {
  if (type === 'success') {
    return {
      border: 'border-[#00C9B1]/40',
      accent: 'bg-[#00C9B1]',
      icon: <CheckCircle2 className="h-4 w-4 text-[#00C9B1]" />,
    };
  }
  if (type === 'error') {
    return {
      border: 'border-[#ff6432]/40',
      accent: 'bg-[#ff6432]',
      icon: <XCircle className="h-4 w-4 text-[#ff6432]" />,
    };
  }
  return {
    border: 'border-white/20',
    accent: 'bg-white/40',
    icon: <Info className="h-4 w-4 text-white/70" />,
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
              className={`pointer-events-auto relative overflow-hidden rounded-xl border bg-[#111616] p-3 ${style.border}`}
            >
              <span className={`absolute left-0 top-0 h-full w-1 ${style.accent}`} />
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="absolute right-2 top-2 text-xs text-white/45 hover:text-white/85"
              >
                x
              </button>
              <div className="ml-2 flex flex-col gap-2 pr-6 text-sm text-white/85">
                <div className="flex items-start gap-2">
                  {style.icon}
                  <p>{toast.message}</p>
                </div>
                {toast.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      dismiss(toast.id);
                    }}
                    className="self-start rounded-lg border border-[#00C9B1]/40 bg-[#00C9B1]/10 px-3 py-1.5 text-xs font-semibold text-[#00C9B1] transition hover:bg-[#00C9B1]/20"
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
      success: (message: string, action?: { label: string; onClick: () => void }) =>
        push({ type: 'success', message, action }),
      error: (message: string) => push({ type: 'error', message }),
      info: (message: string) => push({ type: 'info', message }),
    }),
    [push],
  );
}

