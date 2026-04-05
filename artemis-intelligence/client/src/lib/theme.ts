export type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'artemis-theme'

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light'
}

export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isTheme(storedTheme) ? storedTheme : null
}

export function getPreferredTheme(): Theme {
  const storedTheme = getStoredTheme()
  if (storedTheme) return storedTheme

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }

  return 'dark'
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

export function persistTheme(theme: Theme) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}