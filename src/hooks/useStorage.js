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
import { isStorageKeyHydrated, markStorageKeyHydrated } from '../utils/storageHydration'
import { dedupeRutinasPropias } from '../utils/rutinasStorage'
import { dedupeRegistrosSync } from '../utils/storageRecordDedupe'
import { isAppOnline, scheduleCloudPersist, hasPendingCloudWrite } from '../utils/offlineDataSync'
import {
  fetchAllUserDataCloud,
  getUserDataCloudMap,
  patchUserDataCloudCache,
  queueUserDataPersist,
  userDataCloudCached,
  USER_DATA_CLOUD_REFRESH,
  didLastCloudFetchSucceed,
} from '../utils/userDataCloud'

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

function resolveMergedValue(userId, key, initial, cloudMap, localValRef, preferCloud = false) {
  const fromLs = resolveUserLocalStorage(key, userId, initial, mergeStorageArrays)
  const fromLive = normalizeStorageValue(localValRef.current, initial)
  const localNorm = preferCloud
    ? fromLs
    : mergeLocalWithLive(key, fromLs, fromLive, initial)
  const fromCloud = normalizeStorageValue(
    cloudMap[key] != null ? cloudMap[key] : null,
    initial,
  )
  const cloudRowExists = Object.prototype.hasOwnProperty.call(cloudMap, key)

  let resolved = mergeCloudAndLocal(key, localNorm, fromCloud, initial, preferCloud)

  if (!preferCloud && key === 'hidratacionDia' && !isStorageInitial(fromLive, initial)) {
    resolved = mergeHidratacionPorDia(resolved, fromLive)
  } else if (
    !preferCloud
    && initial !== null
    && typeof initial === 'object'
    && !Array.isArray(initial)
    && !isStorageInitial(fromLive, initial)
    && key !== 'hidratacionDia'
  ) {
    const base = resolved && typeof resolved === 'object' && !Array.isArray(resolved) ? resolved : initial
    const live = fromLive && typeof fromLive === 'object' && !Array.isArray(fromLive) ? fromLive : initial
    resolved = { ...base, ...live }
  }

  resolved = postProcessStorageKey(key, resolved, initial)

  return { resolved, fromCloud, cloudRowExists }
}

function postProcessStorageKey(key, resolved, initial) {
  if (key === 'rutinas' && Array.isArray(initial) && Array.isArray(resolved)) {
    return dedupeRutinasPropias(resolved)
  }
  if (
    (key === 'ejercicios' || key === 'comida' || key === 'rutinaPesos')
    && Array.isArray(initial)
    && Array.isArray(resolved)
  ) {
    return dedupeRegistrosSync(key, resolved)
  }
  return resolved
}

function persistUserData(userId, key, value) {
  if (!supabase || !userId) return Promise.resolve({ error: null })
  scheduleCloudPersist(userId, key, value)
  return Promise.resolve({ error: null })
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
    const alreadyHydrated = isStorageKeyHydrated(user.id, key)
    if (!cacheHit && !alreadyHydrated) {
      setCloudReady(false)
      setCloudVal(null)
    }

    const applyResolved = (resolved) => {
      setCloudVal(resolved)
      localValRef.current = resolved
      setLocalVal((prev) => {
        if (prev === resolved) return prev
        return resolved
      })
      setCloudReady(true)
      markStorageKeyHydrated(user.id, key)
    }

    const load = async ({ preferCloud = false, skipUpload = false } = {}) => {
      let cloudMap = Object.create(null)
      if (isAppOnline()) {
        cloudMap = await fetchAllUserDataCloud(user.id)
      } else {
        cloudMap = getUserDataCloudMap(user.id) || Object.create(null)
      }
      if (cancelled) return

      const pendingLocal = hasPendingCloudWrite(user.id, key)
      const cloudHasRow = Object.prototype.hasOwnProperty.call(cloudMap, key)
      const fromCloudPreview = normalizeStorageValue(
        cloudMap[key] != null ? cloudMap[key] : null,
        initial,
      )
      const pullRemote =
        !alreadyHydrated
        && didLastCloudFetchSucceed(user.id)
        && cloudHasRow
        && !isStorageInitial(fromCloudPreview, initial)
      const usePreferCloud = (preferCloud && !pendingLocal) || pullRemote

      const { resolved, fromCloud, cloudRowExists } = resolveMergedValue(
        user.id,
        key,
        initial,
        cloudMap,
        localValRef,
        usePreferCloud,
      )

      if (
        !skipUpload
        && !alreadyHydrated
        && !usePreferCloud
        && didLastCloudFetchSucceed(user.id)
        && shouldUploadMerged(key, resolved, fromCloud, initial, cloudRowExists)
      ) {
        queueUserDataPersist(user.id, key, resolved)
      }

      if (cancelled) return

      applyResolved(resolved)

      const pending = pendingCloudPersistRef.current
      if (pending != null) {
        pendingCloudPersistRef.current = null
        persistUserData(user.id, key, pending)
      }
    }

    load()

    const onCloudRefresh = (event) => {
      if (event?.detail?.userId !== user.id) return
      load({ preferCloud: true, skipUpload: true }).catch(() => {})
    }
    window.addEventListener(USER_DATA_CLOUD_REFRESH, onCloudRefresh)

    return () => {
      cancelled = true
      window.removeEventListener(USER_DATA_CLOUD_REFRESH, onCloudRefresh)
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
      const normalizedFinal = postProcessStorageKey(key, normalized, initial)
      setLocalVal(normalizedFinal)
      localValRef.current = normalizedFinal
      setCloudVal(normalizedFinal)
      markStorageKeyHydrated(user?.id, key)

      if (user?.id) {
        markLegacyStorageOwner(user.id)
        patchUserDataCloudCache(user.id, key, normalizedFinal)
      }

      if (user && isConfigured && supabase && cloudReady) {
        pendingCloudPersistRef.current = null
        persistUserData(user.id, key, normalizedFinal)
      } else if (user && isConfigured && supabase) {
        pendingCloudPersistRef.current = normalizedFinal
      }
    },
    [user?.id, isConfigured, key, initial, setLocalVal, cloudReady],
  )

  return [safeValue, setValue, cloudReady]
}
