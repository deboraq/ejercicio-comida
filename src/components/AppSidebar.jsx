import AppNavMenu from './AppNavMenu'

export default function AppSidebar({ collapsed, onToggleCollapse, ...props }) {
  return (
    <aside
      className={`app-sidebar app-sidebar--desktop${collapsed ? ' is-collapsed' : ''}`}
      aria-label="Navegación principal"
      aria-expanded={!collapsed}
    >
      <AppNavMenu
        {...props}
        collapsed={collapsed}
        showCollapseToggle
        onToggleCollapse={onToggleCollapse}
      />
    </aside>
  )
}
