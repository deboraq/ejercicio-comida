import { supabase } from '../lib/supabase'
import { clearStorageHydration } from './storageHydration'
import { scheduleCloudPersist } from './offlineDataSync'

/** Una sola petición por sesión; evita N consultas paralelas a user_data. */
const inflightByUser = new Map()
const cacheByUser = new Map()
/** true = última lectura OK; false = falló (no subir merge para no pisar otros dispositivos). */
const lastFetchOkByUser = new Map()

function rowsToMap(rows) {
  const map = Object.create(null)
  if (!Array.isArray(rows)) return map
  for (const row of rows) {
    if (row?.key != null) map[row.key] = row.value
  }
  return map
}

export function invalidateAllUserDataCloudCache() {
  cacheByUser.clear()
  inflightByUser.clear()
  lastFetchOkByUser.clear()
  clearStorageHydration()
}

export function invalidateUserDataCloudCache(userId) {
  if (userId) {
    cacheByUser.delete(userId)
    lastFetchOkByUser.delete(userId)
    clearStorageHydration(userId)
  }
  inflightByUser.delete(userId)
}

export function didLastCloudFetchSucceed(userId) {
  return lastFetchOkByUser.get(userId) === true
}

/** Disparado tras volver a traer user_data (p. ej. al enfocar la pestaña). */
export const USER_DATA_CLOUD_REFRESH = 'fitnesspro-user-data-refresh'

export function emitUserDataCloudRefresh(userId) {
  if (typeof window === 'undefined' || !userId) return
  window.dispatchEvent(new CustomEvent(USER_DATA_CLOUD_REFRESH, { detail: { userId } }))
}

export async function refreshAllUserDataCloud(userId) {
  if (!userId || !supabase) return Object.create(null)
  invalidateUserDataCloudCache(userId)
  const map = await fetchAllUserDataCloud(userId)
  emitUserDataCloudRefresh(userId)
  return map
}

function runFetch(userId) {
  return supabase
    .from('user_data')
    .select('key, value')
    .eq('user_id', userId)
    .then(({ data, error }) => {
      inflightByUser.delete(userId)
      if (error) {
        console.error('Error loading user_data (batch):', error)
        lastFetchOkByUser.set(userId, false)
        return Object.create(null)
      }
      const map = rowsToMap(data)
      cacheByUser.set(userId, map)
      lastFetchOkByUser.set(userId, true)
      return map
    })
}

/** Devuelve mapa clave → value (JSON) desde Supabase. */
export async function fetchAllUserDataCloud(userId) {
  if (!userId || !supabase) return Object.create(null)

  if (cacheByUser.has(userId)) return cacheByUser.get(userId)

  let inflight = inflightByUser.get(userId)
  if (!inflight) {
    inflight = runFetch(userId)
    inflightByUser.set(userId, inflight)
  }

  return inflight
}

export function userDataCloudCached(userId) {
  return Boolean(userId && cacheByUser.has(userId))
}

export function patchUserDataCloudCache(userId, key, value) {
  if (!userId || key == null) return
  const prev = cacheByUser.get(userId) || Object.create(null)
  cacheByUser.set(userId, { ...prev, [key]: value })
}

export function getUserDataCloudMap(userId) {
  if (!userId) return null
  return cacheByUser.get(userId) ?? null
}

/** Agrupa subidas tras merge inicial para no bloquear la UI con N upserts. */
export function queueUserDataPersist(userId, key, value) {
  if (!userId || !key || !supabase) return
  scheduleCloudPersist(userId, key, value)
}
