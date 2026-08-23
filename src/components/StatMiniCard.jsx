export default function StatMiniCard({ icon, iconTone = 'green', label, value, children }) {
  return (
    <div className="box stat-mini-card mb-0">
      <div className={`stat-mini-icon stat-mini-icon--${iconTone}`} aria-hidden="true">{icon}</div>
      <div className="stat-mini-body">
        <p className="stat-mini-label">{label}</p>
        <p className="stat-mini-value">{value ?? '—'}</p>
        {children}
      </div>
    </div>
  )
}
