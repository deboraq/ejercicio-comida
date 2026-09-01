import { Link, useLocation } from 'react-router-dom'

export const NAV_ITEMS = [
  { to: '/', key: 'inicio', label: 'Inicio', icon: 'home' },
  { to: '/ejercicios', key: 'ejercicios', label: 'Ejercicios', icon: 'dumbbell' },
  { to: '/rutina', key: 'rutina', label: 'Rutina', icon: 'routine' },
  { to: '/comida', key: 'comida', label: 'Comida', icon: 'food' },
  { to: '/profe', key: 'profe', label: 'Profe', icon: 'coach', requiresProfe: true },
  { to: '/admin', key: 'admin', label: 'Admin', icon: 'admin', requiresAdmin: true },
]

export function NavIcon({ name }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  switch (name) {
    case 'home':
      return <svg {...props}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
    case 'dumbbell':
      return (
        <svg {...props}>
          <path d="M6.5 8.5h-2A1.5 1.5 0 0 0 3 10v4a1.5 1.5 0 0 0 1.5 1.5h2" />
          <path d="M17.5 8.5h2A1.5 1.5 0 0 1 21 10v4a1.5 1.5 0 0 1-1.5 1.5h-2" />
          <path d="M9 12h6" />
        </svg>
      )
    case 'routine':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
          <path d="M8 14h2M12 14h2M16 14h2" />
        </svg>
      )
    case 'food':
      return (
        <svg {...props}>
          <path d="M5 3v8a2.5 2.5 0 0 0 5 0V3" />
          <path d="M7.5 3v18" />
          <path d="M19 3v9a3 3 0 0 1-3 3h-1v9" />
        </svg>
      )
    case 'coach':
      return (
        <svg {...props}>
          <path d="M22 10 12 5 2 10l10 5 10-5z" />
          <path d="M6 12v4.5c0 1.5 2.5 3 6 3s6-1.5 6-3V12" />
        </svg>
      )
    case 'admin':
      return <svg {...props}><path d="M12 3 4 7v6c0 5 3.5 8 8 8s8-3 8-8V7l-8-4z" /></svg>
    case 'config':
      return <svg {...props}><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /><path d="M19.4 15a7.9 7.9 0 0 0 .1-2l2-1.5-2-3.5-2.3.7a8 8 0 0 0-1.7-1L15 3h-6l-.5 2.7a8 8 0 0 0-1.7 1L4.5 6 2.5 9.5 4.5 11a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.5 2.3-.7a8 8 0 0 0 1.7 1L9 21h6l.5-2.7a8 8 0 0 0 1.7-1l2.3.7 2-3.5z" /></svg>
    default:
      return null
  }
}

function NavLink({ to, label, icon, active, onNavigate, collapsed }) {
  return (
    <Link
      to={to}
      className={`app-sidebar-link${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
    >
      <span className="app-sidebar-link-icon"><NavIcon name={icon} /></span>
      <span className="app-sidebar-link-label">{label}</span>
    </Link>
  )
}

function CollapseIcon({ direction = 'left' }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  if (direction === 'right') {
    return <svg {...props}><path d="m9 18 6-6-6-6" /></svg>
  }
  return <svg {...props}><path d="m15 18-6-6 6-6" /></svg>
}

export default function AppNavMenu({
  ocultarNav,
  mostrarProfe,
  mostrarAdmin,
  onNavigate,
  showBrand = true,
  showClose = false,
  onClose,
  collapsed = false,
  showCollapseToggle = false,
  onToggleCollapse,
}) {
  const location = useLocation()

  return (
    <>
      {showBrand && (
        <div className="app-sidebar-brand">
          <span className="app-sidebar-brand-mark" aria-hidden>⚡</span>
          <span className="app-sidebar-brand-text">Fitness Pro</span>
          {showClose && (
            <button type="button" className="app-nav-drawer-close" onClick={onClose} aria-label="Cerrar menú">
              ×
            </button>
          )}
        </div>
      )}
      <nav className="app-sidebar-nav">
        {NAV_ITEMS.map((item) => {
          if (item.requiresProfe && !mostrarProfe) return null
          if (item.requiresAdmin && !mostrarAdmin) return null
          if (ocultarNav(item.key)) return null
          return (
            <NavLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={location.pathname === item.to}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          )
        })}
        {showClose && !ocultarNav('config') && (
          <NavLink
            to="/config"
            label="Config"
            icon="config"
            active={location.pathname === '/config'}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        )}
      </nav>
      <div className="app-sidebar-bottom">
        {!showClose && !ocultarNav('config') && (
          <div className="app-sidebar-footer">
            <NavLink
              to="/config"
              label="Config"
              icon="config"
              active={location.pathname === '/config'}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          </div>
        )}
        {showCollapseToggle && (
          <button
            type="button"
            className="app-sidebar-collapse-btn"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            <span className="app-sidebar-collapse-btn-icon" aria-hidden="true">
              <CollapseIcon direction={collapsed ? 'right' : 'left'} />
            </span>
            <span className="app-sidebar-collapse-btn-label">
              {collapsed ? 'Expandir' : 'Contraer'}
            </span>
          </button>
        )}
      </div>
    </>
  )
}
