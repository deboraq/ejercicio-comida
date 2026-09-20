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
import { normalizarHidratacionPorDia, mergeHidratacionPorDia } from '../utils/hidratacionStorage'

function mergeLocalWithLive(key, fromLs, fromLive, initial) {
  if (Array.isArray(initial)) {
    if (isStorageInitial(fromLive, initial)) return fromLs
    if (key === 'suplementos') {
      return normalizarSuplementosPorDia(
        mergeStorageArrays(
          normalizarSuplementosPorDia(fromLs),
          normalizarSuplementosPorDia(fromLive),
        ),
      )
    }
    return mergeStorageArrays(fromLs, fromLive)
  }

  if (initial !== null && typeof initial === 'object') {
    if (isStorageInitial(fromLive, initial)) return fromLs
    if (key === 'hidratacionDia') {
      return mergeHidratacionPorDia(fromLs, fromLive)
    }
    const base = fromLs && typeof fromLs === 'object' && !Array.isArray(fromLs) ? fromLs : initial
    const live = fromLive && typeof fromLive === 'object' && !Array.isArray(fromLive) ? fromLive : initial
    return { ...base, ...live }
  }

  return fromLs
}

function normalizeStoredValue(key, normalizedRaw, initial) {
  if (key === 'suplementos' && Array.isArray(normalizedRaw)) {
    return normalizarSuplementosPorDia(normalizedRaw)
  }
  if (key === 'hidratacionDia' && normalizedRaw && typeof normalizedRaw === 'object') {
    return normalizarHidratacionPorDia(normalizedRaw)
  }
  return normalizedRaw
}
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
      const localNorm = mergeLocalWithLive(key, fromLs, fromLive, initial)

      const fromCloud = normalizeStorageValue(
        cloudMap[key] != null ? cloudMap[key] : null,
        initial,
      )
      const cloudRowExists = Object.prototype.hasOwnProperty.call(cloudMap, key)

      let resolved = mergeCloudAndLocal(key, localNorm, fromCloud, initial)

      if (key === 'hidratacionDia' && !isStorageInitial(fromLive, initial)) {
        resolved = mergeHidratacionPorDia(resolved, fromLive)
      } else if (
        initial !== null
        && typeof initial === 'object'
        && !Array.isArray(initial)
        && !isStorageInitial(fromLive, initial)
        && key !== 'hidratacionDia'
      ) {
        const base = resolved && typeof resolved === 'object' && !Array.isArray(resolved) ? resolved : initial
        const live = fromLive && typeof fromLive === 'object' && !Array.isArray(fromLive) ? fromLive : initial
        resolved = { ...base, ...live }
      }

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
      const normalized = normalizeStoredValue(key, normalizedRaw, initial)
      setLocalVal(normalized)
      localValRef.current = normalized
      setCloudVal(normalized)

      if (user?.id) {
        markLegacyStorageOwner(user.id)
        patchUserDataCloudCache(user.id, key, normalized)
      }

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
