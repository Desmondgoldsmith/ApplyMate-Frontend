import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UIState = {
  sidebarCollapsed: boolean;
  activeJobId: string | null;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveJobId: (id: string | null) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      /** Expanded (labels visible) by default on desktop. */
      sidebarCollapsed: false,
      activeJobId: null,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setActiveJobId: (id) => set({ activeJobId: id }),
    }),
    {
      name: 'applymate_ui',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);

