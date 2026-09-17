import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  useLocalStorage,
  normalizeStorageValue,
  mergeStorageArrays,
} from './useLocalStorage'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  scopedStorageKey,
  markLegacyStorageOwner,
  resolveUserLocalStorage,
} from '../utils/storageKeys'

function persistUserData(userId, key, value) {
  if (!supabase || !userId) return Promise.resolve({ error: null })
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

function mergeArraysForStorage(localArr, cloudArr) {
  return mergeStorageArrays(localArr, cloudArr)
}

function cloudIsInitialObject(fromCloud, initial) {
  return JSON.stringify(fromCloud) === JSON.stringify(initial)
}

/**
 * Almacenamiento por clave: si hay usuario y Supabase está configurado, usa la nube (user_data)
 * y localStorage aislado por user_id; si no, usa solo localStorage global (modo offline).
 */
export function useStorage(key, initialValue) {
  const initialRef = useRef(initialValue)
  const { user, isConfigured } = useAuth()
  const localKey = scopedStorageKey(key, user?.id)
  const [localVal, setLocalVal] = useLocalStorage(localKey, initialRef.current)
  const [cloudVal, setCloudVal] = useState(null)
  const [cloudLoaded, setCloudLoaded] = useState(false)
  const valueRef = useRef(localVal)
  const localValRef = useRef(localVal)
  const initial = initialRef.current

  useEffect(() => {
    localValRef.current = localVal
  }, [localVal])

  const value = useMemo(() => {
    if (!user || !cloudLoaded) return localVal

    if (Array.isArray(initial)) {
      const localArr = Array.isArray(localVal) ? localVal : []
      const cloudArr = Array.isArray(cloudVal) ? cloudVal : []
      return mergeArraysForStorage(localArr, cloudArr)
    }

    if (initial !== null && typeof initial === 'object') {
      const localObj =
        localVal !== null && typeof localVal === 'object' && !Array.isArray(localVal) ? localVal : initial
      const cloudObj =
        cloudVal !== null && typeof cloudVal === 'object' && !Array.isArray(cloudVal) ? cloudVal : initial
      return { ...cloudObj, ...localObj }
    }

    return cloudVal ?? localVal
  }, [user, cloudLoaded, localVal, cloudVal, initial])

  const safeValue = normalizeStorageValue(value, initial)
  valueRef.current = safeValue

  useEffect(() => {
    if (!user?.id) return
    const merged = resolveUserLocalStorage(key, user.id, initial, mergeStorageArrays)
    localValRef.current = merged
    setLocalVal((prev) => (JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged))
  }, [user?.id, key, initial, setLocalVal])

  useEffect(() => {
    if (!user || !isConfigured || !supabase) {
      setCloudLoaded(false)
      setCloudVal(null)
      return
    }
    let cancelled = false
    setCloudLoaded(false)
    setCloudVal(null)

    const load = async () => {
      const localNorm = resolveUserLocalStorage(key, user.id, initial, mergeStorageArrays)
      if (cancelled) return
      localValRef.current = localNorm
      setLocalVal((prev) => (JSON.stringify(prev) === JSON.stringify(localNorm) ? prev : localNorm))

      const { data, error } = await supabase
        .from('user_data')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', key)
        .maybeSingle()
      if (cancelled) return

      let resolved = localNorm

      if (error) {
        console.error('Error loading user_data:', error)
      } else {
        const fromCloud = normalizeStorageValue(data?.value != null ? data.value : null, initial)
        if (Array.isArray(initial)) {
          const localArr = Array.isArray(localNorm) ? localNorm : []
          const cloudArr = Array.isArray(fromCloud) ? fromCloud : []
          resolved = mergeArraysForStorage(localArr, cloudArr)
          if (JSON.stringify(resolved) !== JSON.stringify(cloudArr)) {
            await persistUserData(user.id, key, resolved)
          }
        } else if (initial !== null && typeof initial === 'object') {
          const cloudObj =
            fromCloud !== null && typeof fromCloud === 'object' && !Array.isArray(fromCloud) ? fromCloud : initial
          const localObj =
            localNorm !== null && typeof localNorm === 'object' && !Array.isArray(localNorm) ? localNorm : initial
          const localIsInitial = JSON.stringify(localObj) === JSON.stringify(initial)
          const cloudHasData = data?.value != null && !cloudIsInitialObject(fromCloud, initial)
          resolved = localIsInitial
            ? cloudHasData
              ? cloudObj
              : localObj
            : { ...cloudObj, ...localObj }
          if (JSON.stringify(resolved) !== JSON.stringify(fromCloud)) {
            await persistUserData(user.id, key, resolved)
          }
        } else {
          resolved = fromCloud ?? localNorm
        }
      }

      if (cancelled) return
      setCloudVal(resolved)
      setCloudLoaded(true)
      localValRef.current = resolved
      setLocalVal((prev) => (JSON.stringify(prev) === JSON.stringify(resolved) ? prev : resolved))
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
      const normalized = normalizeStorageValue(next, initial)
      setLocalVal(normalized)
      localValRef.current = normalized
      if (user?.id) markLegacyStorageOwner(user.id)
      if (user && isConfigured && supabase) {
        setCloudVal(normalized)
        persistUserData(user.id, key, normalized)
      }
    },
    [user?.id, isConfigured, key, initial, setLocalVal],
  )

  return [safeValue, setValue]
}
