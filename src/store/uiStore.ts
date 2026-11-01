import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system'

interface UiState {
  theme: ThemePreference
  sidebarCollapsed: boolean
  pageSize: number
  setTheme: (theme: ThemePreference) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setPageSize: (size: number) => void
}

/** Lightweight UI preferences, persisted to localStorage (`bookease-ui`). */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarCollapsed: false,
      pageSize: 10,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setPageSize: (pageSize) => set({ pageSize }),
    }),
    {
      name: 'bookease-ui',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage()),
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed, pageSize: s.pageSize }),
    },
  ),
)

/** localStorage can throw (privacy modes, blocked storage); fall back to memory. */
function safeLocalStorage(): Storage {
  try {
    const key = '__bookease_probe__'
    window.localStorage.setItem(key, '1')
    window.localStorage.removeItem(key)
    return window.localStorage
  } catch {
    const memory = new Map<string, string>()
    return {
      get length() {
        return memory.size
      },
      clear: () => memory.clear(),
      getItem: (k) => memory.get(k) ?? null,
      key: (i) => [...memory.keys()][i] ?? null,
      removeItem: (k) => void memory.delete(k),
      setItem: (k, v) => void memory.set(k, v),
    }
  }
}
