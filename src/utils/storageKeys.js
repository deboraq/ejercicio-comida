import { normalizeStorageValue } from '../hooks/useLocalStorage'

/** Marca qué usuario dejó datos en claves legacy (sin prefijo) en este navegador. */
export const LEGACY_STORAGE_OWNER_KEY = 'fp.storageOwnerUserId'

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

export function markLegacyStorageOwner(userId) {
  if (!userId) return
  try {
    window.localStorage.setItem(LEGACY_STORAGE_OWNER_KEY, userId)
  } catch {
    /* noop */
  }
}

/** Solo usar claves legacy si pertenecen al usuario actual en este navegador. */
export function canUseLegacyStorage(logicalKey, userId) {
  if (!userId || !logicalKey) return false
  try {
    if (window.localStorage.getItem(logicalKey) == null) return false
    const owner = readLegacyStorageOwner()
    if (owner === userId) return true
    // Datos viejos sin dueño: solo el primer login en este dispositivo los reclama.
    if (owner == null) {
      const scopedKey = scopedStorageKey(logicalKey, userId)
      return window.localStorage.getItem(scopedKey) == null
    }
    return false
  } catch {
    return false
  }
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
 * Une localStorage scoped + legacy del usuario, persiste el resultado en scoped
 * y devuelve el valor normalizado (para no perder historial al cambiar de dispositivo).
 */
export function resolveUserLocalStorage(logicalKey, userId, initialValue, mergeArrays) {
  if (!userId) {
    return normalizeStorageValue(readJsonKey(logicalKey, null), initialValue)
  }

  const scopedKey = scopedStorageKey(logicalKey, userId)
  const scopedVal = readJsonKey(scopedKey, null)
  const legacyVal = canUseLegacyStorage(logicalKey, userId) ? readJsonKey(logicalKey, null) : null

  let merged = initialValue

  if (Array.isArray(initialValue)) {
    const scopedArr = Array.isArray(scopedVal) ? scopedVal : []
    const legacyArr = Array.isArray(legacyVal) ? legacyVal : []
    if (legacyArr.length === 0) merged = scopedArr
    else if (scopedArr.length === 0) merged = legacyArr
    else merged = mergeArrays(scopedArr, legacyArr)
  } else if (initialValue !== null && typeof initialValue === 'object') {
    const scopedObj =
      scopedVal !== null && typeof scopedVal === 'object' && !Array.isArray(scopedVal) ? scopedVal : initialValue
    const legacyObj =
      legacyVal !== null && typeof legacyVal === 'object' && !Array.isArray(legacyVal) ? legacyVal : null
    merged = legacyObj ? { ...scopedObj, ...legacyObj } : scopedObj
  } else {
    merged = legacyVal ?? scopedVal ?? initialValue
  }

  merged = normalizeStorageValue(merged, initialValue)

  try {
    const prev = scopedVal != null ? JSON.stringify(scopedVal) : null
    const next = JSON.stringify(merged)
    if (prev !== next) {
      window.localStorage.setItem(scopedKey, next)
      markLegacyStorageOwner(userId)
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
    markLegacyStorageOwner(userId)
    return true
  } catch {
    return false
  }
}
