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
        ? 'bg-amber-100 text-amber-800 border border-amber-300'
        : 'text-amber-700 hover:text-amber-900 hover:bg-amber-50'
    if (label === 'How It Works')
      return isActive
        ? 'bg-stone-100 text-stone-800'
        : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
    return isActive
      ? 'bg-gold-light text-gold-dark font-semibold'
      : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
  }

  return (
    <nav className="bg-white border-b border-brand-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-13">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-base text-stone-900 shrink-0">
          <span className="w-6 h-6 rounded bg-gold-DEFAULT flex items-center justify-center text-[11px] font-black text-white shadow-sm">
            N
          </span>
          <span className="tracking-tight">
            News<span className="text-gold-DEFAULT">Narrative</span>
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
          <div className="flex items-center gap-1.5 text-xs text-stone-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-DEFAULT animate-pulse" />
            <span className="hidden sm:block">Live</span>
          </div>
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden flex flex-col gap-1 p-2 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-0.5 bg-stone-600 transition-transform origin-center ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <span className={`block w-5 h-0.5 bg-stone-600 transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-stone-600 transition-transform origin-center ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
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

