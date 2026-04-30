/** Valores por defecto si aún no existe la tabla `role_nav_hidden` en Supabase. */
export const DEFAULT_ROLE_NAV_HIDDEN = {
  alumno: [],
  profe: ['inicio', 'ejercicios', 'rutina', 'comida'],
  admin: [],
}

/** Claves guardadas en `profiles.blocked_modules` (extras por usuario, además del rol). */
export const BLOCKABLE_NAV_KEYS = ['inicio', 'ejercicios', 'rutina', 'comida', 'profe', 'admin']

export const BLOCKABLE_LABELS = {
  inicio: 'Inicio',
  ejercicios: 'Ejercicios',
  rutina: 'Rutina',
  comida: 'Comida',
  profe: 'Profe',
  admin: 'Admin',
}

/** Compat: mismo array que antes para `profe` por defecto. */
export const COACH_DEFAULT_HIDDEN_NAV = [...DEFAULT_ROLE_NAV_HIDDEN.profe]

export function normalizeRoleNavMap(raw) {
  const out = {
    alumno: [...(DEFAULT_ROLE_NAV_HIDDEN.alumno || [])],
    profe: [...(DEFAULT_ROLE_NAV_HIDDEN.profe || [])],
    admin: [...(DEFAULT_ROLE_NAV_HIDDEN.admin || [])],
  }
  if (!raw || typeof raw !== 'object') return out
  for (const role of ['alumno', 'profe', 'admin']) {
    if (Array.isArray(raw[role])) {
      out[role] = [...new Set(raw[role].filter(Boolean))]
    }
  }
  return out
}

export function roleHiddenKeys(role, roleNavMap) {
  if (roleNavMap && typeof roleNavMap === 'object' && Array.isArray(roleNavMap[role])) {
    return roleNavMap[role].filter(Boolean)
  }
  return [...(DEFAULT_ROLE_NAV_HIDDEN[role] || [])]
}

/**
 * Pestañas ocultas = (las del rol ∪ `blocked_modules`) \ `nav_force_visible`.
 * Así el admin puede mostrar una pestaña que el rol oculta por defecto, sin perder extras en `blocked_modules`.
 */
export function effectiveHiddenNavKeys(profile, roleNavMap) {
  if (!profile || profile.role === 'admin') return new Set()
  const fromRole = roleHiddenKeys(profile.role, roleNavMap)
  const fromUser = Array.isArray(profile.blocked_modules) ? profile.blocked_modules : []
  const force = Array.isArray(profile.nav_force_visible) ? profile.nav_force_visible : []
  const merged = new Set([...fromRole, ...fromUser].filter(Boolean))
  for (const k of force) merged.delete(k)
  return merged
}

/** Conjunto de pestañas ocultas tal como lo muestra el admin (misma fórmula que la app). */
export function adminHiddenCheckboxSet(role, blockedModules, navForceVisible, roleNavMap) {
  return effectiveHiddenNavKeys(
    { role, blocked_modules: blockedModules, nav_force_visible: navForceVisible },
    roleNavMap
  )
}

/** Convierte el estado de checkboxes «ocultar» en lo que se guarda en `profiles`. */
export function toNavStorageFromHiddenSet(rol, hiddenSet, roleNavMap) {
  const rk = new Set(roleHiddenKeys(rol, roleNavMap))
  const hidden = hiddenSet instanceof Set ? hiddenSet : new Set(hiddenSet || [])
  const nav_force_visible = [...rk].filter((k) => !hidden.has(k))
  const blocked_modules = [...hidden].filter((k) => !rk.has(k))
  return { blocked_modules, nav_force_visible }
}

export function isNavModuleBlocked(profile, key, roleNavMap) {
  return effectiveHiddenNavKeys(profile, roleNavMap).has(key)
}
