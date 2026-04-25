/**
 * CoverageBar — Ground News style spectrum bar
 * Shows which outlets covered a story and where they sit on the
 * Left ←────────────────────────── Right spectrum.
 *
 * Props:
 *   outlets: [{ outlet, bias_score, bias_label }]  — sorted L→R
 *   compact: bool  — smaller version for story feed cards
 */
export default function CoverageBar({ outlets = [], compact = false }) {
  if (!outlets.length) return null

  // Map bias_score (-1 → +1) to a % position on the bar (5% → 95%)
  const toPercent = (score) => {
    const clamped = Math.max(-1, Math.min(1, score ?? 0))
    return ((clamped + 1) / 2) * 90 + 5
  }

  const dotColor = (label) => {
    if (label === 'Left')  return '#3b82f6'
    if (label === 'Right') return '#ef4444'
    return '#14b8a6'
  }

  // Group outlets by their percentage to avoid overlapping text/dots
  const grouped = {}
  outlets.forEach(o => {
    const pct = toPercent(o.bias_score).toFixed(1)
    if (!grouped[pct]) grouped[pct] = []
    grouped[pct].push(o)
  })

  const barH = compact ? 'h-6' : 'h-10'
  const fontSize = compact ? 'text-[10px]' : 'text-xs'

  return (
    <div className="w-full select-none mt-2 mb-4">
      {/* Axis labels */}
      <div className={`flex justify-between mb-2 ${fontSize} font-bold uppercase tracking-wider`}>
        <span className="text-blue-600">◀ Left</span>
        <span className="text-teal-600">Center</span>
        <span className="text-red-600">Right ▶</span>
      </div>

      {/* Bar + outlet markers */}
      <div className={`relative w-full ${barH} rounded-xl overflow-visible border border-slate-200/60 shadow-inner`}
          style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.15) 0%, rgba(20,184,166,0.15) 50%, rgba(239,68,68,0.15) 100%)' }}>

        {/* Center line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-teal-400/50 -translate-x-1/2" />
        <div className="absolute top-0 bottom-0 left-[25%] w-px bg-slate-300/40 -translate-x-1/2" />
        <div className="absolute top-0 bottom-0 left-[75%] w-px bg-slate-300/40 -translate-x-1/2" />

        {/* Outlet dots stacked */}
        {Object.entries(grouped).map(([pct, group], idx) => {
          return (
            <div
              key={idx}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center gap-1 group z-10 hover:z-20 cursor-default"
              style={{ left: `${pct}%` }}
            >
              {/* Stacked markers */}
              <div className="flex flex-col items-center gap-0.5">
                {group.map((o, i) => (
                  compact ? (
                    <div
                      key={i}
                      className="rounded-full border border-white shadow-sm transition-transform group-hover:scale-110"
                      style={{ width: 10, height: 10, backgroundColor: dotColor(o.bias_label) }}
                    />
                  ) : (
                    <div
                      key={i}
                      title={o.outlet}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm transition-transform group-hover:scale-110 bg-white ring-2 ring-white"
                      style={{
                        color: dotColor(o.bias_label),
                        border: `2px solid ${dotColor(o.bias_label)}`
                      }}
                    >
                      {o.outlet.slice(0, 2).toUpperCase()}
                    </div>
                  )
                ))}
              </div>

              {/* Combined Tooltip on hover */}
              <div className={`
                absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                bg-slate-900/95 backdrop-blur-sm text-white ${fontSize} p-2 rounded-lg shadow-xl
                whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity border border-slate-700
              `}>
                <div className="font-semibold mb-1 text-slate-200 border-b border-slate-700 pb-1">
                  {group[0].bias_label} ({group[0].bias_score >= 0 ? '+' : ''}{(group[0].bias_score ?? 0).toFixed(2)})
                </div>
                {group.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor(o.bias_label) }} />
                    <span className="font-medium text-white">{o.outlet}</span>
                  </div>
                ))}
                {/* Tooltip caret */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
