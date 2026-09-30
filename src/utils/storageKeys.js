import { normalizeStorageValue } from '../hooks/useLocalStorage'

/** Marca qué usuario dejó datos en claves legacy (sin prefijo) en este navegador. */
export const LEGACY_STORAGE_OWNER_KEY = 'fp.storageOwnerUserId'

/** Claves persistidas vía useStorage (para aislar legacy por usuario). */
export const APP_STORAGE_LOGICAL_KEYS = [
  'ejercicios',
  'comida',
  'suplementos',
  'rutinaPesos',
  'pesoHistorial',
  'medidasHistorial',
  'config',
  'planPropio',
  'planMes1Estado',
  'planesNutricion',
  'planNutricionActivoId',
  'hidratacionDia',
  'comidaFavoritos',
  'rutinas',
  'rutinasAsignadas',
  'rutinaActivaId',
  'profePlantillasRutina',
  'profeCatalogoEjercicios',
  'profeCatalogoMeta',
  'profeCatalogoFavoritos',
  'profeCatalogoCategorias',
  'profeNotasPrivadas',
  'profeFeedbackAlumnos',
  'inicioAccesosFavoritos',
]

/** Clave localStorage por usuario; sin sesión se usa la clave lógica (modo offline). */
export function scopedStorageKey(logicalKey, userId) {
  if (!logicalKey) return logicalKey
  if (!userId) return logicalKey
  return `ud:${userId}:${logicalKey}`
}

export function readLegacyStorageOwner() {
  try {
    return window.localStorage.getItem(LEGACY_STORAGE_OWNER_KEY)
  } catch {
    return null
  }
}

function moveLegacyKeyToScoped(logicalKey, userId) {
  if (!userId || !logicalKey) return
  const scopedKey = scopedStorageKey(logicalKey, userId)
  try {
    const legacy = window.localStorage.getItem(logicalKey)
    if (legacy == null) return
    if (window.localStorage.getItem(scopedKey) == null) {
      window.localStorage.setItem(scopedKey, legacy)
    }
    window.localStorage.removeItem(logicalKey)
  } catch {
    /* noop */
  }
}

/** Mueve claves sin prefijo al namespace del usuario (no deben leerse al cambiar de cuenta). */
export function sealLegacyStorageForUser(userId) {
  if (!userId) return
  for (const key of APP_STORAGE_LOGICAL_KEYS) {
    moveLegacyKeyToScoped(key, userId)
  }
}

export function clearLegacyStorageOwner() {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_OWNER_KEY)
  } catch {
    /* noop */
  }
}

/**
 * Al iniciar sesión: aislar datos legacy del usuario anterior y marcar dueño actual.
 * Nunca asignar claves legacy sin prefijo a otro userId (evita ver rutina/datos ajenos).
 */
export function markLegacyStorageOwner(newUserId) {
  if (!newUserId) return
  try {
    const prev = readLegacyStorageOwner()
    if (prev && prev !== newUserId) {
      sealLegacyStorageForUser(prev)
    } else if (prev == null) {
      moveLegacyKeyToScopedForUser(newUserId)
    }
    window.localStorage.setItem(LEGACY_STORAGE_OWNER_KEY, newUserId)
  } catch {
    /* noop */
  }
}

/** Solo cuando no había dueño: reclamar legacy huérfano para este usuario (mismo dispositivo, una cuenta). */
function moveLegacyKeyToScopedForUser(userId) {
  if (!userId) return
  let hadLegacy = false
  for (const key of APP_STORAGE_LOGICAL_KEYS) {
    try {
      if (window.localStorage.getItem(key) != null) hadLegacy = true
    } catch {
      /* ignore */
    }
  }
  if (!hadLegacy) return
  for (const key of APP_STORAGE_LOGICAL_KEYS) {
    moveLegacyKeyToScoped(key, userId)
  }
}

/** Las claves sin prefijo ya no se leen; solo `ud:{userId}:…`. */
export function canUseLegacyStorage(_logicalKey, _userId) {
  return false
}

function readJsonKey(storageKey, fallback = null) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw != null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

/**
 * Lee solo localStorage con prefijo de usuario (sin mezclar cuentas en el mismo navegador).
 */
export function resolveUserLocalStorage(logicalKey, userId, initialValue, mergeArrays) {
  if (!userId) {
    return normalizeStorageValue(readJsonKey(logicalKey, null), initialValue)
  }

  const scopedKey = scopedStorageKey(logicalKey, userId)
  const scopedVal = readJsonKey(scopedKey, null)

  let merged = initialValue

  if (Array.isArray(initialValue)) {
    merged = Array.isArray(scopedVal) ? scopedVal : []
  } else if (initialValue !== null && typeof initialValue === 'object') {
    merged =
      scopedVal !== null && typeof scopedVal === 'object' && !Array.isArray(scopedVal)
        ? scopedVal
        : initialValue
  } else {
    merged = scopedVal ?? initialValue
  }

  merged = normalizeStorageValue(merged, initialValue)

  try {
    const prev = scopedVal != null ? JSON.stringify(scopedVal) : null
    const next = JSON.stringify(merged)
    if (prev !== next) {
      window.localStorage.setItem(scopedKey, next)
    }
  } catch {
    /* noop */
  }

  return merged
}

/** @deprecated Usar resolveUserLocalStorage */
export function migrateLegacyStorageToScoped(logicalKey, userId) {
  if (!userId || !logicalKey) return false
  const scoped = scopedStorageKey(logicalKey, userId)
  try {
    if (window.localStorage.getItem(scoped) != null) return false
    const legacy = window.localStorage.getItem(logicalKey)
    if (legacy == null) return false
    if (!canUseLegacyStorage(logicalKey, userId)) return false
    window.localStorage.setItem(scoped, legacy)
    window.localStorage.removeItem(logicalKey)
    markLegacyStorageOwner(userId)
    return true
  } catch {
    return false
  }
}
