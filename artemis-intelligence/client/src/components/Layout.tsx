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

  const avatarLabel = currentUser ? getInitials(currentUser.name).slice(0, 1) || 'A' : 'G'

  return (
    <div className="app-shell">
      <header className="app-nav">
        <NavLink to="/" className="app-brand-link" aria-label="Artemis Intelligence home">
          <span className="app-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="9" r="8.5" stroke="currentColor" strokeWidth="1" />
              <circle cx="9" cy="9" r="2.5" fill="currentColor" />
            </svg>
          </span>
          <span className="app-brand-wordmark">ARTEMIS</span>
          <span className="app-brand-divider" aria-hidden="true" />
          <span className="app-brand-subtitle">INTELLIGENCE</span>
        </NavLink>

        <nav className="app-nav__center" aria-label="Primary">
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="app-nav__meta">
          <div className="mission-status" aria-live="polite">
            <span className="mission-status__dot pulse" />
            <span className="mission-status__text">Mission Active</span>
          </div>
          <span className="app-nav__divider" aria-hidden="true" />
          <button
            type="button"
            className="app-avatar"
            onClick={currentUser ? handleLogout : () => navigate('/login')}
            title={currentUser ? `Sign out ${currentUser.name}` : 'Log in'}
            aria-label={currentUser ? `Sign out ${currentUser.name}` : 'Log in'}
          >
            {avatarLabel}
          </button>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
