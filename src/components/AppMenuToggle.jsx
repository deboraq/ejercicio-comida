import { useAppMobileNav } from '../context/AppMobileNavContext'

export default function AppMenuToggle({ className = '' }) {
  const nav = useAppMobileNav()
  if (!nav) return null

  return (
    <button
      type="button"
      className={`app-menu-toggle${className ? ` ${className}` : ''}`}
      aria-label={nav.open ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={nav.open}
      onClick={nav.toggle}
    >
      <span /><span /><span />
    </button>
  )
}
