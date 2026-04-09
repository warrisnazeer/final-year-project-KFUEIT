import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Outlets from './pages/Outlets'
import Articles from './pages/Articles'
import Stories from './pages/Stories'
import StoryDetail from './pages/StoryDetail'
import Blindspot from './pages/Blindspot'
import HowItWorks from './pages/HowItWorks'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-brand-bg">
        <Navbar />
        <main>
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/outlets"       element={<Outlets />} />
            <Route path="/articles"      element={<Articles />} />
            <Route path="/stories"       element={<Stories />} />
            <Route path="/stories/:id"   element={<StoryDetail />} />
            <Route path="/blindspot"      element={<Blindspot />} />
            <Route path="/how-it-works"  element={<HowItWorks />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
