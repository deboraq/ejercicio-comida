/** Claves ya fusionadas en esta sesión (evita re-merge al cambiar de pantalla). */
const hydratedByUser = new Map()

export function markStorageKeyHydrated(userId, key) {
  if (!userId || !key) return
  if (!hydratedByUser.has(userId)) hydratedByUser.set(userId, new Set())
  hydratedByUser.get(userId).add(key)
}

export function isStorageKeyHydrated(userId, key) {
  return Boolean(userId && key && hydratedByUser.get(userId)?.has(key))
}

export function clearStorageHydration(userId) {
  if (userId) hydratedByUser.delete(userId)
  else hydratedByUser.clear()
}
