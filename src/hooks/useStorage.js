import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useLocalStorage, normalizeStorageValue, mergeStorageArrays } from './useLocalStorage'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  scopedStorageKey,
  markLegacyStorageOwner,
  resolveUserLocalStorage,
} from '../utils/storageKeys'
import { mergeCloudAndLocal, shouldUploadMerged, isStorageInitial } from '../utils/storageMerge'
import { normalizarSuplementosPorDia } from '../utils/suplementosStorage'
import {
  fetchAllUserDataCloud,
  invalidateUserDataCloudCache,
  patchUserDataCloudCache,
  userDataCloudCached,
} from '../utils/userDataCloud'

function persistUserData(userId, key, value) {
  if (!supabase || !userId) return Promise.resolve({ error: null })
  patchUserDataCloudCache(userId, key, value)
  return supabase
    .from('user_data')
    .upsert(
      { user_id: userId, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' },
    )
    .then(({ error }) => {
      if (error) console.error('Error saving user_data:', error)
      return { error }
    })
}

/**
 * Almacenamiento por clave: con sesión + Supabase, la nube es la fuente de verdad entre dispositivos.
 * Tercer valor: `cloudReady` — esperalo antes de sembrar datos automáticos (peso, etc.).
 */
export function useStorage(key, initialValue) {
  const initialRef = useRef(initialValue)
  const { user, isConfigured } = useAuth()
  const localKey = scopedStorageKey(key, user?.id)
  const [localVal, setLocalVal] = useLocalStorage(localKey, initialRef.current)
  const [cloudVal, setCloudVal] = useState(null)
  const [cloudReady, setCloudReady] = useState(false)
  const valueRef = useRef(localVal)
  const localValRef = useRef(localVal)
  const pendingCloudPersistRef = useRef(null)
  const initial = initialRef.current

  useEffect(() => {
    localValRef.current = localVal
  }, [localVal])

  const value = useMemo(() => {
    if (!user || !isConfigured || !cloudReady) return localVal
    return cloudVal ?? localVal
  }, [user, isConfigured, cloudReady, localVal, cloudVal])

  const safeValue = normalizeStorageValue(value, initial)
  valueRef.current = safeValue

  useEffect(() => {
    if (!user || !isConfigured || !supabase) {
      setCloudReady(false)
      setCloudVal(null)
      return
    }

    let cancelled = false
    const cacheHit = userDataCloudCached(user.id)
    if (!cacheHit) {
      setCloudReady(false)
      setCloudVal(null)
    }

    const load = async () => {
      const cloudMap = await fetchAllUserDataCloud(user.id)

      if (cancelled) return

      const fromLs = resolveUserLocalStorage(key, user.id, initial, mergeStorageArrays)
      const fromLive = normalizeStorageValue(localValRef.current, initial)
      let localNorm = fromLs

      if (Array.isArray(initial) && !isStorageInitial(fromLive, initial)) {
        if (key === 'suplementos') {
          localNorm = normalizarSuplementosPorDia(
            mergeStorageArrays(
              normalizarSuplementosPorDia(fromLs),
              normalizarSuplementosPorDia(fromLive),
            ),
          )
        } else {
          localNorm = mergeStorageArrays(fromLs, fromLive)
        }
      }

      const fromCloud = normalizeStorageValue(
        cloudMap[key] != null ? cloudMap[key] : null,
        initial,
      )
      const cloudRowExists = Object.prototype.hasOwnProperty.call(cloudMap, key)

      let resolved = mergeCloudAndLocal(key, localNorm, fromCloud, initial)

      if (shouldUploadMerged(key, resolved, fromCloud, initial, cloudRowExists)) {
        persistUserData(user.id, key, resolved)
      }

      if (cancelled) return

      setCloudVal(resolved)
      localValRef.current = resolved
      setLocalVal((prev) => (JSON.stringify(prev) === JSON.stringify(resolved) ? prev : resolved))
      setCloudReady(true)

      const pending = pendingCloudPersistRef.current
      if (pending != null) {
        pendingCloudPersistRef.current = null
        persistUserData(user.id, key, pending)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user?.id, isConfigured, key, initial, setLocalVal])

  const setValue = useCallback(
    (nextValueOrFn) => {
      const next =
        typeof nextValueOrFn === 'function'
          ? nextValueOrFn(valueRef.current)
          : nextValueOrFn
      const normalizedRaw = normalizeStorageValue(next, initial)
      const normalized =
        key === 'suplementos' && Array.isArray(normalizedRaw)
          ? normalizarSuplementosPorDia(normalizedRaw)
          : normalizedRaw
      setLocalVal(normalized)
      localValRef.current = normalized
      setCloudVal(normalized)

      if (user?.id) markLegacyStorageOwner(user.id)

      if (user && isConfigured && supabase && cloudReady) {
        pendingCloudPersistRef.current = null
        persistUserData(user.id, key, normalized)
      } else if (user && isConfigured && supabase) {
        pendingCloudPersistRef.current = normalized
      }
    },
    [user?.id, isConfigured, key, initial, setLocalVal, cloudReady],
  )

  return [safeValue, setValue, cloudReady]
}
