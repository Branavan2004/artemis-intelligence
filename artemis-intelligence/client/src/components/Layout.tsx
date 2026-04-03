import { Outlet, NavLink } from 'react-router-dom'
import { Rocket, Newspaper, Users, Bot } from 'lucide-react'

export default function Layout() {
  return (
    <div className="min-h-screen bg-space-950">
      <nav className="border-b border-gray-800 bg-space-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
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
          <div className="flex items-center gap-1">
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
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
