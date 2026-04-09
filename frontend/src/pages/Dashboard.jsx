import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardStats, getStoryFeed, triggerScrape, getTopicTrends } from '../api/client'
import StoryFeedCard from '../components/StoryFeedCard'
import SkeletonCard from '../components/SkeletonCard'

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
  const [stories, setStories]     = useState([])
  const [stats, setStats]         = useState(null)
  const [trends, setTrends]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [scraping, setScraping]   = useState(false)
  const [error, setError]         = useState(null)
  const [activeTopic, setTopic]   = useState('All')
  const [search, setSearch]       = useState('')
  const [diversity, setDiversity] = useState(null)

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
    setDiversity(readDiversity())
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
    <div className="min-h-screen bg-brand-bg text-stone-900">

      {/* ── Top stats + scrape bar ── */}
      <div className="bg-white border-b border-brand-border py-3 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6 text-sm">
            {stats && (
              <>
                <span className="text-brand-muted">
                  <span className="font-bold text-stone-900">{stats.total_stories}</span>
                  <span className="text-brand-muted ml-1">stories</span>
                </span>
                <span className="text-brand-muted">
                  <span className="font-bold text-stone-900">{stats.total_articles}</span>
                  <span className="text-brand-muted ml-1">articles</span>
                </span>
                <span className="text-brand-muted">
                  <span className="font-bold text-stone-900">{stats.total_outlets}</span>
                  <span className="text-brand-muted ml-1">outlets</span>
                </span>
                <span className="hidden sm:flex items-center gap-3 ml-2">
                  <span className="text-blue-600 font-semibold">{bias.Left ?? 0}L</span>
                  <span className="text-amber-700 font-semibold">{bias.Center ?? 0}C</span>
                  <span className="text-red-600 font-semibold">{bias.Right ?? 0}R</span>
                </span>
              </>
            )}
          </div>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="px-4 py-1.5 bg-gold-DEFAULT hover:bg-gold-dark disabled:bg-stone-200
                       disabled:text-stone-400 text-white rounded-lg text-sm font-medium
                       transition-colors cursor-pointer shrink-0 shadow-sm"
          >
            {scraping ? '⟳ Scraping…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* ── Search + Topic chips ── */}
      <div className="border-b border-brand-border px-4 bg-white">
        <div className="max-w-7xl mx-auto py-2 space-y-2">
          {/* Search bar */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search stories…"
              className="w-full bg-stone-50 border border-brand-border rounded-lg pl-9 pr-4 py-1.5
                         text-sm text-stone-800 placeholder-stone-400 focus:outline-none
                         focus:border-gold-mid focus:bg-white transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-stone-700 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          {/* Topic chips */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {TOPICS.map(t => (
              <button
                key={t}
                onClick={() => { setSearch(''); setTopic(t); loadData(t) }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0
                  ${activeTopic === t
                    ? 'bg-gold-DEFAULT text-white shadow-sm'
                    : 'text-brand-muted hover:text-stone-900 hover:bg-stone-100'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      {displayStories.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center py-32 text-brand-muted px-4">
          <p className="text-4xl mb-4">📰</p>
          <p className="text-lg font-medium mb-2 text-stone-700">No multi-outlet stories yet</p>
          <p className="text-sm">Click “Refresh” to scrape Pakistani news outlets.</p>
        </div>
      ) : displayStories.length === 0 && search ? (
        <div className="flex flex-col items-center justify-center py-32 text-brand-muted px-4">
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-lg font-medium mb-2 text-stone-700">No stories match "{search}"</p>
          <button onClick={() => setSearch('')} className="text-sm text-gold-DEFAULT hover:underline cursor-pointer">Clear search</button>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="lg:grid lg:grid-cols-[240px_1fr] gap-6">

            {/* ── Daily Briefing sidebar ── */}
            <div className="hidden lg:block">
              <div className="bg-white border border-brand-border rounded-xl p-4 sticky top-4 space-y-4 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-widest text-brand-muted">
                  Daily Briefing
                </h2>

                {/* Summary stats */}
                <div className="space-y-2.5 pb-4 border-b border-brand-border">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-brand-muted">Stories</span>
                    <span className="text-sm font-bold text-stone-900">{stats?.total_stories}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-brand-muted">Articles</span>
                    <span className="text-sm font-bold text-stone-900">{stats?.total_articles}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-brand-muted">Outlets</span>
                    <span className="text-sm font-bold text-stone-900">{stats?.total_outlets}</span>
                  </div>
                </div>

                {/* Overall Bias bar */}
                {stats && (
                  <div className="pb-4 border-b border-brand-border">
                    <p className="text-xs text-brand-muted mb-2">Overall Bias</p>
                    <div className="flex rounded overflow-hidden h-5 text-[10px] font-semibold">
                      {(bias.Left   ?? 0) > 0 && (
                        <div className="bg-blue-500 text-white flex items-center justify-center"
                          style={{ width: `${((bias.Left ?? 0) / (stats.total_articles || 1)) * 100}%` }}>
                          L
                        </div>
                      )}
                      {(bias.Center ?? 0) > 0 && (
                        <div className="bg-amber-400 text-white flex items-center justify-center flex-1">
                          C
                        </div>
                      )}
                      {(bias.Right  ?? 0) > 0 && (
                        <div className="bg-red-500 text-white flex items-center justify-center"
                          style={{ width: `${((bias.Right ?? 0) / (stats.total_articles || 1)) * 100}%` }}>
                          R
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-[10px] text-brand-muted mt-1">
                      <span className="text-blue-600">{bias.Left ?? 0} left</span>
                      <span>{bias.Center ?? 0} center</span>
                      <span className="text-red-600">{bias.Right ?? 0} right</span>
                    </div>
                  </div>
                )}

                {/* Reading Diversity Score */}
                {divScore && (
                  <div className="pb-4 border-b border-brand-border">
                    <p className="text-xs text-brand-muted mb-2">Your Reading Diversity</p>
                    <div className="flex rounded overflow-hidden h-3">
                      {divScore.lPct > 0 && <div style={{width:`${divScore.lPct}%`}} className="bg-blue-500" />}
                      {divScore.cPct > 0 && <div style={{width:`${divScore.cPct}%`}} className="bg-amber-400" />}
                      {divScore.rPct > 0 && <div style={{width:`${divScore.rPct}%`}} className="bg-red-500" />}
                    </div>
                    <div className="flex justify-between text-[10px] mt-1">
                      <span className="text-blue-600">{divScore.lPct}% L</span>
                      <span className="text-brand-muted">{divScore.cPct}% C</span>
                      <span className="text-red-600">{divScore.rPct}% R</span>
                    </div>
                    <p className="text-[10px] text-brand-muted mt-0.5">{divScore.n} stories read</p>
                  </div>
                )}

                {/* Topic Trends */}
                {trends.length > 0 && (
                  <div className="pb-4 border-b border-brand-border">
                    <p className="text-xs text-brand-muted mb-2">Topics (7 days)</p>
                    <div className="space-y-1.5">
                      {trends.slice(0, 6).map(t => (
                        <div key={t.topic} className="flex items-center gap-2">
                          <span
                            className="text-[10px] text-brand-muted shrink-0 cursor-pointer hover:text-gold-dark transition-colors"
                            style={{width: '62px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}
                            onClick={() => { setTopic(t.topic); loadData(t.topic) }}
                          >{t.topic}</span>
                          <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gold-DEFAULT rounded-full transition-all"
                              style={{width:`${Math.round(t.count/maxTrend*100)}%`}}
                            />
                          </div>
                          <span className="text-[10px] text-brand-muted w-4 text-right shrink-0">{t.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Story index list */}
                <div>
                  <p className="text-xs text-brand-muted mb-2">Top Stories</p>
                  <ol className="space-y-3">
                    {stories.slice(0, 8).map((s, i) => (
                      <li key={s.story_id} className="flex gap-2">
                        <span className="text-xs text-gold-mid font-mono mt-0.5 shrink-0 w-4">{i + 1}.</span>
                        <Link
                          to={`/stories/${s.story_id}`}
                          className="text-xs text-stone-600 hover:text-gold-dark leading-snug line-clamp-2 transition-colors"
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
            <div>
              {search && (
                <p className="text-xs text-brand-muted mb-3">
                  {displayStories.length} result{displayStories.length !== 1 ? 's' : ''} for
                  <span className="text-stone-800 font-medium ml-1">"{search}"</span>
                </p>
              )}

              {/* Featured story */}
              {featuredStory && (
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">
                    Top Story
                  </p>
                  <StoryFeedCard story={featuredStory} featured />
                </div>
              )}

              {/* Story grid */}
              {restStories.length > 0 && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">
                    More Stories
                  </p>
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
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
