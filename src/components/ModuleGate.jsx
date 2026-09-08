import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isNavModuleBlocked, defaultFallbackPath } from '../utils/navModules'

/** Redirige si el módulo está oculto por rol + `blocked_modules` (admin nunca bloqueado en la app). */
export default function ModuleGate({ module, profile, profileLoading, roleNavMap, children }) {
  const { user, isConfigured } = useAuth()
  const location = useLocation()

  if (!isConfigured || !user) return children
  if (profileLoading) return children
  if (!profile || profile.role === 'admin') return children
  if (!isNavModuleBlocked(profile, module, roleNavMap)) return children

  const fallback = defaultFallbackPath(profile, roleNavMap)
  const fallbackPath = fallback === '/' ? '/' : fallback
  const yaEnFallback =
    location.pathname === fallbackPath ||
    (fallbackPath !== '/' && location.pathname.startsWith(`${fallbackPath}/`))

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
