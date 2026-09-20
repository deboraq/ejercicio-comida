import { supabase } from '../lib/supabase'

/** Una sola petición por sesión; evita N consultas paralelas a user_data. */
const inflightByUser = new Map()
const cacheByUser = new Map()

function rowsToMap(rows) {
  const map = Object.create(null)
  if (!Array.isArray(rows)) return map
  for (const row of rows) {
    if (row?.key != null) map[row.key] = row.value
  }
  return map
}

export function invalidateUserDataCloudCache(userId) {
  if (userId) cacheByUser.delete(userId)
  inflightByUser.delete(userId)
}

export function invalidateAllUserDataCloudCache() {
  cacheByUser.clear()
  inflightByUser.clear()
}

/** Devuelve mapa clave → value (JSON) desde Supabase. */
export async function fetchAllUserDataCloud(userId) {
  if (!userId || !supabase) return Object.create(null)

  if (cacheByUser.has(userId)) return cacheByUser.get(userId)

  let inflight = inflightByUser.get(userId)
  if (!inflight) {
    inflight = supabase
      .from('user_data')
      .select('key, value')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        inflightByUser.delete(userId)
        if (error) {
          console.error('Error loading user_data (batch):', error)
          return Object.create(null)
        }
        const map = rowsToMap(data)
        cacheByUser.set(userId, map)
        return map
      })
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
