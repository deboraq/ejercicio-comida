import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useLocalStorage, normalizeStorageValue, mergeStorageArrays } from './useLocalStorage'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  scopedStorageKey,
  markLegacyStorageOwner,
  resolveUserLocalStorage,
} from '../utils/storageKeys'
import { mergeCloudAndLocal, shouldUploadMerged } from '../utils/storageMerge'

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
    setCloudReady(false)
    setCloudVal(null)

    const load = async () => {
      const { data, error } = await supabase
        .from('user_data')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', key)
        .maybeSingle()

      if (cancelled) return

      const localNorm = resolveUserLocalStorage(key, user.id, initial, mergeStorageArrays)
      const fromCloud = normalizeStorageValue(data?.value != null ? data.value : null, initial)

      if (error) {
        console.error('Error loading user_data:', error)
      }

      let resolved = mergeCloudAndLocal(key, localNorm, fromCloud, initial)

      if (
        !error &&
        shouldUploadMerged(key, resolved, fromCloud, initial, data?.value != null)
      ) {
        await persistUserData(user.id, key, resolved)
      }

      if (cancelled) return

      setCloudVal(resolved)
      localValRef.current = resolved
      setLocalVal((prev) => (JSON.stringify(prev) === JSON.stringify(resolved) ? prev : resolved))
      setCloudReady(true)
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
      setCloudVal(normalized)

      if (user?.id) markLegacyStorageOwner(user.id)

      if (user && isConfigured && supabase && cloudReady) {
        persistUserData(user.id, key, normalized)
      }
    },
    [user?.id, isConfigured, key, initial, setLocalVal, cloudReady],
  )

  return [safeValue, setValue, cloudReady]
}
