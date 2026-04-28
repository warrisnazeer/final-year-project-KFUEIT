import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState('premium')
  const [error, setError]       = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [loading, setLoading]   = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    if (isLogin) {
      try {
        await login(username, password)
        navigate('/')
      } catch (err) {
        setError(err?.response?.data?.detail || 'Login failed. Check your credentials.')
      } finally {
        setLoading(false)
      }
    } else {
      // Mock signup process for frontend demonstration
      setTimeout(() => {
        setLoading(false)
        setSuccessMsg('Registration feature is currently in demo mode. Payment gateway integration coming soon.')
      }, 1500)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50/30 to-cyan-50/40 px-4 py-8">
      <div className="w-full max-w-md">

        {/* Logo area */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="News Narrative Logo" className="h-20 scale-[2.5] mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-slate-900">{isLogin ? 'Welcome back' : 'Create an account'}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isLogin ? 'Sign in to your News Narrative account' : 'Join our premium news analysis platform'}
          </p>
        </div>

        {/* Toggle tabs */}
        <div className="flex bg-slate-200/50 p-1 rounded-xl mb-6 mx-auto max-w-[240px]">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(null); setSuccessMsg(null); }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${isLogin ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(null); setSuccessMsg(null); }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${!isLogin ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Sign Up
          </button>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required={!isLogin}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5
                           text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                           focus:ring-sky-500/20 focus:border-sky-400 transition-all"
                placeholder="Enter email address"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus={isLogin}
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

          {!isLogin && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wider">Select Plan</label>
              <div className="grid grid-cols-2 gap-3">
                <div 
                  onClick={() => setPlan('free')}
                  className={`border rounded-xl p-3 cursor-pointer transition-all ${plan === 'free' ? 'border-sky-500 bg-sky-50/50 ring-1 ring-sky-500' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="font-semibold text-slate-800 text-sm">Basic</div>
                  <div className="text-xs text-slate-500 mt-0.5">Free forever</div>
                </div>
                <div 
                  onClick={() => setPlan('premium')}
                  className={`border rounded-xl p-3 cursor-pointer transition-all relative overflow-hidden ${plan === 'premium' ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl-lg">PRO</div>
                  <div className="font-semibold text-slate-800 text-sm">Premium</div>
                  <div className="text-xs text-slate-500 mt-0.5">$9.99/month</div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-2.5 font-medium">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl px-4 py-2.5 font-medium">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700
                       text-white rounded-xl font-semibold text-sm shadow-md shadow-sky-500/20
                       hover:shadow-lg hover:shadow-sky-500/30 active:scale-[0.98]
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
          >
            {loading ? (
               <span className="flex items-center justify-center gap-2">
                 <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 {isLogin ? 'Signing in…' : 'Processing…'}
               </span>
            ) : (
              isLogin ? 'Sign in' : 'Complete Registration'
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
