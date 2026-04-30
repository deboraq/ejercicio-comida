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
  const { isConfigured } = useAuth()
  const { profile } = useMyProfile()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/reset-password'
  /* Profe: con Supabase alcanza; la pantalla pide login si hace falta */
  const mostrarProfe = Boolean(isConfigured)
  const mostrarAdmin = Boolean(isConfigured && profile?.role === 'admin')

  return (
    <>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/ejercicios" element={<Ejercicios />} />
          <Route path="/rutina" element={<Rutina />} />
          <Route path="/comida" element={<Comida />} />
          <Route path="/config" element={<Config />} />
          <Route path="/profe" element={<Profe />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </main>
      {!isAuthPage && (
        <nav className="navbar is-fixed-bottom has-shadow" role="navigation" aria-label="Principal">
          <div className="navbar-menu is-active">
            <div className="navbar-start" style={{ flexGrow: 1, justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
              <NavLink to="/" icon="🏠">Inicio</NavLink>
              <NavLink to="/ejercicios" icon="🏃">Ejercicios</NavLink>
              <NavLink to="/rutina" icon="🏋️">Rutina</NavLink>
              <NavLink to="/comida" icon="🥗">Comida</NavLink>
              {mostrarProfe && <NavLink to="/profe" icon="🧑‍🏫">Profe</NavLink>}
              {mostrarAdmin && <NavLink to="/admin" icon="🛡️">Admin</NavLink>}
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
