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
      <h1 className="text-2xl font-bold text-stone-900 mb-6">Browse Articles</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={outlet}
          onChange={e => { setOutlet(e.target.value); setPage(0) }}
          className="bg-white border border-brand-border text-stone-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gold-mid"
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
                  ? b === 'Left' ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : b === 'Right' ? 'bg-red-50 border-red-300 text-red-700'
                    : b === 'Center' ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-gold-light border-gold-mid text-gold-dark'
                  : 'border-brand-border text-brand-muted hover:border-gold-mid hover:text-stone-700'
              }`}
            >
              {b || 'All Bias'}
            </button>
          ))}
        </div>

        <span className="text-xs text-brand-muted self-center ml-auto">
          {total.toLocaleString()} articles
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-brand-muted">Loading articles...</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-brand-muted">No articles found. Try changing filters.</div>
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
            className="px-4 py-2 rounded-lg bg-white border border-brand-border text-sm text-stone-600 disabled:opacity-40 hover:border-gold-mid"
          >
            ← Prev
          </button>
          <span className="px-4 py-2 text-sm text-brand-muted">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 rounded-lg bg-white border border-brand-border text-sm text-stone-600 disabled:opacity-40 hover:border-gold-mid"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
