/**
 * BiasSpectrumChart
 *
 * Shows each outlet as a labeled dot on a horizontal -1 (Left) to +1 (Right) scale.
 * This is the signature visualization of News Narrative.
 */
export default function BiasSpectrumChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-slate-500 text-sm">No data yet.</p>
  }

  // Map score (-1 to +1) to percentage (0% to 100%)
  const toPercent = (score) => ((score + 1) / 2) * 100

  const dotColor = (score) => {
    if (score < -0.15) return '#3B82F6'   // blue — Left
    if (score > 0.15)  return '#EF4444'   // red — Right
    return '#10B981'                       // green — Center
  }

  return (
    <div className="w-full select-none">
      {/* Scale labels */}
      <div className="flex justify-between text-xs text-slate-500 mb-2 px-1">
        <span className="text-blue-400 font-medium">◀ Left</span>
        <span className="text-emerald-400 font-medium">Centre</span>
        <span className="text-red-400 font-medium">Right ▶</span>
      </div>

      {/* Track */}
      <div className="relative h-3 rounded-full bg-gradient-to-r from-blue-600/40 via-emerald-600/40 to-red-600/40 border border-brand-border mb-8">
        {/* Centre line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-500/60" />

        {/* Outlet dots */}
        {data.map((outlet) => {
          const pct = toPercent(outlet.avg_bias_score)
          return (
            <div
              key={outlet.outlet}
              className="absolute top-1/2 -translate-y-1/2 group"
              style={{ left: `${pct}%` }}
            >
              <div
                className="w-3.5 h-3.5 rounded-full border-2 border-brand-bg -translate-x-1/2 cursor-pointer transition-transform group-hover:scale-150"
                style={{ backgroundColor: dotColor(outlet.avg_bias_score) }}
              />
              {/* Tooltip label below */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-slate-300 group-hover:text-white transition-colors">
                {outlet.outlet.replace(' News', '').replace(' International', '')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend table */}
      <div className="mt-6 space-y-1">
        {data.map((outlet) => (
          <div key={outlet.outlet} className="flex items-center justify-between text-xs py-1 border-b border-brand-border/50">
            <span className="text-slate-300 w-40 truncate">{outlet.outlet}</span>
            <div className="flex gap-3 text-slate-500">
              <span className="text-blue-400">{outlet.left_pct}% L</span>
              <span className="text-emerald-400">{outlet.center_pct}% C</span>
              <span className="text-red-400">{outlet.right_pct}% R</span>
            </div>
            <span
              className="font-mono font-bold text-xs"
              style={{ color: dotColor(outlet.avg_bias_score) }}
            >
              {outlet.avg_bias_score > 0 ? '+' : ''}{outlet.avg_bias_score.toFixed(3)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
