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
        <Link to="/" className="flex items-center gap-1.5 font-bold text-base text-slate-900 shrink-0">
          <span className="w-6 h-6 rounded bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center text-[11px] font-black text-white shadow-sm">
            N
          </span>
          <span className="tracking-tight">
            News<span className="text-sky-600">Narrative</span>
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
        </div>
      )}
    </nav>
  )
}

