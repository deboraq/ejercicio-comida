import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  useLocalStorage,
  normalizeStorageValue,
  mergeStorageArrays,
  isPrimitiveStorageArray,
} from './useLocalStorage'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  scopedStorageKey,
  markLegacyStorageOwner,
  migrateLegacyStorageToScoped,
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

function hasLocalStorageKey(storageKey) {
  try {
    return window.localStorage.getItem(storageKey) != null
  } catch {
    return false
  }
}

/**
 * Almacenamiento por clave: si hay usuario y Supabase está configurado, usa la nube (user_data)
 * y localStorage aislado por user_id; si no, usa solo localStorage global (modo offline).
 */
export function useStorage(key, initialValue) {
  const { user, isConfigured } = useAuth()
  const localKey = scopedStorageKey(key, user?.id)
  const [localVal, setLocalVal] = useLocalStorage(localKey, initialValue)
  const [cloudVal, setCloudVal] = useState(null)
  const [cloudLoaded, setCloudLoaded] = useState(false)
  const valueRef = useRef(localVal)
  const localValRef = useRef(localVal)

  useEffect(() => {
    if (user?.id) migrateLegacyStorageToScoped(key, user.id)
  }, [user?.id, key])

  useEffect(() => {
    localValRef.current = localVal
  }, [localVal])

  const value = useMemo(() => {
    if (!user || !cloudLoaded) return localVal

    if (Array.isArray(initialValue)) {
      const localArr = Array.isArray(localVal) ? localVal : []
      const cloudArr = Array.isArray(cloudVal) ? cloudVal : []
      if (isPrimitiveStorageArray(localArr) && isPrimitiveStorageArray(cloudArr)) {
        if (hasLocalStorageKey(localKey) && localArr.length > 0) return localArr
        return cloudArr.length ? cloudArr : localArr
      }
      return mergeStorageArrays(localArr, cloudArr)
    }

    if (initialValue !== null && typeof initialValue === 'object') {
      const localObj =
        localVal !== null && typeof localVal === 'object' && !Array.isArray(localVal) ? localVal : initialValue
      const cloudObj =
        cloudVal !== null && typeof cloudVal === 'object' && !Array.isArray(cloudVal) ? cloudVal : initialValue
      return { ...cloudObj, ...localObj }
    }

    return cloudVal ?? localVal
  }, [user, cloudLoaded, localVal, cloudVal, initialValue, localKey])

  const safeValue = normalizeStorageValue(value, initialValue)
  valueRef.current = safeValue

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
      const { data, error } = await supabase
        .from('user_data')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', key)
        .maybeSingle()
      if (cancelled) return

      const localNorm = normalizeStorageValue(localValRef.current, initialValue)
      let resolved = localNorm

      if (error) {
        console.error('Error loading user_data:', error)
      } else {
        const fromCloud = normalizeStorageValue(data?.value != null ? data.value : null, initialValue)
        if (Array.isArray(initialValue)) {
          const localArr = Array.isArray(localNorm) ? localNorm : []
          const cloudArr = Array.isArray(fromCloud) ? fromCloud : []
          if (isPrimitiveStorageArray(localArr) && isPrimitiveStorageArray(cloudArr)) {
            resolved = hasLocalStorageKey(localKey)
              ? localArr
              : cloudArr.length
                ? cloudArr
                : localArr
          } else {
            resolved = mergeStorageArrays(localArr, cloudArr)
          }
          const mergedDiffersFromCloud = JSON.stringify(resolved) !== JSON.stringify(cloudArr)
          if (mergedDiffersFromCloud) {
            await persistUserData(user.id, key, resolved)
          }
        } else if (initialValue !== null && typeof initialValue === 'object') {
          const hasLocal = hasLocalStorageKey(localKey)
          const cloudMissing = data?.value == null
          const cloudIsInitial = JSON.stringify(fromCloud) === JSON.stringify(initialValue)
          const localIsInitial = JSON.stringify(localNorm) === JSON.stringify(initialValue)

          if (cloudMissing || cloudIsInitial) {
            if (hasLocal && !localIsInitial) {
              resolved = localNorm
              await persistUserData(user.id, key, resolved)
            } else {
              resolved = cloudMissing ? localNorm : fromCloud
            }
          } else {
            resolved = hasLocal && !localIsInitial ? { ...fromCloud, ...localNorm } : fromCloud
            if (JSON.stringify(resolved) !== JSON.stringify(fromCloud)) {
              await persistUserData(user.id, key, resolved)
            }
          }
        } else {
          resolved = fromCloud
        }
      }

      if (cancelled) return
      setCloudVal(resolved)
      setCloudLoaded(true)
      if (JSON.stringify(resolved) !== JSON.stringify(localValRef.current)) {
        setLocalVal(resolved)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user?.id, isConfigured, key, localKey, initialValue, setLocalVal])

  const setValue = useCallback(
    (nextValueOrFn) => {
      const next =
        typeof nextValueOrFn === 'function'
          ? nextValueOrFn(valueRef.current)
          : nextValueOrFn
      const normalized = normalizeStorageValue(next, initialValue)
      setLocalVal(normalized)
      if (user?.id) markLegacyStorageOwner(user.id)
      if (user && isConfigured && supabase) {
        setCloudVal(normalized)
        persistUserData(user.id, key, normalized)
      }
    },
    [user?.id, isConfigured, key, initialValue, setLocalVal],
  )

  return [safeValue, setValue]
}
