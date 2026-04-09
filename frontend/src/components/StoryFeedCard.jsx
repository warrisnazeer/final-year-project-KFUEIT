import { useNavigate } from 'react-router-dom'
import { BIAS_5 } from './Badges'

/**
 * StoryFeedCard â€” Ground News style story card.
 *
 * Props:
 *   story    â€” story object from /api/stories/
 *   featured â€” if true, renders a larger hero card
 */
export default function StoryFeedCard({ story, featured = false }) {
  const navigate = useNavigate()

  const timeAgo = (iso) => {
    if (!iso) return ''
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  // Build 5-segment bias bar from outlet_positions
  const positions = story.outlet_positions || []
  const total = positions.length || 1
  const countFor = (labels) => positions.filter(p => labels.includes(p.bias_label)).length
  const farLeftCount  = countFor(['Far Left'])
  const leanLeftCount = countFor(['Lean Left', 'Left'])
  const centerCount   = countFor(['Center'])
  const leanRightCount= countFor(['Lean Right', 'Right'])
  const farRightCount = countFor(['Far Right'])

  const pct = (n) => Math.round((n / total) * 100)
  const farLeftPct  = pct(farLeftCount)
  const leanLeftPct = pct(leanLeftCount)
  const centerPct   = pct(centerCount)
  const leanRightPct= pct(leanRightCount)
  const farRightPct = pct(farRightCount)

  // Fallback to article counts if no outlet_positions
  const artTotal    = story.article_count || 1
  const fallbackL   = Math.round(((story.left_count  || 0) / artTotal) * 100)
  const fallbackR   = Math.round(((story.right_count || 0) / artTotal) * 100)
  const fallbackC   = 100 - fallbackL - fallbackR

  const hasPositions = positions.length > 0
  const segments = hasPositions
    ? [
        { pct: farLeftPct,   color: "bg-blue-700",   label: "F.Left"  },
        { pct: leanLeftPct,  color: "bg-blue-400",   label: "Lean L"  },
        { pct: centerPct,    color: "bg-amber-400",  label: "Center"  },
        { pct: leanRightPct, color: "bg-red-400",    label: "Lean R"  },
        { pct: farRightPct,  color: "bg-red-700",    label: "F.Right" },
      ]
    : [
        { pct: fallbackL, color: "bg-blue-500",  label: `L ${fallbackL}%`  },
        { pct: fallbackC, color: "bg-amber-400", label: `C ${fallbackC}%`  },
        { pct: fallbackR, color: "bg-red-500",   label: `R ${fallbackR}%`  },
      ]

  const isBlindspot = !!story.blindspot_side

  return (
    <div
      onClick={() => navigate(`/stories/${story.story_id}`)}
      className={`
        cursor-pointer group border border-brand-border rounded-xl overflow-hidden
        bg-brand-card hover:border-gold-mid
        transition-all duration-200 hover:shadow-md hover:shadow-stone-200/80
        flex flex-col
      `}
    >
      {/* Cover image (if available) */}
      {story.cover_image && featured && (
        <div className="w-full h-40 overflow-hidden bg-stone-100">
          <img
            src={story.cover_image}
            alt=""
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
      )}

      {/* Card body */}
      <div className={`p-4 flex-1 ${featured ? 'p-5' : ''}`}>
        {/* Meta row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs text-brand-muted flex-wrap">
            <span className="font-medium text-stone-700">
              {story.outlet_count} source{story.outlet_count !== 1 ? 's' : ''}
            </span>
            <span>·</span>
            <span>{timeAgo(story.latest_date)}</span>
            {story.topic_tag && story.topic_tag !== 'General' && (
              <>
                <span>·</span>
                <span className="text-gold-dark bg-gold-light px-1.5 py-0.5 rounded text-[10px] font-medium">
                  {story.topic_tag}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isBlindspot && (
              <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full">
                Blindspot
              </span>
            )}
            {story.has_summary && (
              <span className="text-[10px] font-medium bg-gold-light text-gold-dark border border-gold-mid px-2 py-0.5 rounded-full">
                AI
              </span>
            )}
          </div>
        </div>

        {/* Headline */}
        <h2 className={`
          font-bold text-stone-900 group-hover:text-gold-dark transition-colors
          leading-snug line-clamp-2 mb-2
          ${featured ? 'text-lg md:text-xl' : 'text-sm md:text-base'}
        `}>
          {story.story_title}
        </h2>

        {/* Outlet names (featured only) */}
        {featured && story.outlets_covering?.length > 0 && (
          <p className="text-xs text-brand-muted line-clamp-1">
            {story.outlets_covering.join(' · ')}
          </p>
        )}
      </div>

      {/* 5-segment bias bar */}
      <div className="flex h-7 text-[10px] font-semibold select-none">
        {segments.map((seg, i) =>
          seg.pct > 0 ? (
            <div
              key={i}
              className={`${seg.color} text-white/90 flex items-center justify-center shrink-0 transition-all`}
              style={{ width: `${seg.pct}%`, flexGrow: seg.pct === 0 ? 0 : undefined }}
            >
              {seg.pct >= 18 ? seg.label : seg.pct >= 10 ? `${seg.pct}%` : ''}
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}
