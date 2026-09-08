import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocalStorage, normalizeStorageValue } from './useLocalStorage'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

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

/**
 * Almacenamiento por clave: si hay usuario y Supabase está configurado, usa la nube (user_data);
 * si no, usa solo localStorage. Misma API que useLocalStorage.
 */
export function useStorage(key, initialValue) {
  const [localVal, setLocalVal] = useLocalStorage(key, initialValue)
  const { user, isConfigured } = useAuth()
  const [cloudVal, setCloudVal] = useState(null)
  const [cloudLoaded, setCloudLoaded] = useState(false)
  const valueRef = useRef(localVal)
  const localValRef = useRef(localVal)

  useEffect(() => {
    localValRef.current = localVal
  }, [localVal])

  const value = user && cloudLoaded ? cloudVal : localVal
  const safeValue = normalizeStorageValue(value, initialValue)
  valueRef.current = safeValue

  useEffect(() => {
    if (!user || !isConfigured || !supabase) {
      setCloudLoaded(false)
      setCloudVal(null)
      return
    }
    let cancelled = false
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
          if (cloudArr.length >= localArr.length) {
            resolved = cloudArr
          } else if (localArr.length > 0) {
            resolved = localArr
            await persistUserData(user.id, key, localArr)
          } else {
            resolved = cloudArr
          }
        } else {
          resolved = fromCloud
        }
      }

      if (cancelled) return
      setCloudVal(resolved)
      setCloudLoaded(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user?.id, isConfigured, key])

  const setValue = useCallback(
    (nextValueOrFn) => {
      const next =
        typeof nextValueOrFn === 'function'
          ? nextValueOrFn(valueRef.current)
          : nextValueOrFn
      const normalized = normalizeStorageValue(next, initialValue)
      setLocalVal(normalized)
      if (user && isConfigured && supabase) {
        if (cloudLoaded) setCloudVal(normalized)
        persistUserData(user.id, key, normalized)
      }
    },
    [user?.id, isConfigured, cloudLoaded, key, initialValue],
  )

  return [safeValue, setValue]
}
