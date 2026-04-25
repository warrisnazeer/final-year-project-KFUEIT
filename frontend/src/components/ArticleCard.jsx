import { BiasBadge, ToneBadge } from './Badges'

export default function ArticleCard({ article }) {
  const { title, url, outlet, bias_label, framing_tone, bias_score, publish_date } = article

  const date = publish_date
    ? new Date(publish_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })
    : null

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-4 flex flex-col gap-3 hover:border-sky-300 hover:shadow-sm transition-all">
      {/* Outlet + date row */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-semibold text-slate-700">{outlet}</span>
        {date && <span>{date}</span>}
      </div>

      {/* Title */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-slate-900 leading-snug hover:text-sky-700 transition-colors line-clamp-3"
      >
        {title}
      </a>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <BiasBadge label={bias_label} score={bias_score} />
        <ToneBadge tone={framing_tone} />
      </div>
    </div>
  )
}
