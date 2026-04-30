import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isNavModuleBlocked, defaultFallbackPath } from '../utils/navModules'

/** Redirige si el módulo está oculto por rol + `blocked_modules` (admin nunca bloqueado en la app). */
export default function ModuleGate({ module, profile, profileLoading, roleNavMap, children }) {
  const { user, isConfigured } = useAuth()

  if (!isConfigured || !user) return children
  if (profileLoading) return children
  if (!profile || profile.role === 'admin') return children
  if (isNavModuleBlocked(profile, module, roleNavMap)) {
    return <Navigate to={defaultFallbackPath(profile, roleNavMap)} replace />
  }
  return children
}
