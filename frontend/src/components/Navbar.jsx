import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navLinks = [
  { to: '/', label: 'Stories' },
  { to: '/blindspot', label: 'Blindspot' },
  { to: '/outlets', label: 'Outlets' },
  { to: '/articles', label: 'Articles' },
  { to: '/how-it-works', label: 'How It Works' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout, isLoggedIn } = useAuth()

  const linkClass = (to, label) => {
    const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
    if (label === 'Blindspot')
      return isActive
        ? 'bg-orange-100 text-orange-700 border border-orange-200 shadow-sm'
        : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
    if (label === 'How It Works')
      return isActive
        ? 'bg-teal-100 text-teal-700 border border-teal-200 shadow-sm'
        : 'text-teal-600 hover:text-teal-700 hover:bg-teal-50'
    return isActive
      ? 'bg-sky-100 text-sky-700 border border-sky-200 shadow-sm'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
  }

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-brand-border sticky top-0 z-50 shadow-[0_10px_30px_-24px_rgba(2,6,23,0.5)]">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-13">
        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0">
          <img src="/logo.png" alt="News Narrative Logo" className="h-16 md:h-20 scale-[2.5] md:scale-[3.5] origin-left transform object-contain ml-4" />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-0.5">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${linkClass(to, label)}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right: user + live + hamburger */}
        <div className="flex items-center gap-3">
          {/* User area */}
          {isLoggedIn ? (
            <div className="flex items-center gap-3 relative ml-4">
              <Link to="/history" className="text-xs font-bold text-slate-500 hover:text-sky-600 transition-colors mr-2">
                My History
              </Link>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center text-white font-black text-sm shadow-sm cursor-pointer" title={user?.username}>
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-medium text-slate-700">{user?.username}</span>
              <button
                onClick={logout}
                className="text-[10px] text-slate-400 hover:text-red-500 transition-colors cursor-pointer font-medium ml-1"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-sky-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow-md transition-all"
            >
              Sign in
            </Link>
          )}

          <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:block">Live</span>
          </div>
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden flex flex-col gap-1 p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-0.5 bg-slate-600 transition-transform origin-center ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <span className={`block w-5 h-0.5 bg-slate-600 transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-slate-600 transition-transform origin-center ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-brand-border bg-white px-4 py-3 space-y-1">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${linkClass(to, label)}`}
            >
              {label}
            </Link>
          ))}
          {/* Mobile login/logout */}
          {isLoggedIn ? (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 mt-2 pt-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center text-white text-[10px] font-bold">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-slate-700">{user?.username}</span>
              </div>
              <button
                onClick={() => { logout(); setMobileOpen(false) }}
                className="text-xs text-red-500 hover:text-red-600 font-medium cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-sky-600 hover:bg-sky-50 rounded-lg border-t border-slate-100 mt-2 pt-3"
            >
              Sign in
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
