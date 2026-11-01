import { useEffect, useSyncExternalStore } from 'react'
import { useUiStore, type ThemePreference } from '@/store/uiStore'

const query = '(prefers-color-scheme: dark)'

function subscribeSystem(callback: () => void) {
  const mql = window.matchMedia(query)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function systemPrefersDark() {
  return window.matchMedia(query).matches
}

export function resolveTheme(theme: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
}

/** The theme actually applied right now. */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useUiStore((s) => s.theme)
  const systemDark = useSyncExternalStore(subscribeSystem, systemPrefersDark, () => false)
  return resolveTheme(theme, systemDark)
}

/** Keeps the `dark` class on <html> in step with the stored preference and the OS setting. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const resolved = useResolvedTheme()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])
  return children
}
