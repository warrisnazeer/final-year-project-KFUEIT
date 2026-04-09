import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

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

  const linkClass = (to, label) => {
    const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
    if (label === 'Blindspot')
      return isActive
        ? 'bg-orange-900/60 text-orange-300 border border-orange-700/50'
        : 'text-orange-400 hover:text-orange-300 hover:bg-orange-900/30'
    if (label === 'How It Works')
      return isActive
        ? 'bg-slate-700/80 text-white'
        : 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-700/40'
    return isActive ? 'bg-slate-700/80 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
  }

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-13">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 font-bold text-base text-white shrink-0">
          <span className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center text-[11px] font-black text-white">
            N
          </span>
          <span className="tracking-tight">
            News<span className="text-emerald-400">Narrative</span>
          </span>
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

        {/* Right: live + hamburger */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:block">Live</span>
          </div>
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden flex flex-col gap-1 p-2 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-0.5 bg-slate-300 transition-transform origin-center ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <span className={`block w-5 h-0.5 bg-slate-300 transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-slate-300 transition-transform origin-center ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 py-3 space-y-1">
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
        </div>
      )}
    </nav>
  )
}

