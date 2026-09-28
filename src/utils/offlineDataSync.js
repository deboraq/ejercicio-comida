import { supabase } from '../lib/supabase'
import { patchUserDataCloudCache } from './userDataCloud'

const QUEUE_STORAGE_KEY = 'fitnesspro_offline_sync_v1'
const SYNC_EVENT = 'fitnesspro-sync-status'

/** @type {Map<string, Map<string, unknown>>} userId → key → value */
const pendingByUser = new Map()
let flushTimer = null
let flushing = false

export function isAppOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

function emitSyncStatus(extra = {}) {
  if (typeof window === 'undefined') return
  let pendingKeys = 0
  for (const m of pendingByUser.values()) pendingKeys += m.size
  window.dispatchEvent(
    new CustomEvent(SYNC_EVENT, {
      detail: {
        online: isAppOnline(),
        pendingKeys,
        syncing: flushing,
        ...extra,
      },
    }),
  )
}

function persistQueueToDisk() {
  try {
    const obj = {}
    for (const [userId, keyMap] of pendingByUser) {
      obj[userId] = Object.fromEntries(keyMap)
    }
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(obj))
  } catch {
    /* quota / private mode */
  }
}

function loadQueueFromDisk() {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY)
    if (!raw) return
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return
    pendingByUser.clear()
    for (const [userId, keys] of Object.entries(obj)) {
      if (!keys || typeof keys !== 'object') continue
      const map = new Map()
      for (const [key, value] of Object.entries(keys)) {
        map.set(key, value)
      }
      if (map.size) pendingByUser.set(userId, map)
    }
  } catch {
    /* ignore corrupt queue */
  }
}

function clearQueueOnDisk() {
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function getOfflineQueuePendingCount() {
  let n = 0
  for (const m of pendingByUser.values()) n += m.size
  return n
}

/** Encola o sube un valor de user_data (localStorage ya actualizado en useStorage). */
export function scheduleCloudPersist(userId, key, value) {
  if (!userId || key == null) return
  patchUserDataCloudCache(userId, key, value)
  if (!pendingByUser.has(userId)) pendingByUser.set(userId, new Map())
  pendingByUser.get(userId).set(key, value)
  persistQueueToDisk()
  emitSyncStatus()
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushPendingCloudWrites().catch(() => {})
  }, 120)
}

export async function flushPendingCloudWrites() {
  if (!supabase || !isAppOnline() || flushing) return { flushed: 0 }
  if (pendingByUser.size === 0) {
    clearQueueOnDisk()
    emitSyncStatus()
    return { flushed: 0 }
  }

  flushing = true
  emitSyncStatus()

  let flushed = 0
  const errors = []

  for (const [userId, keyMap] of [...pendingByUser.entries()]) {
    const rows = [...keyMap.entries()].map(([key, value]) => ({
      user_id: userId,
      key,
      value,
      updated_at: new Date().toISOString(),
    }))
    if (!rows.length) continue

    // eslint-disable-next-line no-await-in-loop
    const { error } = await supabase.from('user_data').upsert(rows, { onConflict: 'user_id,key' })
    if (error) {
      errors.push(error)
      continue
    }
    flushed += rows.length
    pendingByUser.delete(userId)
  }

  if (pendingByUser.size === 0) clearQueueOnDisk()
  else persistQueueToDisk()

  flushing = false
  emitSyncStatus({ lastFlush: Date.now(), flushError: errors[0]?.message || null })
  return { flushed, errors }
}

export function initOfflineDataSync() {
  loadQueueFromDisk()
  emitSyncStatus()

  if (typeof window === 'undefined') return

  window.addEventListener('online', () => {
    flushPendingCloudWrites().catch(() => {})
  })

  window.addEventListener('offline', () => {
    emitSyncStatus()
  })

  if (isAppOnline() && getOfflineQueuePendingCount() > 0) {
    flushPendingCloudWrites().catch(() => {})
  }
}

export const OFFLINE_SYNC_EVENT = SYNC_EVENT
