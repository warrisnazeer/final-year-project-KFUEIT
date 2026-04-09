import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getStoryDetail, summarizeStory } from '../api/client'
import { BiasBadge, ToneBadge, FactualityBadge, BIAS_5 } from '../components/Badges'
import CoverageBar from '../components/CoverageBar'

const LEFT_LABELS  = new Set(['Far Left',  'Lean Left',  'Left'])
const RIGHT_LABELS = new Set(['Far Right', 'Lean Right', 'Right'])

const TABS = ['All', 'Left', 'Center', 'Right', 'Bias Comparison']

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

function StatRow({ label, value, color = 'text-stone-900' }) {
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
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border} transition-all hover:brightness-110`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={`text-xs font-bold uppercase tracking-wider ${c.text} shrink-0`}>
          {article.outlet}
        </span>
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
        className="text-sm font-medium text-stone-800 hover:text-gold-dark leading-snug block mb-2"
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
  const [story, setStory]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryErr, setSummaryErr]   = useState(null)
  const [activeTab, setActiveTab]     = useState('All')

  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const loadStory = async () => {
    try {
      const res = await getStoryDetail(id)
      setStory(res.data)
      trackDiversity(res.data)
      // Only auto-generate if there's no summary at all (not even a fallback stored)
      if (!res.data.has_summary) {
        generateSummary(false)
      }
    } catch {
      setStory(null)
    } finally {
      setLoading(false)
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
          setSummaryErr('Groq rate limit reached. Try again in a minute.')
        } else {
          setSummaryErr('Could not generate summary. Check Groq API key.')
        }
      }
    } finally {
      setSummarizing(false)
    }
  }

  useEffect(() => { loadStory() }, [id])

  if (loading) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-gold-DEFAULT border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!story) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-center text-brand-muted">
        <p className="text-lg mb-3">Story not found.</p>
        <Link to="/" className="text-gold-DEFAULT hover:underline">&larr; Back to Feed</Link>
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
    <div className="min-h-screen bg-brand-bg pb-20">

      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-brand-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-brand-muted hover:text-stone-900 text-sm transition-colors">
            &larr; Back
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-brand-muted text-xs hidden sm:block">{timeAgo(story.latest_date)}</span>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200 border border-brand-border
                         text-stone-600 hover:text-stone-900 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              {copied ? '✓ Copied!' : '⤴ Share'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6">

        {/* Cover image */}
        {story.cover_image && (
          <div className="w-full h-52 rounded-xl overflow-hidden mb-4">
            <img
              src={story.cover_image}
              alt={story.story_title}
              className="w-full h-full object-cover"
              onError={e => { e.target.style.display = 'none' }}
            />
          </div>
        )}

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

        {/* Story title */}
        <h1 className="text-2xl md:text-3xl font-bold text-stone-900 leading-tight mb-3">
          {summary?.story_title || story.story_title}
        </h1>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-brand-muted mb-5">
          <span className="font-medium text-stone-700">{story.outlet_count} sources</span>
          <span>&middot;</span>
          <span>{story.article_count} articles</span>
          {story.topic_tag && story.topic_tag !== 'General' && (
            <>
              <span>&middot;</span>
              <span className="text-xs bg-gold-light text-gold-dark px-2 py-0.5 rounded-full border border-gold-mid">
                {story.topic_tag}
              </span>
            </>
          )}
          {story.left_count   > 0 && <span className="text-blue-600">{story.left_count} Left</span>}
          {story.center_count > 0 && <span className="text-amber-700">{story.center_count} Center</span>}
          {story.right_count  > 0 && <span className="text-red-600">{story.right_count} Right</span>}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-stone-100 border border-brand-border rounded-xl p-1 w-fit mb-6 overflow-x-auto">
          {TABS.map(tab => {
            const isActive = activeTab === tab
            const activeCls = isActive
              ? tab === 'Left'   ? 'bg-blue-600 text-white'
              : tab === 'Right'  ? 'bg-red-600 text-white'
              : tab === 'Center' ? 'bg-amber-500 text-white'
              :                   'bg-white text-stone-900 shadow-sm'
              : 'text-brand-muted hover:text-stone-900'
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
          const NON_POLITICAL = ['Sports', 'Technology', 'General']
          const isNonPolitical = NON_POLITICAL.includes(story.topic_tag)
          return (
            <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed mb-4 ${
              isNonPolitical
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-stone-50 border-brand-border text-brand-muted'
            }`}>
              {isNonPolitical ? (
                <>
                  <span className="font-semibold text-amber-700">Note:</span> This is a{' '}
                  <span className="font-semibold">{story.topic_tag}</span> story — bias scores here
                  reflect <em>framing style</em> (critical &amp; independent vs. state-aligned tone)
                  rather than direct political alignment.
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
              <div className="bg-white border border-brand-border rounded-xl p-5 flex items-center gap-3 text-brand-muted shadow-sm">
                <div className="w-5 h-5 border-2 border-gold-DEFAULT border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="text-sm">Generating AI summary&hellip;</span>
              </div>
            )}

            {activeTab !== 'Bias Comparison' && summary && summary.what_happened && !summarizing && (
              <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-brand-border bg-gold-light">
                  <span className="text-gold-dark text-base">&#10022;</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-gold-dark">AI Analysis</span>
                  <span className="text-[10px] bg-gold-DEFAULT text-white border border-gold-dark px-2 py-0.5 rounded-full ml-1">
                    Llama 3.3 70B · Groq
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
                            <span className="text-gold-DEFAULT shrink-0 mt-0.5 font-bold text-base leading-none">&#8226;</span>
                            {fact}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Why It Matters callout */}
                  {summary.why_it_matters && (
                    <div className="bg-gold-light border border-gold-mid rounded-lg p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-gold-dark mb-2">Why It Matters</p>
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
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-1">
                        &#9664; Left / Liberal Framing
                      </p>
                      <p className="text-[10px] text-blue-500 mb-3">pro-civilian · accountability · press freedom</p>
                      <p className="text-stone-800 text-sm leading-relaxed">
                        {summary.left_framing || 'No distinct left framing detected.'}
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
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
                    <div className="bg-gold-light border border-gold-mid rounded-xl p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-gold-dark mb-2">Why It Matters</p>
                      <p className="text-stone-700 text-sm leading-relaxed">{summary.why_it_matters}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-brand-border rounded-xl p-5 text-center text-brand-muted text-sm">
                  Generate an AI summary first to see the bias comparison.
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
              AI summaries by Llama 3.3 70B via Groq.
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
                {centerCnt    > 0 && <StatRow label="Center"     value={centerCnt}    color="text-amber-700" />}
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
                  <div className="bg-amber-400 text-white flex items-center justify-center flex-1"
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
                          <span className="text-[10px] font-mono text-gold-mid shrink-0 mt-0.5 w-3">{i + 1}.</span>
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

            {/* Regenerate button */}
            <button
              onClick={() => generateSummary(true)}
              disabled={summarizing}
              className="w-full py-2.5 bg-white hover:bg-gold-light border border-brand-border
                         text-brand-muted hover:text-gold-dark rounded-xl text-sm font-medium
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
