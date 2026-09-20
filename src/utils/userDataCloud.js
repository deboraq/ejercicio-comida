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

export function invalidateAllUserDataCloudCache() {
  cacheByUser.clear()
  inflightByUser.clear()
  clearStorageHydration()
}

export function invalidateUserDataCloudCache(userId) {
  if (userId) {
    cacheByUser.delete(userId)
    clearStorageHydration(userId)
  }
  inflightByUser.delete(userId)
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

export function getUserDataCloudMap(userId) {
  if (!userId) return null
  return cacheByUser.get(userId) ?? null
}

const upsertQueueByUser = new Map()
let upsertFlushTimer = null

/** Agrupa subidas tras merge inicial para no bloquear la UI con N upserts. */
export function queueUserDataPersist(userId, key, value) {
  if (!userId || !key || !supabase) return
  patchUserDataCloudCache(userId, key, value)
  if (!upsertQueueByUser.has(userId)) upsertQueueByUser.set(userId, new Map())
  upsertQueueByUser.get(userId).set(key, value)
  clearTimeout(upsertFlushTimer)
  upsertFlushTimer = setTimeout(flushUserDataPersistQueue, 100)
}

function flushUserDataPersistQueue() {
  upsertFlushTimer = null
  if (!supabase) return
  for (const [userId, keyMap] of upsertQueueByUser) {
    const rows = [...keyMap.entries()].map(([key, value]) => ({
      user_id: userId,
      key,
      value,
      updated_at: new Date().toISOString(),
    }))
    if (rows.length) {
      supabase
        .from('user_data')
        .upsert(rows, { onConflict: 'user_id,key' })
        .then(({ error }) => {
          if (error) console.error('Error batch saving user_data:', error)
        })
    }
  }
  upsertQueueByUser.clear()
}
