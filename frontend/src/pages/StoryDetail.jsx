import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getStoryDetail, summarizeStory, expandStory, runDeepBias, markStoryRead, toggleBookmark, getBookmarkIds } from '../api/client'
import { BiasBadge, ToneBadge, FactualityBadge, BIAS_5 } from '../components/Badges'
import CoverageBar from '../components/CoverageBar'
import { useAuth } from '../context/AuthContext'

const LEFT_LABELS  = new Set(['Far Left',  'Lean Left',  'Left'])
const RIGHT_LABELS = new Set(['Far Right', 'Lean Right', 'Right'])

const TABS = ['All', 'Bias Comparison']

function timeAgo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// Track reading diversity in localStorage
function trackDiversity(story) {
  try {
    const d = JSON.parse(localStorage.getItem('nn_div') || '{"L":0,"C":0,"R":0,"n":0}')
    d.L = (d.L || 0) + (story.left_count || 0)
    d.C = (d.C || 0) + (story.center_count || 0)
    d.R = (d.R || 0) + (story.right_count || 0)
    d.n = (d.n || 0) + 1
    localStorage.setItem('nn_div', JSON.stringify(d))
  } catch {}
}

function StatRow({ label, value, color = 'text-slate-900' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-brand-muted">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  )
}

function ArticleCard({ article }) {
  const c = BIAS_5[article.bias_label] || BIAS_5['Center']
  const score = article.bias_score ?? null
  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border} transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={`text-xs font-bold uppercase tracking-wider ${c.text} shrink-0`}>
          {article.outlet}
        </span>
        {article.publish_date && (
          <span className="text-[10px] text-brand-muted shrink-0 ml-1">{timeAgo(article.publish_date)}</span>
        )}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <BiasBadge label={article.bias_label} score={score} short />
          <ToneBadge tone={article.framing_tone} />
          {article.factuality && <FactualityBadge rating={article.factuality} />}
        </div>
      </div>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-slate-800 hover:text-sky-700 leading-snug block mb-2"
      >
        {article.title}
        <span className="text-brand-muted ml-1 text-xs">&#x2197;</span>
      </a>
      {score !== null && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 bg-stone-200 rounded-full h-1">
            <div
              className="h-1 rounded-full"
              style={{
                width: `${Math.abs(score) * 100}%`,
                background: c.hex || '#64748b',
                marginLeft: score < 0 ? 'auto' : 0
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-brand-muted shrink-0">
            {score >= 0 ? '+' : ''}{score.toFixed(3)}
          </span>
        </div>
      )}
    </div>
  )
}

export default function StoryDetail() {
  const { id } = useParams()
  const { isLoggedIn } = useAuth()
  const [story, setStory]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [summarizing, setSummarizing] = useState(false)
  const [searching, setSearching]     = useState(false)
  const [summaryErr, setSummaryErr]   = useState(null)
  const [deepBiasing, setDeepBiasing] = useState(false)
  const [deepBiasErr, setDeepBiasErr] = useState(null)
  const [activeTab, setActiveTab]     = useState('All')
  const [bookmarked, setBookmarked]   = useState(false)

  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleBookmark = async () => {
    if (!isLoggedIn) return
    try {
      const res = await toggleBookmark(id)
      setBookmarked(res.data.bookmarked)
    } catch {}
  }

  const loadStory = async () => {
    try {
      const res = await getStoryDetail(id)
      setStory(res.data)
      trackDiversity(res.data)
      // Auto-track reading if logged in
      if (isLoggedIn) {
        markStoryRead(id).catch(() => {})
        // Check bookmark status
        getBookmarkIds().then(r => {
          setBookmarked(r.data.includes(parseInt(id)))
        }).catch(() => {})
      }
    } catch {
      setStory(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDeepBias = async () => {
    setDeepBiasErr(null)
    setDeepBiasing(true)
    try {
      const res = await runDeepBias(id)
      setStory(res.data)
      trackDiversity(res.data)
      // Auto-regenerate summary so framing text matches new scores
      try {
        await summarizeStory(id)
        const updated = await getStoryDetail(id)
        setStory(updated.data)
      } catch {}
    } catch (err) {
      setDeepBiasErr("Narrative Engine failed or limit reached.")
      console.error(err)
    } finally {
      setDeepBiasing(false)
    }
  }

  const generateSummary = async (manual = true) => {
    if (manual) setSummaryErr(null)
    setSummarizing(true)
    try {
      await summarizeStory(id)
      const res = await getStoryDetail(id)
      setStory(res.data)
    } catch (err) {
      const detail = err?.response?.data?.detail || ''
      if (manual) {
        if (err?.response?.status === 503 || detail.toLowerCase().includes('quota')) {
          setSummaryErr('Analysis Model rate limit reached. Try again in a minute.')
        } else {
          setSummaryErr('Could not generate summary. Check Analysis Model API key.')
        }
      }
    } finally {
      setSummarizing(false)
    }
  }

  const handleExpand = async () => {
    setSearching(true)
    try {
      const res = await expandStory(id)
      setStory(res.data)
      // Auto-trigger diversity tracking if new articles added
      trackDiversity(res.data)
    } catch (err) {
      console.error('Expansion failed:', err)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => { loadStory() }, [id])

  if (loading) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!story) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-center text-brand-muted">
        <p className="text-lg mb-3">Story not found.</p>
        <Link to="/" className="text-sky-600 hover:underline">&larr; Back to Feed</Link>
      </div>
    </div>
  )

  const sorted = [...(story.articles || [])].sort(
    (a, b) => (a.bias_score ?? 0) - (b.bias_score ?? 0)
  )
  const filteredArticles =
    activeTab === 'All' || activeTab === 'Bias Comparison'
      ? sorted
      : activeTab === 'Left'
      ? sorted.filter(a => LEFT_LABELS.has(a.bias_label))
      : activeTab === 'Right'
      ? sorted.filter(a => RIGHT_LABELS.has(a.bias_label))
      : sorted.filter(a => a.bias_label === 'Center')

  const positions    = story.outlet_positions || []
  const farLeftCnt   = positions.filter(o => o.bias_label === 'Far Left').length
  const leanLeftCnt  = positions.filter(o => o.bias_label === 'Lean Left').length
  const centerCnt    = positions.filter(o => o.bias_label === 'Center').length
  const leanRightCnt = positions.filter(o => o.bias_label === 'Lean Right').length
  const farRightCnt  = positions.filter(o => o.bias_label === 'Far Right').length
  const posTotal     = positions.length || 1

  const farLeftPct   = Math.round((farLeftCnt   / posTotal) * 100)
  const leanLeftPct  = Math.round((leanLeftCnt  / posTotal) * 100)
  const centerPct    = Math.round((centerCnt    / posTotal) * 100)
  const leanRightPct = Math.round((leanRightCnt / posTotal) * 100)
  const farRightPct  = 100 - farLeftPct - leanLeftPct - centerPct - leanRightPct

  const summary = story.summary
  const bulletFacts = summary?.neutral_summary
    ? summary.neutral_summary.split('|').map(f => f.trim()).filter(Boolean)
    : []
  const keyActors = summary?.key_actors
    ? summary.key_actors.split('|').map(a => a.trim()).filter(Boolean)
    : []

  return (
    <div className="min-h-screen bg-brand-bg pb-20 nn-reveal">

      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-brand-border shadow-[0_10px_30px_-24px_rgba(2,6,23,0.5)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-brand-muted hover:text-slate-900 text-sm transition-colors">
            &larr; Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-brand-muted text-xs hidden sm:block">{timeAgo(story.latest_date)}</span>
            {isLoggedIn && (
              <button
                onClick={handleBookmark}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  bookmarked
                    ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {bookmarked ? '★ Saved' : '☆ Save'}
              </button>
            )}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1 bg-sky-50 hover:bg-sky-100 border border-sky-200
                         text-sky-700 hover:text-sky-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              {copied ? '✓ Copied!' : '⤴ Share'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6">

        {/* Story hero */}
        <div className={`relative overflow-hidden rounded-2xl border border-brand-border mb-5 ${story.cover_image ? 'h-[300px] md:h-[360px]' : 'bg-white p-6 md:p-8'}`}>
          {story.cover_image ? (
            <>
              <img
                src={story.cover_image}
                alt={story.story_title}
                className="w-full h-full object-cover"
                onError={e => { e.target.style.display = 'none' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/35 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
                <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
                  <span className="bg-white/20 text-white backdrop-blur-sm border border-white/30 px-2.5 py-1 rounded-full font-semibold">
                    {story.outlet_count} sources
                  </span>
                  <span className="bg-white/20 text-white backdrop-blur-sm border border-white/30 px-2.5 py-1 rounded-full font-semibold">
                    {story.article_count} articles
                  </span>
                  {story.topic_tag && story.topic_tag !== 'General' && (
                    <span className="bg-cyan-300/90 text-cyan-950 px-2.5 py-1 rounded-full font-semibold">
                      {story.topic_tag}
                    </span>
                  )}
                </div>
                <h1 className="text-white text-2xl md:text-4xl font-bold leading-tight max-w-4xl">
                  {summary?.story_title || story.story_title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs mt-3 text-slate-100/90">
                  {story.left_count > 0 && <span className="text-blue-200 font-semibold">{story.left_count} Left</span>}
                  {story.center_count > 0 && <span className="text-teal-200 font-semibold">{story.center_count} Center</span>}
                  {story.right_count > 0 && <span className="text-red-200 font-semibold">{story.right_count} Right</span>}
                </div>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight mb-3">
                {summary?.story_title || story.story_title}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-brand-muted">
                <span className="font-medium text-slate-700">{story.outlet_count} sources</span>
                <span>&middot;</span>
                <span>{story.article_count} articles</span>
                {story.topic_tag && story.topic_tag !== 'General' && (
                  <>
                    <span>&middot;</span>
                    <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full border border-sky-200">
                      {story.topic_tag}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Blindspot banner */}
        {story.blindspot_side && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-3">
            <span className="text-amber-700 font-bold text-sm shrink-0">&#x26A0; Blindspot</span>
            <span className="text-xs text-amber-800">
              This story has little or no coverage from{' '}
              {story.blindspot_side === 'Left' ? 'left-leaning' : 'right-leaning'} outlets.
            </span>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 bg-white border border-brand-border rounded-xl p-1.5 w-fit mb-6 overflow-x-auto shadow-sm">
          {TABS.map(tab => {
            const isActive = activeTab === tab
            const activeCls = isActive
              ? tab === 'Left'   ? 'bg-blue-600 text-white shadow-sm'
              : tab === 'Right'  ? 'bg-red-600 text-white shadow-sm'
              : tab === 'Center' ? 'bg-teal-500 text-white shadow-sm'
              :                   'bg-gradient-to-r from-cyan-500 to-sky-500 text-white shadow-sm'
              : 'text-brand-muted hover:text-slate-900 hover:bg-slate-50'
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${activeCls}`}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {/* Pakistani bias context note */}
        {(() => {
          const biasSkip = story.bias_skip
          return (
            <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed mb-4 ${
              biasSkip
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-white border-brand-border text-brand-muted shadow-sm'
            }`}>
              {biasSkip ? (
                <>
                  <span className="font-semibold text-amber-700">Note:</span> This is a{' '}
                  <span className="font-semibold">{story.topic_tag}</span> story — political
                  bias analysis is <span className="font-semibold">not applicable</span> to
                  this category. All outlets are shown with neutral scores.
                </>
              ) : (
                <>
                  <span className="font-semibold text-stone-600">Pakistani media context:</span>{' '}
                  <span className="text-blue-600 font-medium">Left</span> = liberal / pro-civilian framing
                  (accountability, press freedom, civil liberties).{' '}
                  <span className="text-red-600 font-medium">Right</span> = pro-establishment / security-state
                  framing (national security, law &amp; order, foreign threat narratives).
                  This reflects Pakistan&apos;s actual media landscape — not Western party politics.
                </>
              )}
            </div>
          )
        })()}

        {/* 2-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr_280px] gap-6">

          {/* Left: Main content */}
          <div className="space-y-5 min-w-0">

            {activeTab !== 'Bias Comparison' && summarizing && (
              <div className="bg-white border border-brand-border rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-brand-muted shadow-sm animate-pulse">
                <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <div className="text-center">
                  <span className="text-lg font-bold text-slate-800 block mb-1">Analyzing coverage...</span>
                  <span className="text-xs">Processing multiple viewpoints for a balanced summary.</span>
                </div>
              </div>
            )}

            {activeTab !== 'Bias Comparison' && !summary?.what_happened && !summarizing && (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center shadow-sm">
                <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl">
                  &#10022;
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No AI Analysis yet</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8">
                  Get a neutral summary, key facts, and a bias comparison by running our AI analysis engine.
                </p>
                <button
                  onClick={() => generateSummary(true)}
                  className="px-8 py-3 bg-gradient-to-r from-sky-600 to-blue-700 text-white rounded-xl font-bold 
                             shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.02] active:scale-[0.98] 
                             transition-all cursor-pointer"
                >
                  Generate AI Analysis
                </button>
                {summaryErr && <p className="text-red-500 text-xs mt-4">{summaryErr}</p>}
              </div>
            )}

            {activeTab !== 'Bias Comparison' && summary && summary.what_happened && !summarizing && (
              <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-[0_18px_40px_-28px_rgba(2,132,199,0.4)]">
                {/* Header */}
                <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-brand-border bg-gradient-to-r from-sky-50 to-cyan-50">
                  <span className="text-sky-700 text-base">&#10022;</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-sky-700">AI Analysis</span>
                  <span className="text-[10px] bg-gradient-to-r from-cyan-500 to-sky-500 text-white border border-sky-600 px-2 py-0.5 rounded-full ml-1">
                    Model Summarization
                  </span>
                </div>

                <div className="p-5 space-y-5">
                  {/* What Happened */}
                  {summary.what_happened && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-2">What Happened</p>
                      <p className="text-stone-800 text-sm leading-relaxed">{summary.what_happened}</p>
                    </div>
                  )}

                  {/* Key Actors chips */}
                  {keyActors.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-2">Key Actors</p>
                      <div className="flex flex-wrap gap-2">
                        {keyActors.map((actor, i) => (
                          <span key={i} className="text-xs bg-stone-100 text-stone-700 border border-brand-border px-3 py-1 rounded-full">
                            {actor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Facts bullet list */}
                  {bulletFacts.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-2">Key Facts</p>
                      <ul className="space-y-2">
                        {bulletFacts.map((fact, i) => (
                          <li key={i} className="flex gap-3 text-sm text-stone-800 leading-relaxed">
                            <span className="text-sky-600 shrink-0 mt-0.5 font-bold text-base leading-none">&#8226;</span>
                            {fact}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Why It Matters callout */}
                  {summary.why_it_matters && (
                    <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-cyan-700 mb-2">Why It Matters</p>
                      <p className="text-stone-700 text-sm leading-relaxed">{summary.why_it_matters}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'Bias Comparison' && (
              summary && summary.what_happened ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-1">
                        &#9664; Left / Liberal Framing
                      </p>
                      <p className="text-[10px] text-blue-500 mb-3">pro-civilian · accountability · press freedom</p>
                      <p className="text-stone-800 text-sm leading-relaxed">
                        {summary.left_framing || 'No distinct left framing detected.'}
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-1">
                        Right / Conservative Framing &#9654;
                      </p>
                      <p className="text-[10px] text-red-500 mb-3">pro-establishment · national security · state-aligned</p>
                      <p className="text-stone-800 text-sm leading-relaxed">
                        {summary.right_framing || 'No distinct right framing detected.'}
                      </p>
                    </div>
                  </div>
                  {/* Why It Matters also shown in bias tab */}
                  {summary.why_it_matters && (
                    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-cyan-700 mb-2">Why It Matters</p>
                      <p className="text-stone-700 text-sm leading-relaxed">{summary.why_it_matters}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-brand-border rounded-xl p-10 text-center text-brand-muted">
                  <div className="text-3xl mb-4 opacity-30">&#9680;</div>
                  <p className="text-sm mb-6">Generate an AI summary first to see the bias comparison.</p>
                  <button
                    onClick={() => generateSummary(true)}
                    disabled={summarizing}
                    className="px-6 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    {summarizing ? 'Generating...' : 'Generate Analysis'}
                  </button>
                </div>
              )
            )}

            {/* Article list */}
            <div>
              <h3 className="text-xs uppercase tracking-widest text-brand-muted font-semibold mb-3">
                {activeTab === 'All' || activeTab === 'Bias Comparison'
                  ? `All Coverage (${sorted.length})`
                  : `${activeTab} Coverage (${filteredArticles.length})`}
              </h3>
              {filteredArticles.length === 0 ? (
                <div className="text-center py-10 text-brand-muted bg-white rounded-xl border border-brand-border">
                  <p className="text-sm">No {activeTab.toLowerCase()}-leaning articles for this story.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredArticles.map(article => (
                    <ArticleCard key={article.article_id} article={article} />
                  ))}
                </div>
              )}
            </div>

            {/* Methodology note */}
            <div className="bg-stone-50 border border-brand-border rounded-xl p-4 text-xs text-brand-muted leading-relaxed">
              <strong className="text-stone-700">How bias is measured:</strong> Scores combine
              HuggingFace BART zero-shot classification (60%), Pakistani-context keywords (30%), and
              outlet editorial priors (10%). In Pakistan&apos;s media landscape,{' '}
              <span className="text-blue-600">Left = liberal, pro-civilian, critical of establishment</span>{' '}
              and{' '}
              <span className="text-red-600">Right = pro-establishment, security-state aligned</span>{' '}
              — not Western party affiliations. Score range: &minus;1.0 (Far Left) &rarr; 0.0 (Center) &rarr; +1.0 (Far Right).
              AI summaries generated by Model Summarization.
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-4 mt-6 lg:mt-0">

            {/* Coverage Details */}
            <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-brand-border bg-stone-50">
                <h3 className="text-sm font-semibold text-stone-900">Coverage Details</h3>
              </div>
              <div className="p-4 space-y-3">
                <StatRow label="Total Sources"  value={story.outlet_count} />
                {farLeftCnt   > 0 && <StatRow label="Far Left"   value={farLeftCnt}   color="text-blue-700"  />}
                {leanLeftCnt  > 0 && <StatRow label="Lean Left"  value={leanLeftCnt}  color="text-blue-600"  />}
                {centerCnt    > 0 && <StatRow label="Center"     value={centerCnt}    color="text-teal-700" />}
                {leanRightCnt > 0 && <StatRow label="Lean Right" value={leanRightCnt} color="text-red-600"   />}
                {farRightCnt  > 0 && <StatRow label="Far Right"  value={farRightCnt}  color="text-red-700"   />}
                <StatRow label="Total Articles" value={story.article_count} />
                <StatRow label="Last Updated"   value={timeAgo(story.latest_date)} />
              </div>
              <div className="px-4 pb-1">
                <p className="text-xs font-medium text-brand-muted mb-2">Bias Distribution</p>
              </div>
              {/* 5-segment bias bar */}
              <div className="flex h-7 text-[10px] font-semibold">
                {farLeftPct > 0 && (
                  <div className="bg-blue-700 text-white flex items-center justify-center shrink-0"
                    style={{ width: `${farLeftPct}%` }}>
                    {farLeftPct >= 10 ? `FL ${farLeftPct}%` : farLeftPct >= 5 ? `${farLeftPct}%` : ''}
                  </div>
                )}
                {leanLeftPct > 0 && (
                  <div className="bg-blue-400 text-white flex items-center justify-center shrink-0"
                    style={{ width: `${leanLeftPct}%` }}>
                    {leanLeftPct >= 10 ? `L ${leanLeftPct}%` : leanLeftPct >= 5 ? `${leanLeftPct}%` : ''}
                  </div>
                )}
                {centerPct > 0 && (
                  <div className="bg-teal-400 text-white flex items-center justify-center flex-1"
                    style={{ minWidth: `${centerPct}%` }}>
                    {centerPct >= 15 ? `C ${centerPct}%` : centerPct >= 6 ? `${centerPct}%` : ''}
                  </div>
                )}
                {leanRightPct > 0 && (
                  <div className="bg-red-400 text-white flex items-center justify-center shrink-0"
                    style={{ width: `${leanRightPct}%` }}>
                    {leanRightPct >= 10 ? `R ${leanRightPct}%` : leanRightPct >= 5 ? `${leanRightPct}%` : ''}
                  </div>
                )}
                {farRightPct > 0 && (
                  <div className="bg-red-700 text-white flex items-center justify-center shrink-0"
                    style={{ width: `${farRightPct}%` }}>
                    {farRightPct >= 10 ? `FR ${farRightPct}%` : farRightPct >= 5 ? `${farRightPct}%` : ''}
                  </div>
                )}
              </div>
              <div className="p-3 bg-stone-50 border-t border-brand-border">
                <button
                  onClick={handleExpand}
                  disabled={searching}
                  className="w-full py-2 px-4 bg-white hover:bg-sky-50 border border-brand-border 
                           hover:border-sky-200 text-sky-700 text-xs font-bold uppercase tracking-wider 
                           rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {searching ? (
                    <>
                      <div className="w-3 h-3 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                      Deep Searching...
                    </>
                  ) : (
                    <>
                      <span className="text-lg leading-none mt-[-2px]">&#9906;</span>
                      Check for more articles
                    </>
                  )}
                </button>
                <p className="text-[9px] text-brand-muted text-center mt-2 leading-tight px-2">
                  Proactively scans all 15 outlets for new coverage related to this specific story.
                </p>
              </div>
            </div>

            {/* First to Report */}
            {(() => {
              const withDates = (story.articles || [])
                .filter(a => a.publish_date)
                .sort((a, b) => new Date(a.publish_date) - new Date(b.publish_date))
              if (withDates.length < 2) return null
              return (
                <div className="bg-white border border-brand-border rounded-xl p-4 shadow-sm">
                  <h3 className="text-xs uppercase tracking-wider text-brand-muted font-semibold mb-3">
                    First to Report
                  </h3>
                  <ol className="space-y-2">
                    {withDates.slice(0, 5).map((a, i) => {
                      const c = BIAS_5[a.bias_label] || BIAS_5['Center']
                      return (
                        <li key={a.article_id} className="flex items-start gap-2">
                          <span className="text-[10px] font-mono text-sky-600 shrink-0 mt-0.5 w-3">{i + 1}.</span>
                          <div className="min-w-0">
                            <span className={`text-[10px] font-bold uppercase ${c.text}`}>{a.outlet}</span>
                            <p className="text-[10px] text-brand-muted">{timeAgo(a.publish_date)}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )
            })()}

            {/* Source circles */}
            {story.outlet_positions?.length > 0 && (
              <div className="bg-white border border-brand-border rounded-xl p-4 shadow-sm">
                <h3 className="text-xs uppercase tracking-wider text-brand-muted font-semibold mb-3">Sources</h3>
                <div className="flex flex-wrap gap-2">
                  {story.outlet_positions.map(o => {
                    const c = BIAS_5[o.bias_label] || BIAS_5['Center']
                    return (
                      <div
                        key={o.outlet}
                        title={`${o.outlet} \u2014 ${o.bias_label}${o.factuality ? ` \u00b7 ${o.factuality} factuality` : ''}`}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold cursor-default select-none"
                        style={{ background: `${c.hex}33`, color: c.hex, border: `1px solid ${c.hex}66` }}
                      >
                        {o.outlet.slice(0, 2).toUpperCase()}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Coverage Spectrum */}
            <div className="bg-white border border-brand-border rounded-xl p-4 shadow-sm">
              <h3 className="text-xs uppercase tracking-wider text-brand-muted font-semibold mb-3">
                Coverage Spectrum
              </h3>
              <CoverageBar outlets={story.outlet_positions || []} />
            </div>

            {/* Deep Bias button */}
            {story.topic_tag !== 'Sports' && story.topic_tag !== 'Tech' && story.topic_tag !== 'Business' && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 shadow-sm">
                <h3 className="text-[10px] uppercase tracking-widest text-indigo-800 font-bold mb-2">
                  Advanced Tools
                </h3>
                <p className="text-xs text-indigo-600 mb-3 leading-relaxed">
                  Override basic metrics with contextual Narrative Engine scoring.
                </p>
                <button
                  onClick={handleDeepBias}
                  disabled={deepBiasing}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {deepBiasing ? 'Analyzing...' : 'Run Deep Bias Analysis'}
                </button>
                {deepBiasErr && <p className="text-red-500 text-[10px] mt-2 text-center">{deepBiasErr}</p>}
              </div>
            )}

            {/* Regenerate button */}
            <button
              onClick={() => generateSummary(true)}
              disabled={summarizing}
              className="w-full py-2.5 bg-white hover:bg-sky-50 border border-brand-border
                         text-brand-muted hover:text-sky-700 rounded-xl text-sm font-medium
                         transition-colors disabled:opacity-40 cursor-pointer"
            >
              {summarizing ? '&#10022; Generating…' : '↺ Regenerate AI Summary'}
            </button>

            {summaryErr && (
              <p className="text-red-600 text-xs text-center">{summaryErr}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
