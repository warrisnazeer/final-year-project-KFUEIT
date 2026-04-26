import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardStats, getStoryFeed, triggerScrape, getTopicTrends, getDiversity, getBookmarks } from '../api/client'
import StoryFeedCard from '../components/StoryFeedCard'
import SkeletonCard from '../components/SkeletonCard'
import { useAuth } from '../context/AuthContext'

const TOPICS = ['All', 'Politics', 'Economy', 'Security', 'International', 'Sports', 'Business', 'Ceasefire']

// Read diversity from localStorage
function readDiversity() {
  try {
    const d = JSON.parse(localStorage.getItem('nn_div') || 'null')
    if (d && (d.L + d.C + d.R) > 0) return d
  } catch {}
  return null
}

export default function Dashboard() {
  const { isLoggedIn } = useAuth()
  const [stories, setStories]     = useState([])
  const [stats, setStats]         = useState(null)
  const [trends, setTrends]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [scraping, setScraping]   = useState(false)
  const [error, setError]         = useState(null)
  const [activeTopic, setTopic]   = useState('All')
  const [search, setSearch]       = useState('')
  const [diversity, setDiversity] = useState(null)
  const [savedStories, setSavedStories] = useState([])

  const loadData = async (topic = activeTopic) => {
    try {
      const [feedRes, statsRes, trendsRes] = await Promise.all([
        getStoryFeed(40, 0, topic),
        getDashboardStats(),
        getTopicTrends(7),
      ])
      setStories(feedRes.data)
      setStats(statsRes.data)
      setTrends(trendsRes.data || [])
    } catch {
      setError('Failed to load stories. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // Load diversity from API if logged in, otherwise localStorage
    if (isLoggedIn) {
      getDiversity().then(r => {
        const d = r.data
        setDiversity({ L: d.left, C: d.center, R: d.right, n: d.total_read })
      }).catch(() => setDiversity(readDiversity()))
      getBookmarks().then(r => setSavedStories(r.data)).catch(() => {})
    } else {
      setDiversity(readDiversity())
    }
  }, [])

  const handleScrape = async () => {
    setScraping(true)
    try {
      await triggerScrape()
      setTimeout(() => { loadData(); setScraping(false) }, 6000)
    } catch {
      setScraping(false)
    }
  }

  // Client-side search filter
  const displayStories = useMemo(() => {
    if (!search.trim()) return stories
    const q = search.trim().toLowerCase()
    return stories.filter(s => s.story_title?.toLowerCase().includes(q))
  }, [stories, search])

  // Diversity score computation
  const divScore = useMemo(() => {
    if (!diversity) return null
    const total = diversity.L + diversity.C + diversity.R || 1
    return {
      lPct: Math.round(diversity.L / total * 100),
      cPct: Math.round(diversity.C / total * 100),
      rPct: Math.round(diversity.R / total * 100),
      n:    diversity.n || 0,
    }
  }, [diversity])

  if (loading) return (
    <div className="min-h-screen bg-brand-bg">
      <div className="bg-white border-b border-brand-border h-11" />
      <div className="border-b border-brand-border h-10" />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="lg:grid lg:grid-cols-[240px_1fr] gap-6">
          <div className="hidden lg:block">
            <div className="bg-white border border-brand-border rounded-xl p-4 animate-pulse space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-3 bg-stone-200 rounded" />)}
            </div>
          </div>
          <div>
            <SkeletonCard featured />
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-5">
              {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-center text-brand-muted max-w-md px-4">
        <p className="text-2xl mb-3">⚠️</p>
        <p className="text-sm">{error}</p>
      </div>
    </div>
  )

  const bias = stats?.bias_distribution || {}
  const [featuredStory, ...restStories] = displayStories
  const maxTrend = trends[0]?.count || 1

  return (
    <div className="min-h-screen bg-slate-50 text-stone-900">

      {/* ── Top stats + scrape bar ── */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 pt-4 pb-3 px-4 sticky top-[60px] z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {stats && (
              <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-2.5 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-0.5">Stories</span>
                  <span className="font-black text-slate-800 text-xl leading-none">{stats.total_stories}</span>
                </div>
                <div className="w-px h-8 bg-slate-100" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-0.5">Articles</span>
                  <span className="font-black text-slate-800 text-xl leading-none">{stats.total_articles}</span>
                </div>
                <div className="w-px h-8 bg-slate-100" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-0.5">Outlets</span>
                  <span className="font-black text-slate-800 text-xl leading-none">{stats.total_outlets}</span>
                </div>
              </div>
            )}
            
            {/* Bias summary pills */}
            {stats && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {bias.Left ?? 0} Left
                </span>
                <span className="bg-teal-50 text-teal-700 border border-teal-100 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> {bias.Center ?? 0} Center
                </span>
                <span className="bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {bias.Right ?? 0} Right
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            {/* Search bar */}
            <div className="relative flex-1 lg:w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search stories…"
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2.5
                           text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                           focus:ring-sky-500/20 focus:border-sky-400 shadow-sm transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Refresh button */}
            <button
              onClick={handleScrape}
              disabled={scraping}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2"
            >
              {scraping ? (
                <><span className="animate-spin text-lg leading-none">⟳</span> Scraping…</>
              ) : (
                <><span className="text-lg leading-none">↻</span> Refresh</>
              )}
            </button>
          </div>
        </div>

        {/* ── Topic chips ── */}
        <div className="max-w-7xl mx-auto mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {TOPICS.map(t => (
            <button
              key={t}
              onClick={() => { setSearch(''); setTopic(t); loadData(t) }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0
                ${activeTopic === t
                    ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-white shadow-md shadow-sky-500/20 ring-1 ring-sky-400'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      {displayStories.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400 px-4">
          <p className="text-5xl mb-5 opacity-50">📰</p>
          <p className="text-xl font-bold mb-2 text-slate-700">No multi-outlet stories yet</p>
          <p className="text-sm">Click “Refresh” to scrape Pakistani news outlets.</p>
        </div>
      ) : displayStories.length === 0 && search ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400 px-4">
          <p className="text-5xl mb-5 opacity-50">🔍</p>
          <p className="text-xl font-bold mb-2 text-slate-700">No stories match "{search}"</p>
          <button onClick={() => setSearch('')} className="mt-2 text-sm font-semibold bg-white border border-slate-200 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm">Clear search</button>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-8 nn-reveal">
          <div className="lg:grid lg:grid-cols-[260px_1fr] gap-8">

            {/* ── Daily Briefing sidebar ── */}
            <div className="hidden lg:block">
              <div className="bg-gradient-to-b from-white to-slate-50/50 border border-slate-200/80 rounded-3xl p-6 sticky top-[160px] space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">
                    Daily Briefing
                  </h2>
                </div>

                {/* Reading Diversity Score */}
                {isLoggedIn ? (
                  divScore && (
                    <div className="pb-5 border-b border-slate-200/70">
                      <p className="text-xs font-bold text-slate-500 mb-3">Your Reading Diversity</p>
                      <div className="flex rounded-full overflow-hidden h-2.5 mb-2 shadow-inner bg-slate-100">
                        {divScore.lPct > 0 && <div style={{width:`${divScore.lPct}%`}} className="bg-blue-500" />}
                        {divScore.cPct > 0 && <div style={{width:`${divScore.cPct}%`}} className="bg-teal-400" />}
                        {divScore.rPct > 0 && <div style={{width:`${divScore.rPct}%`}} className="bg-red-500" />}
                      </div>
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-blue-600">{divScore.lPct}% L</span>
                        <span className="text-teal-600">{divScore.cPct}% C</span>
                        <span className="text-red-600">{divScore.rPct}% R</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">{divScore.n} stories read</p>
                    </div>
                  )
                ) : (
                  <div className="pb-5 border-b border-slate-200/70">
                    <p className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                      <span className="text-sm">🔒</span> Your Reading Diversity
                    </p>
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-4 text-center">
                      <p className="text-[10px] text-slate-500 font-medium mb-2">Track your reading habits and political bias diet permanently.</p>
                      <Link to="/login" className="text-[10px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1 rounded-lg">Sign in to unlock</Link>
                    </div>
                  </div>
                )}

                {/* Topic Trends */}
                {trends.length > 0 && (
                  <div className="pb-5 border-b border-slate-200/70">
                    <p className="text-xs font-bold text-slate-500 mb-3">Trending Topics</p>
                    <div className="space-y-2.5">
                      {trends.slice(0, 6).map(t => (
                        <div key={t.topic} className="flex items-center gap-3">
                          <span
                            className="text-[10px] font-bold text-slate-600 shrink-0 cursor-pointer hover:text-sky-600 transition-colors"
                            style={{width: '65px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}
                            onClick={() => { setTopic(t.topic); loadData(t.topic) }}
                          >{t.topic}</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div
                              className="h-full bg-gradient-to-r from-sky-400 to-cyan-400 rounded-full transition-all"
                              style={{width:`${Math.round(t.count/maxTrend*100)}%`}}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 w-4 text-right shrink-0">{t.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Saved Stories (logged in only) */}
                {isLoggedIn ? (
                  savedStories.length > 0 && (
                    <div className="pb-5 border-b border-slate-200/70">
                      <p className="text-xs font-bold text-slate-500 mb-3">★ Saved Stories</p>
                      <ol className="space-y-3">
                        {savedStories.slice(0, 5).map(s => (
                          <li key={s.story_id} className="group cursor-pointer">
                            <Link
                              to={`/stories/${s.story_id}`}
                              className="text-xs font-medium text-slate-600 group-hover:text-amber-600 leading-snug line-clamp-2 transition-colors"
                            >
                              {s.story_title}
                            </Link>
                            <span className="text-[9px] text-slate-400">{s.outlet_count} sources</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )
                ) : (
                  <div className="pb-5 border-b border-slate-200/70">
                    <p className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                      <span className="text-sm">🔒</span> Saved Stories
                    </p>
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-4 text-center">
                      <p className="text-[10px] text-slate-500 font-medium mb-2">Build a library of stories to revisit and track over time.</p>
                      <Link to="/login" className="text-[10px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1 rounded-lg">Sign in to unlock</Link>
                    </div>
                  </div>
                )}

                {/* Story index list */}
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-3">Top Stories</p>
                  <ol className="space-y-3">
                    {stories.slice(0, 6).map((s, i) => (
                      <li key={s.story_id} className="flex gap-2.5 group cursor-pointer">
                        <span className="text-[10px] text-sky-500 font-bold mt-0.5 shrink-0 w-3">{i + 1}.</span>
                        <Link
                          to={`/stories/${s.story_id}`}
                          className="text-xs font-medium text-slate-600 group-hover:text-sky-600 leading-snug line-clamp-2 transition-colors"
                        >
                          {s.story_title}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            {/* ── Story feed ── */}
            <div className="min-w-0">
              {search && (
                <div className="flex items-center gap-2 mb-4 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm w-fit">
                  <span className="text-sm font-medium text-slate-600">
                    {displayStories.length} result{displayStories.length !== 1 ? 's' : ''} for
                  </span>
                  <span className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded-md">"{search}"</span>
                </div>
              )}

              {/* Featured story */}
              {featuredStory && (
                <div className="mb-8 relative">
                  <div className="absolute -inset-x-4 -inset-y-4 bg-gradient-to-b from-sky-50/50 to-transparent -z-10 rounded-3xl" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-sky-600 mb-3 flex items-center gap-2">
                    <span className="w-4 h-[2px] bg-sky-600" /> Editor's Pick
                  </p>
                  <StoryFeedCard story={featuredStory} featured />
                </div>
              )}

              {/* Story grid */}
              {restStories.length > 0 && (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                    <span className="w-4 h-[2px] bg-slate-300" /> Latest Coverage
                  </p>
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {restStories.map(s => (
                      <StoryFeedCard key={s.story_id} story={s} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
