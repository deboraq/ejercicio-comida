export default function MacroRing({ label, value, goal, color = '#3b82f6', unit = '' }) {
  const num = Number(value) || 0
  const target = Number(goal) || 0
  const pct = target > 0 ? Math.min(100, (num / target) * 100) : 0
  const r = 34
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c

  return (
    <div className="macro-ring">
      <div className="macro-ring-chart">
        <svg viewBox="0 0 88 88" aria-hidden>
          <circle className="macro-ring-track" cx="44" cy="44" r={r} />
          <circle
            className="macro-ring-progress"
            cx="44"
            cy="44"
            r={r}
            style={{ stroke: color, strokeDasharray: c, strokeDashoffset: offset }}
          />
        </svg>
        <div className="macro-ring-center">
          <span className="macro-ring-value" style={{ color }}>{num || '—'}</span>
          {target > 0 && <span className="macro-ring-goal">/{target}</span>}
        </div>
      </div>
      <p className="macro-ring-label">{label}</p>
      {unit && <p className="macro-ring-unit">{unit}</p>}
      {target > 0 && (
        <div className="macro-ring-bar">
          <div className="macro-ring-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
    </div>
  )
}
