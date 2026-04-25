/**
 * Bias 5-level color map.
 * Handles both new 5-level ("Far Left", "Lean Left", …) and
 * legacy 3-level ("Left", "Center", "Right") labels gracefully.
 */
export const BIAS_5 = {
  // New labels
  "Far Left":   { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800", barBg: "bg-blue-700", hex: "#1e40af" },
  "Lean Left":  { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", barBg: "bg-blue-500", hex: "#2563eb" },
  "Center":     { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", barBg: "bg-teal-500", hex: "#0f766e" },
  "Lean Right": { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", barBg: "bg-red-500", hex: "#dc2626" },
  "Far Right":  { bg: "bg-red-100", border: "border-red-300", text: "text-red-800", barBg: "bg-red-700", hex: "#991b1b" },
  // Legacy fallbacks
  "Left":       { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", barBg: "bg-blue-600", hex: "#2563eb" },
  "Right":      { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", barBg: "bg-red-600", hex: "#dc2626" },
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
  if (!label) return <span className="text-slate-500 text-xs">-</span>
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
    Positive: 'bg-emerald-50 border border-emerald-200 text-emerald-700',
    Neutral:  'bg-slate-100 border border-slate-200 text-slate-700',
    Negative: 'bg-orange-50 border border-orange-200 text-orange-700',
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
    High:  "bg-emerald-50 border-emerald-200 text-emerald-700",
    Mixed: "bg-yellow-50 border-yellow-200 text-yellow-700",
    Low:   "bg-red-50 border-red-200 text-red-700",
  }
  const icons = { High: "✓", Mixed: "~", Low: "!" }
  const cls = styles[rating] || styles.Mixed
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
      {icons[rating]} {rating}
    </span>
  )
}
