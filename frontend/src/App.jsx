import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Outlets from './pages/Outlets'
import Articles from './pages/Articles'
import Stories from './pages/Stories'
import StoryDetail from './pages/StoryDetail'
import Blindspot from './pages/Blindspot'
import HowItWorks from './pages/HowItWorks'
import Login from './pages/Login'
import History from './pages/History'

function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-brand-bg"></div>
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-brand-bg text-slate-900">
          <Navbar />
          <main className="relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-cyan-100/40 via-sky-100/30 to-transparent" />
            <Routes>
              <Route path="/"              element={<Dashboard />} />
              <Route path="/outlets"       element={<Outlets />} />
              <Route path="/articles"      element={<Articles />} />
              <Route path="/stories"       element={<Stories />} />
              <Route path="/stories/:id"   element={<StoryDetail />} />
              <Route path="/history"       element={<ProtectedRoute><History /></ProtectedRoute>} />
              <Route path="/blindspot"      element={<Blindspot />} />
              <Route path="/how-it-works"  element={<HowItWorks />} />
              <Route path="/login"         element={<Login />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
