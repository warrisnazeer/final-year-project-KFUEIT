import { useEffect, useState } from 'react'
import { getOutlets } from '../api/client'
import { FactualityBadge } from '../components/Badges'

const BIAS_5 = {
  'Far Left':   { bg: 'bg-blue-50',  bar: 'bg-blue-700',   text: 'text-blue-700',  hex: '#1e3a8a' },
  'Lean Left':  { bg: 'bg-blue-50',  bar: 'bg-blue-400',   text: 'text-blue-600',  hex: '#2563eb' },
  'Center':     { bg: 'bg-teal-50', bar: 'bg-teal-400',  text: 'text-teal-700', hex: '#0f766e' },
  'Lean Right': { bg: 'bg-red-50',   bar: 'bg-red-400',    text: 'text-red-600',   hex: '#dc2626' },
  'Far Right':  { bg: 'bg-red-50',   bar: 'bg-red-700',    text: 'text-red-700',   hex: '#7f1d1d' },
}

function biasLabel(score) {
  if (score < -0.45) return 'Far Left'
  if (score < -0.15) return 'Lean Left'
  if (score >  0.45) return 'Far Right'
  if (score >  0.15) return 'Lean Right'
  return 'Center'
}

function BiasBar5({ b5, total }) {
  if (!total) return <div className="h-3 bg-stone-200 rounded-full" />
  const levels = ['Far Left', 'Lean Left', 'Center', 'Lean Right', 'Far Right']
  const colors  = ['bg-blue-700', 'bg-blue-400', 'bg-teal-400', 'bg-red-400', 'bg-red-700']
  return (
    <div className="flex rounded-full overflow-hidden h-3">
      {levels.map((lv, i) => {
        const pct = Math.round((b5[lv] || 0) / total * 100)
        if (!pct) return null
        return (
          <div
            key={lv}
            className={`${colors[i]} transition-all`}
            style={{ width: `${pct}%` }}
            title={`${lv}: ${pct}%`}
          />
        )
      })}
    </div>
  )
}

export default function Outlets() {
  const [outlets, setOutlets] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy]   = useState('bias') // 'bias' | 'articles' | 'name'

  useEffect(() => {
    getOutlets().then(r => { setOutlets(r.data); setLoading(false) })
  }, [])

  const sorted = [...outlets].sort((a, b) => {
    if (sortBy === 'bias')     return a.avg_bias_score - b.avg_bias_score
    if (sortBy === 'articles') return b.total_articles - a.total_articles
    return a.name.localeCompare(b.name)
  })

  if (loading) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-brand-bg pb-20">
      {/* Header */}
      <div className="bg-white border-b border-brand-border py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-stone-900 mb-1">Pakistani News Outlets</h1>
          <p className="text-brand-muted text-sm">
            {outlets.length} outlets tracked · bias scores from AI analysis of all scraped articles
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-6">
        {/* Sort controls */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs text-brand-muted mr-1">Sort by:</span>
          {[['bias','Bias Spectrum'],['articles','Articles'],['name','Name']].map(([val,label]) => (
            <button
              key={val}
              onClick={() => setSortBy(val)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer
                ${sortBy === val ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-white shadow-sm' : 'bg-white text-brand-muted hover:text-stone-900 border border-brand-border'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Outlet cards */}
        <div className="space-y-3">
          {sorted.map(o => {
            const label   = biasLabel(o.avg_bias_score)
            const style   = BIAS_5[label]
            const b5      = o.bias_5level || {}
            const total5  = (b5['Far Left'] || 0) + (b5['Lean Left'] || 0) + (b5['Center'] || 0) + (b5['Lean Right'] || 0) + (b5['Far Right'] || 0)
            const total   = o.total_articles || 0
            const topics  = o.top_topics || []
            const sentPct = o.avg_sentiment_score

            return (
              <div key={o.outlet_id} className="bg-white border border-brand-border rounded-xl p-5 hover:border-sky-300 transition-colors shadow-sm hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  {/* Name + factuality */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={o.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-bold text-stone-900 hover:text-sky-700 transition-colors"
                      >
                        {o.name} <span className="text-brand-muted text-xs">↗</span>
                      </a>
                      <FactualityBadge rating={o.factuality} />
                    </div>
                    <p className="text-xs text-brand-muted mt-0.5">{total.toLocaleString()} articles analysed</p>
                  </div>

                  {/* Bias score + label */}
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xl font-mono font-bold ${style.text}`}
                    >
                      {o.avg_bias_score > 0 ? '+' : ''}{o.avg_bias_score.toFixed(3)}
                    </div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${style.text}`}>
                      {label}
                    </div>
                  </div>
                </div>

                {/* 5-level bias bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[9px] text-brand-muted mb-1">
                    <span>Far Left</span>
                    <span>Center</span>
                    <span>Far Right</span>
                  </div>
                  <BiasBar5 b5={b5} total={total5 || total} />
                  {/* Percentages */}
                  {total5 > 0 && (
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {['Far Left','Lean Left','Center','Lean Right','Far Right'].map(lv => {
                        const pct = Math.round((b5[lv] || 0) / total5 * 100)
                        if (!pct) return null
                        const c = BIAS_5[lv]
                        return (
                          <span key={lv} className={`text-[9px] font-semibold ${c.text}`}>
                            {lv} {pct}%
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Bottom row: topics + sentiment */}
                <div className="flex items-center gap-3 flex-wrap">
                  {topics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {topics.map(t => (
                        <span key={t} className="text-[10px] bg-stone-100 border border-stone-200 text-stone-600 px-2 py-0.5 rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="ml-auto shrink-0">
                    <span className="text-[10px] text-slate-600">
                      Sentiment:&nbsp;
                      <span className={sentPct > 0.1 ? 'text-green-600' : sentPct < -0.1 ? 'text-red-500' : 'text-brand-muted'}>
                        {sentPct > 0.1 ? 'Positive' : sentPct < -0.1 ? 'Negative' : 'Neutral'}
                        {' '}({sentPct >= 0 ? '+' : ''}{sentPct.toFixed(2)})
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 bg-stone-50 border border-brand-border rounded-xl p-4 text-xs text-brand-muted leading-relaxed">
          <strong className="text-stone-700">How bias scores work: </strong>
          HuggingFace BART zero-shot classification (60%) + keyword lexicon (30%) + outlet prior (10%).
          Scores: <span className="text-blue-600">−1.0 Far Left</span> · <span className="text-teal-700">0.0 Center</span> · <span className="text-red-600">+1.0 Far Right</span>.
          Factuality ratings based on editorial standards and historical accuracy.
        </div>
      </div>
    </div>
  )
}

