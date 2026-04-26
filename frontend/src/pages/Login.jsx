import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50/30 to-cyan-50/40 px-4">
      <div className="w-full max-w-sm">

        {/* Logo area */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="News Narrative Logo" className="h-20 scale-[2.5] mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your News Narrative account</p>
        </div>

        {/* Login card */}
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5
                         text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                         focus:ring-sky-500/20 focus:border-sky-400 transition-all"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5
                         text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                         focus:ring-sky-500/20 focus:border-sky-400 transition-all"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-2.5 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700
                       text-white rounded-xl font-semibold text-sm shadow-md shadow-sky-500/20
                       hover:shadow-lg hover:shadow-sky-500/30 active:scale-[0.98]
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-400 mt-6">
          News Narrative — Pakistani Media Bias Analysis Platform
        </p>
      </div>
    </div>
  )
}
