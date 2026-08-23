export default function MacroBarCard({ label, value, goal, color = '#3b82f6', unit = '' }) {
  const num = Number(value) || 0
  const target = Number(goal) || 0
  const hasGoal = target > 0
  const pct = hasGoal ? Math.min(100, (num / target) * 100) : (num > 0 ? 100 : 0)

  return (
    <div className="macro-bar-card box mb-0">
      <p className="macro-bar-label">{label}</p>
      <p className="macro-bar-value" style={{ color: num > 0 ? color : 'var(--app-text)' }}>
        <strong>{num || 0}</strong>
        {hasGoal ? (
          <span className="macro-bar-goal"> / {target} {unit}</span>
        ) : (
          unit && <span className="macro-bar-goal"> {unit}</span>
        )}
      </p>
      <div className="macro-bar-track">
        <div
          className="macro-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}
