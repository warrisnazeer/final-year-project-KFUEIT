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

  const labelColor = (label) => {
    if (label === 'Left')  return 'bg-blue-500 text-white'
    if (label === 'Right') return 'bg-red-500 text-white'
    return 'bg-teal-500 text-white'
  }

  const dotColor = (label) => {
    if (label === 'Left')  return '#3b82f6'
    if (label === 'Right') return '#ef4444'
    return '#14b8a6'
  }

  const barH = compact ? 'h-6' : 'h-8'
  const fontSize = compact ? 'text-[10px]' : 'text-xs'

  return (
    <div className="w-full select-none">
      {/* Axis labels */}
      <div className={`flex justify-between mb-1 ${fontSize} font-semibold`}>
        <span className="text-blue-600">◀ Left</span>
        <span className="text-teal-600">Center</span>
        <span className="text-red-600">Right ▶</span>
      </div>

      {/* Bar + outlet markers */}
      <div className={`relative w-full ${barH} rounded-full overflow-visible`}
          style={{ background: 'linear-gradient(to right, #bfdbfe 0%, #99f6e4 50%, #fecaca 100%)' }}>

        {/* Center line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-500/40" />

        {/* Outlet dots */}
        {outlets.map((o, i) => {
          const pct = toPercent(o.bias_score)
          return (
            <div
              key={o.outlet + i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
              style={{ left: `${pct}%` }}
            >
              {/* Dot */}
              <div
                className="rounded-full border-2 border-white cursor-default shadow-md transition-transform group-hover:scale-125"
                style={{
                  width: compact ? 10 : 14,
                  height: compact ? 10 : 14,
                  backgroundColor: dotColor(o.bias_label),
                }}
              />
              {/* Tooltip on hover */}
              <div className={`
                absolute bottom-full mb-1 left-1/2 -translate-x-1/2
                bg-slate-900 text-white ${fontSize} px-2 py-1 rounded shadow-lg
                whitespace-nowrap pointer-events-none z-10
                opacity-0 group-hover:opacity-100 transition-opacity
              `}>
                {o.outlet}
                <div className={`text-[9px] text-center ${o.bias_label === 'Left' ? 'text-blue-300' : o.bias_label === 'Right' ? 'text-red-300' : 'text-teal-300'}`}>
                  {o.bias_label} ({o.bias_score >= 0 ? '+' : ''}{(o.bias_score ?? 0).toFixed(2)})
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Outlet name labels below bar (non-compact only) */}
      {!compact && (
        <div className="relative w-full mt-3" style={{ height: 20 }}>
          {outlets.map((o, i) => {
            const pct = toPercent(o.bias_score)
            return (
              <span
                key={o.outlet + i}
                className={`absolute -translate-x-1/2 text-[10px] font-medium ${
                  o.bias_label === 'Left' ? 'text-blue-400' :
                  o.bias_label === 'Right' ? 'text-red-500' : 'text-teal-600'
                }`}
                style={{ left: `${pct}%` }}
              >
                {o.outlet.replace(' News', '').replace(' International', '').replace(' Tribune', ' Trib.')}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
