/** Módulos que los entrenadores no ven por defecto (trabajan solo desde Profe; el admin puede forzar más vía `blocked_modules`). */
export const COACH_DEFAULT_HIDDEN_NAV = ['inicio', 'ejercicios', 'rutina', 'comida']

/** Claves guardadas en `profiles.blocked_modules` (sin config: siempre visible). */
export const BLOCKABLE_NAV_KEYS = ['inicio', 'ejercicios', 'rutina', 'comida', 'profe', 'admin']

export const BLOCKABLE_LABELS = {
  inicio: 'Inicio',
  ejercicios: 'Ejercicios',
  rutina: 'Rutina',
  comida: 'Comida',
  profe: 'Profe',
  admin: 'Admin',
}

export function blockedModuleSet(profile) {
  if (!profile || profile.role === 'admin') return new Set()
  const raw = profile.blocked_modules
  const arr = Array.isArray(raw) ? raw : []
  return new Set(arr.filter(Boolean))
}

export function isNavModuleBlocked(profile, key) {
  return blockedModuleSet(profile).has(key)
}

/** Rol entrenador: menú distinto al del alumno (sin tocar la base de datos). */
export function isCoachDefaultHiddenNav(profile, key) {
  if (!profile || profile.role !== 'profe') return false
  return COACH_DEFAULT_HIDDEN_NAV.includes(key)
}
