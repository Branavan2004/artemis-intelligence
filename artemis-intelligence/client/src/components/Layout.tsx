import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { AUTH_STATE_CHANGE_EVENT, AuthUser, clearAuthSession, readAuthUser } from '../lib/auth'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/replay', label: 'Replay' },
  { to: '/crew', label: 'Crew' },
  { to: '/news', label: 'News' },
  { to: '/chat', label: 'Chat' },
]

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

export default function Layout() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readAuthUser())

  useEffect(() => {
    function syncAuthState() {
      setCurrentUser(readAuthUser())
    }

    syncAuthState()
    window.addEventListener(AUTH_STATE_CHANGE_EVENT, syncAuthState)
    window.addEventListener('storage', syncAuthState)

    return () => {
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, syncAuthState)
      window.removeEventListener('storage', syncAuthState)
    }
  }, [])

  function handleLogout() {
    clearAuthSession()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-4">
            <NavLink to="/" className="flex items-center gap-3 text-sm font-semibold tracking-[-0.02em] text-[color:var(--text)]">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
              <span>Artemis Intelligence</span>
            </NavLink>
            <div className="hidden text-sm text-[color:var(--muted)] lg:block">Artemis II</div>
          </div>

          <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
            {navItems.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex h-16 items-center border-b-2 px-1 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-blue-600 text-[color:var(--text)]'
                      : 'border-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-sm text-[color:var(--muted)] lg:flex">
              <span className="status-dot bg-emerald-500" />
              <span>Mission active</span>
            </div>

            {currentUser ? (
              <>
                <div className="flex items-center gap-3 border-l border-[color:var(--border)] pl-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                    {getInitials(currentUser.name)}
                  </div>
                  <span className="hidden text-sm text-[color:var(--muted)] xl:block">{currentUser.name}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm font-medium text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4 border-l border-[color:var(--border)] pl-4 text-sm font-medium">
                <NavLink to="/login" className="text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]">
                  Log in
                </NavLink>
                <NavLink to="/register" className="text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  Create account
                </NavLink>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[color:var(--border)] md:hidden">
          <div className="mx-auto flex h-11 max-w-[1200px] items-center gap-6 overflow-x-auto px-6">
            {navItems.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex h-11 items-center whitespace-nowrap border-b-2 px-1 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-blue-600 text-[color:var(--text)]'
                      : 'border-transparent text-[color:var(--muted)]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-12">
        <Outlet />
      </main>
    </div>
  )
}
