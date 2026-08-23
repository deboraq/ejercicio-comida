export default function PageHeader({ icon, iconTone = 'blue', title, subtitle, metrics = [], action }) {
  return (
    <header className="ti-page-header mb-4">
      <div className="ti-page-header-main">
        {icon != null && (
          <span className={`ti-page-icon ti-page-icon--${iconTone}`} aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="ti-page-header-text">
          <h1 className="ti-page-title">{title}</h1>
          {subtitle && <p className="ti-page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {(metrics.length > 0 || action) && (
        <div className="ti-page-header-side">
          {metrics.map((m) => (
            <span key={m} className="ti-page-metric-pill">{m}</span>
          ))}
          {action}
        </div>
      )}
    </header>
  )
}
