import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isNavModuleBlocked, defaultFallbackPath } from '../utils/navModules'

/** Acceso si al menos uno de rutina o ejercicios está permitido. */
export default function EntrenamientoModuleGate({ profile, profileLoading, roleNavMap, children }) {
  const { user, isConfigured } = useAuth()
  const location = useLocation()

  if (!isConfigured || !user) return children
  if (profileLoading) return children
  if (!profile || profile.role === 'admin') return children

  const blockedR = isNavModuleBlocked(profile, 'rutina', roleNavMap)
  const blockedE = isNavModuleBlocked(profile, 'ejercicios', roleNavMap)
  if (!blockedR || !blockedE) return children

  const fallback = defaultFallbackPath(profile, roleNavMap)
  const fallbackPath = fallback === '/' ? '/' : fallback
  const yaEnFallback =
    location.pathname === fallbackPath
    || (fallbackPath !== '/' && location.pathname.startsWith(`${fallbackPath}/`))

  if (yaEnFallback) {
    return (
      <section className="section py-2">
        <div className="container app-page-container">
          <div className="box">
            <p className="mb-2">Este módulo no está disponible para tu cuenta.</p>
            <Link to="/config" className="button is-link is-small">
              Ir a Config
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return <Navigate to={fallback} replace />
}
