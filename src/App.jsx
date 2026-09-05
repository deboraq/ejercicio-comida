import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppNotificationsProvider, AppNotificacionesCampana } from './context/AppNotificationsContext'
import { RoleNavProvider, useRoleNav } from './context/RoleNavContext'
import Inicio from './pages/Inicio'
import Ejercicios from './pages/Ejercicios'
import Rutina from './pages/Rutina'
import Comida from './pages/Comida'
import Config from './pages/Config'
import Profe from './pages/Profe'
import Admin from './pages/Admin'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import { useMyProfile } from './hooks/useMyProfile'
import ModuleGate from './components/ModuleGate'
import AppSidebar from './components/AppSidebar'
import AppNavMenu from './components/AppNavMenu'
import { isNavModuleBlocked } from './utils/navModules'
import './App.css'

const SIDEBAR_COLLAPSED_KEY = 'app-sidebar-collapsed'

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function AppRoutes() {
  const location = useLocation()
  const { user, isConfigured } = useAuth()
  const { profile, loading: profileLoading } = useMyProfile()
  const { roleNavMap } = useRoleNav()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const isAuthPage = location.pathname === '/login' || location.pathname === '/reset-password'
  const mostrarProfe = Boolean(isConfigured)
  const mostrarAdmin = Boolean(isConfigured && profile?.role === 'admin')

  const ocultarNav = (clave) => {
    if (!isConfigured || !user) return false
    if (profileLoading) return false
    if (!profile || profile.role === 'admin') return false
    return isNavModuleBlocked(profile, clave, roleNavMap)
  }

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const navProps = {
    ocultarNav,
    mostrarProfe,
    mostrarAdmin,
    onNavigate: () => setMobileNavOpen(false),
  }

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileNavOpen])

  return (
    <div
      className={`app-shell${isAuthPage ? ' app-shell--auth' : ''}${sidebarCollapsed ? ' app-shell--sidebar-collapsed' : ''}`}
    >
      {!isAuthPage && (
        <AppSidebar
          {...navProps}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapsed}
        />
      )}
      {!isAuthPage && (
        <div className={`app-nav-drawer${mobileNavOpen ? ' is-open' : ''}`} aria-hidden={!mobileNavOpen}>
          <button
            type="button"
            className="app-nav-overlay"
            aria-label="Cerrar menú"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="app-sidebar app-sidebar--drawer" aria-label="Menú de navegación">
            <AppNavMenu
              {...navProps}
              showClose
              onClose={() => setMobileNavOpen(false)}
            />
          </aside>
        </div>
      )}
      <div className="app-shell-main">
        {!isAuthPage && (
          <header className={`app-topbar${location.pathname === '/' ? ' app-topbar--inicio' : ''}${location.pathname.startsWith('/rutina') ? ' app-topbar--rutina' : ''}`}>
            <button
              type="button"
              className="app-menu-toggle"
              aria-label={mobileNavOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <span /><span /><span />
            </button>
            {location.pathname !== '/' && !location.pathname.startsWith('/rutina') && (
              <p className="app-topbar-title mb-0">
                {location.pathname.startsWith('/ejercicios') && 'Ejercicios'}
                {location.pathname.startsWith('/comida') && 'Comida'}
                {location.pathname.startsWith('/config') && 'Config'}
                {location.pathname.startsWith('/profe') && 'Profe'}
                {location.pathname.startsWith('/admin') && 'Admin'}
              </p>
            )}
            <div className="app-topbar-spacer" />
            {location.pathname !== '/' && !location.pathname.startsWith('/rutina') && <AppNotificacionesCampana />}
          </header>
        )}
        <main className={`main-content${location.pathname === '/' ? ' main-content--inicio' : ''}${location.pathname.startsWith('/rutina') ? ' main-content--rutina' : ''}`}>
          <Routes>
            <Route path="/" element={<ModuleGate module="inicio" profile={profile} profileLoading={profileLoading} roleNavMap={roleNavMap}><Inicio /></ModuleGate>} />
            <Route path="/ejercicios" element={<ModuleGate module="ejercicios" profile={profile} profileLoading={profileLoading} roleNavMap={roleNavMap}><Ejercicios /></ModuleGate>} />
            <Route path="/rutina" element={<ModuleGate module="rutina" profile={profile} profileLoading={profileLoading} roleNavMap={roleNavMap}><Rutina /></ModuleGate>} />
            <Route path="/comida" element={<ModuleGate module="comida" profile={profile} profileLoading={profileLoading} roleNavMap={roleNavMap}><Comida /></ModuleGate>} />
            <Route
              path="/config"
              element={
                <ModuleGate module="config" profile={profile} profileLoading={profileLoading} roleNavMap={roleNavMap}>
                  <Config />
                </ModuleGate>
              }
            />
            <Route path="/profe" element={<ModuleGate module="profe" profile={profile} profileLoading={profileLoading} roleNavMap={roleNavMap}><Profe /></ModuleGate>} />
            <Route path="/admin" element={<ModuleGate module="admin" profile={profile} profileLoading={profileLoading} roleNavMap={roleNavMap}><Admin /></ModuleGate>} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppNotificationsProvider>
        <RoleNavProvider>
          <div className="app-layout">
            <AppRoutes />
          </div>
        </RoleNavProvider>
      </AppNotificationsProvider>
    </AuthProvider>
  )
}
