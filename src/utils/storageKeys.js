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

/** Solo migrar claves legacy si pertenecen al usuario actual (mismo dispositivo). */
export function canUseLegacyStorage(logicalKey, userId) {
  if (!userId || !logicalKey) return true
  try {
    if (window.localStorage.getItem(logicalKey) == null) return false
    const owner = readLegacyStorageOwner()
    return !owner || owner === userId
  } catch {
    return false
  }
}

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
