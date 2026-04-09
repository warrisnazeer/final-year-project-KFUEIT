import { useEffect, useState } from 'react'
import { getArticles } from '../api/client'
import ArticleCard from '../components/ArticleCard'

const OUTLETS = ['Dawn', 'Geo News', 'ARY News', 'Express Tribune', 'The News International', 'Samaa News', 'Dunya News']
const BIAS_LABELS = ['Left', 'Center', 'Right']

export default function Articles() {
  const [articles, setArticles] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [outlet, setOutlet] = useState('')
  const [biasFilter, setBiasFilter] = useState('')
  const [page, setPage] = useState(0)
  const LIMIT = 18

  useEffect(() => {
    setLoading(true)
    getArticles({
      outlet: outlet || undefined,
      bias_label: biasFilter || undefined,
      limit: LIMIT,
      skip: page * LIMIT,
    }).then(r => {
      setArticles(r.data.articles)
      setTotal(r.data.total)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [outlet, biasFilter, page])

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Browse Articles</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={outlet}
          onChange={e => { setOutlet(e.target.value); setPage(0) }}
          className="bg-brand-card border border-brand-border text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Outlets</option>
          {OUTLETS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        <div className="flex gap-2">
          {['', ...BIAS_LABELS].map(b => (
            <button
              key={b}
              onClick={() => { setBiasFilter(b); setPage(0) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                biasFilter === b
                  ? b === 'Left' ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                    : b === 'Right' ? 'bg-red-600/30 border-red-500 text-red-300'
                    : b === 'Center' ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                    : 'bg-white/10 border-white/20 text-white'
                  : 'border-brand-border text-slate-500 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {b || 'All Bias'}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500 self-center ml-auto">
          {total.toLocaleString()} articles
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading articles...</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-slate-500">No articles found. Try changing filters.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map(a => <ArticleCard key={a.article_id} article={a} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 rounded-lg bg-brand-card border border-brand-border text-sm text-slate-400 disabled:opacity-40 hover:border-slate-500"
          >
            ← Prev
          </button>
          <span className="px-4 py-2 text-sm text-slate-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 rounded-lg bg-brand-card border border-brand-border text-sm text-slate-400 disabled:opacity-40 hover:border-slate-500"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
