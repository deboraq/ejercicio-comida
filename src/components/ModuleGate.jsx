import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isNavModuleBlocked, isCoachDefaultHiddenNav } from '../utils/navModules'

/** Redirige si el perfil tiene el módulo en `blocked_modules` (admin nunca bloqueado). */
export default function ModuleGate({ module, profile, profileLoading, children }) {
  const { user, isConfigured } = useAuth()

  if (!isConfigured || !user) return children
  if (profileLoading) return children
  if (!profile || profile.role === 'admin') return children
  if (isCoachDefaultHiddenNav(profile, module) || isNavModuleBlocked(profile, module)) {
    return <Navigate to="/config" replace />
  }
  return children
}
