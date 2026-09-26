import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS, NavIcon } from './AppNavMenu'

const BOTTOM_PRIMARY_KEYS = ['inicio', 'rutina', 'comida', 'ejercicios']

const SHORT_LABELS = {
  ejercicios: 'Ejerc.',
}

function navActive(pathname, to) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function buildBottomItems({ ocultarNav, mostrarProfe, mostrarAdmin }) {
  const items = []
  for (const key of BOTTOM_PRIMARY_KEYS) {
    const item = NAV_ITEMS.find((i) => i.key === key)
    if (!item) continue
    if (ocultarNav(item.key)) continue
    items.push(item)
  }
  if (!ocultarNav('config')) {
    items.push({ to: '/config', key: 'config', label: 'Config', icon: 'config' })
  }
  for (const item of NAV_ITEMS) {
    if (item.requiresProfe && !mostrarProfe) continue
    if (item.requiresAdmin && !mostrarAdmin) continue
    if (!item.requiresProfe && !item.requiresAdmin) continue
    if (ocultarNav(item.key)) continue
    if (items.some((i) => i.key === item.key)) continue
    items.push(item)
  }
  return items
}

export default function AppBottomNav({ ocultarNav, mostrarProfe, mostrarAdmin }) {
  const location = useLocation()
  const items = buildBottomItems({ ocultarNav, mostrarProfe, mostrarAdmin })
  if (items.length === 0) return null

  return (
    <nav className="app-bottom-nav" aria-label="Navegación principal">
      {items.map((item) => {
        const active = navActive(location.pathname, item.to)
        const label = SHORT_LABELS[item.key] ?? item.label
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`app-bottom-nav-link${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="app-bottom-nav-icon">
              <NavIcon name={item.icon} />
            </span>
            <span className="app-bottom-nav-label">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
