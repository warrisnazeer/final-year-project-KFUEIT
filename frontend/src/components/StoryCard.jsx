import { BiasBadge } from './Badges'
import { Link } from 'react-router-dom'

export default function StoryCard({ story }) {
  const { story_id, outlets_covering, articles } = story

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-5 hover:border-sky-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{outlets_covering.length}</span> outlets · {articles.length} articles
        </span>
        <Link
          to={`/stories/${story_id}`}
          className="text-xs text-sky-600 hover:text-sky-700 font-medium"
        >
          Compare →
        </Link>
      </div>

      {/* Outlet pills */}
      <div className="flex flex-wrap gap-1 mb-3">
        {outlets_covering.map(o => (
          <span key={o} className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{o}</span>
        ))}
      </div>

      {/* Article rows */}
      <div className="space-y-2.5">
        {articles.slice(0, 4).map((a) => (
          <div key={a.article_id} className="flex items-start gap-3">
            <span className="text-xs text-slate-600 w-24 shrink-0 pt-0.5 truncate">{a.outlet}</span>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-700 hover:text-slate-900 flex-1 leading-snug line-clamp-2"
            >
              {a.title}
            </a>
            <div className="shrink-0">
              <BiasBadge label={a.bias_label} score={a.bias_score} />
            </div>
          </div>
        ))}
      </div>

      {articles.length > 4 && (
        <Link to={`/stories/${story_id}`} className="text-xs text-slate-500 hover:text-sky-700 mt-3 block">
          +{articles.length - 4} more articles →
        </Link>
      )}
    </div>
  )
}
