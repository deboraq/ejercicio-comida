import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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
import { isNavModuleBlocked } from './utils/navModules'
import './App.css'

function NavLink({ to, children, icon }) {
  const location = useLocation()
  const active = location.pathname === to
  return (
    <Link
      to={to}
      className={`navbar-item is-flex is-flex-direction-column has-text-centered ${active ? 'is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="navbar-emoji">{icon}</span>
      <span className="is-size-7">{children}</span>
    </Link>
  )
}

function AppRoutes() {
  const location = useLocation()
  const { user, isConfigured } = useAuth()
  const { profile, loading: profileLoading } = useMyProfile()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/reset-password'
  /* Profe: con Supabase alcanza; la pantalla pide login si hace falta */
  const mostrarProfe = Boolean(isConfigured)
  const mostrarAdmin = Boolean(isConfigured && profile?.role === 'admin')

  const ocultarNav = (clave) => {
    if (!isConfigured || !user) return false
    if (profileLoading) return false
    if (!profile || profile.role === 'admin') return false
    return isNavModuleBlocked(profile, clave)
  }

  return (
    <>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ModuleGate module="inicio" profile={profile} profileLoading={profileLoading}><Inicio /></ModuleGate>} />
          <Route path="/ejercicios" element={<ModuleGate module="ejercicios" profile={profile} profileLoading={profileLoading}><Ejercicios /></ModuleGate>} />
          <Route path="/rutina" element={<ModuleGate module="rutina" profile={profile} profileLoading={profileLoading}><Rutina /></ModuleGate>} />
          <Route path="/comida" element={<ModuleGate module="comida" profile={profile} profileLoading={profileLoading}><Comida /></ModuleGate>} />
          <Route path="/config" element={<Config />} />
          <Route path="/profe" element={<ModuleGate module="profe" profile={profile} profileLoading={profileLoading}><Profe /></ModuleGate>} />
          <Route path="/admin" element={<ModuleGate module="admin" profile={profile} profileLoading={profileLoading}><Admin /></ModuleGate>} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </main>
      {!isAuthPage && (
        <nav className="navbar is-fixed-bottom has-shadow" role="navigation" aria-label="Principal">
          <div className="navbar-menu is-active">
            <div className="navbar-start" style={{ flexGrow: 1, justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
              {!ocultarNav('inicio') && <NavLink to="/" icon="🏠">Inicio</NavLink>}
              {!ocultarNav('ejercicios') && <NavLink to="/ejercicios" icon="🏃">Ejercicios</NavLink>}
              {!ocultarNav('rutina') && <NavLink to="/rutina" icon="🏋️">Rutina</NavLink>}
              {!ocultarNav('comida') && <NavLink to="/comida" icon="🥗">Comida</NavLink>}
              {mostrarProfe && !ocultarNav('profe') && <NavLink to="/profe" icon="🧑‍🏫">Profe</NavLink>}
              {mostrarAdmin && !ocultarNav('admin') && <NavLink to="/admin" icon="🛡️">Admin</NavLink>}
              <NavLink to="/config" icon="⚙️">Config</NavLink>
            </div>
          </div>
        </nav>
      )}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app-layout">
        <AppRoutes />
      </div>
    </AuthProvider>
  )
}
