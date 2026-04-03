import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Rocket, Newspaper, Users, Bot, LogIn, UserPlus, LogOut, UserCircle2 } from 'lucide-react'
import { AUTH_STATE_CHANGE_EVENT, AuthUser, clearAuthSession, readAuthUser } from '../lib/auth'

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
    <div className="min-h-screen bg-space-950">
      <nav className="border-b border-gray-800 bg-space-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="text-artemis-blue w-6 h-6" />
            <span className="font-display font-bold text-white text-lg tracking-wider">
              ARTEMIS INTELLIGENCE
            </span>
            <div className="flex items-center gap-2 ml-4">
              <div className="w-2 h-2 rounded-full bg-artemis-green animate-pulse"></div>
              <span className="text-artemis-green text-xs font-mono">MISSION ACTIVE</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap items-center gap-1">
              <NavLink to="/" end className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-artemis-blue text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                <Rocket className="w-4 h-4" />Dashboard
              </NavLink>
              <NavLink to="/crew" className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-artemis-blue text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                <Users className="w-4 h-4" />Crew
              </NavLink>
              <NavLink to="/news" className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-artemis-blue text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                <Newspaper className="w-4 h-4" />News
              </NavLink>
              <NavLink to="/chat" className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-artemis-blue text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                <Bot className="w-4 h-4" />AI Chat
              </NavLink>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {currentUser ? (
                <>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-space-950 px-4 py-2">
                    <UserCircle2 className="h-8 w-8 text-artemis-blue" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{currentUser.name}</div>
                      <div className="truncate text-xs text-gray-400">{currentUser.email}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-all hover:border-red-500/60 hover:text-red-300"
                  >
                    <LogOut className="w-4 h-4" />Log Out
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={({ isActive }) => `flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${isActive ? 'border-artemis-blue bg-artemis-blue/10 text-artemis-blue' : 'border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'}`}>
                    <LogIn className="w-4 h-4" />Log In
                  </NavLink>
                  <NavLink to="/register" className={({ isActive }) => `flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${isActive ? 'bg-artemis-green text-space-950' : 'bg-artemis-blue text-white hover:bg-sky-500'}`}>
                    <UserPlus className="w-4 h-4" />Register
                  </NavLink>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
