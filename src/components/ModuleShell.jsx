export function ModuleAlerts({ msg, err, info }) {
  return (
    <>
      {msg ? <p className="module-alert module-alert--success mb-2">{msg}</p> : null}
      {err ? <p className="module-alert module-alert--danger mb-2">{err}</p> : null}
      {info ? <p className="module-alert module-alert--info mb-2">{info}</p> : null}
    </>
  )
}

export function ModuleSectionIntro({ title, desc }) {
  if (!title) return null
  return (
    <header className="module-shell-section-intro mb-3">
      <h2 className="module-shell-section-title">{title}</h2>
      {desc ? <p className="module-shell-section-desc mb-0">{desc}</p> : null}
    </header>
  )
}

export default function ModuleShell({
  sections,
  activeId,
  onSelect,
  sidebarLabel = 'Secciones',
  children,
}) {
  return (
    <div className="module-shell">
      <nav className="module-shell-nav box" aria-label={sidebarLabel}>
        <p className="module-shell-nav-label">{sidebarLabel}</p>
        <ul className="module-shell-nav-list">
          {sections.map((s) => {
            const activa = activeId === s.id
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`module-shell-nav-btn${activa ? ' is-active' : ''}`}
                  onClick={() => onSelect(s.id)}
                  aria-current={activa ? 'page' : undefined}
                >
                  {s.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="module-shell-main">{children}</div>
    </div>
  )
}
