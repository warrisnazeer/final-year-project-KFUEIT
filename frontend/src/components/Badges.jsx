/**
 * Bias 5-level color map.
 * Handles both new 5-level ("Far Left", "Lean Left", …) and
 * legacy 3-level ("Left", "Center", "Right") labels gracefully.
 */
export const BIAS_5 = {
  // New labels
  "Far Left":   { bg: "bg-blue-950",  border: "border-blue-700",  text: "text-blue-300",   barBg: "bg-blue-900",   hex: "#1e3a8a" },
  "Lean Left":  { bg: "bg-blue-900/40", border: "border-blue-700/60", text: "text-blue-400", barBg: "bg-blue-700", hex: "#1d4ed8" },
  "Center":     { bg: "bg-slate-700/30", border: "border-slate-600/50", text: "text-slate-400", barBg: "bg-slate-500", hex: "#64748b" },
  "Lean Right": { bg: "bg-red-900/40", border: "border-red-700/60", text: "text-red-400",    barBg: "bg-red-700",   hex: "#b91c1c" },
  "Far Right":  { bg: "bg-red-950",   border: "border-red-800",   text: "text-red-300",    barBg: "bg-red-900",   hex: "#7f1d1d" },
  // Legacy fallbacks
  "Left":       { bg: "bg-blue-900/30", border: "border-blue-700/50", text: "text-blue-400", barBg: "bg-blue-700",  hex: "#1d4ed8" },
  "Right":      { bg: "bg-red-900/30",  border: "border-red-700/50",  text: "text-red-400",  barBg: "bg-red-700",   hex: "#b91c1c" },
}

const BIAS_SHORT = {
  "Far Left":  "F.Left",
  "Lean Left": "L.Left",
  "Center":    "Center",
  "Lean Right":"L.Right",
  "Far Right": "F.Right",
  "Left":      "Left",
  "Right":     "Right",
}

/**
 * BiasBadge — colored pill label for 5-level bias scale.
 */
export function BiasBadge({ label, score, short = false }) {
  if (!label) return <span className="text-slate-600 text-xs">—</span>
  const c = BIAS_5[label] || BIAS_5["Center"]

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text}`}>
      {short ? BIAS_SHORT[label] : label}
      {score !== undefined && score !== null && (
        <span className="opacity-60 font-mono">({score > 0 ? '+' : ''}{score.toFixed(2)})</span>
      )}
    </span>
  )
}

/**
 * ToneBadge — colored pill for Positive / Neutral / Negative
 */
export function ToneBadge({ tone }) {
  if (!tone) return null

  const classes = {
    Positive: 'bg-emerald-900/40 border border-emerald-700/50 text-emerald-400',
    Neutral:  'bg-slate-700/40 border border-slate-600/50 text-slate-400',
    Negative: 'bg-orange-900/40 border border-orange-700/50 text-orange-400',
  }

  const icons = { Positive: '↑', Neutral: '→', Negative: '↓' }

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${classes[tone] || classes.Neutral}`}>
      {icons[tone]} {tone}
    </span>
  )
}

/**
 * FactualityBadge — High / Mixed / Low journalism quality badge.
 */
export function FactualityBadge({ rating }) {
  if (!rating) return null
  const styles = {
    High:  "bg-emerald-900/40 border-emerald-700/50 text-emerald-400",
    Mixed: "bg-yellow-900/40 border-yellow-700/50 text-yellow-400",
    Low:   "bg-red-900/40 border-red-700/50 text-red-400",
  }
  const icons = { High: "✓", Mixed: "~", Low: "!" }
  const cls = styles[rating] || styles.Mixed
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
      {icons[rating]} {rating}
    </span>
  )
}
