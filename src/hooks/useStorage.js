import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

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

  const value = user && cloudLoaded ? cloudVal : localVal
  valueRef.current = value

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
      if (error) {
        console.error('Error loading user_data:', error)
        setCloudVal(localVal)
      } else {
        setCloudVal(data?.value != null ? data.value : initialValue)
      }
      setCloudLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, [user?.id, isConfigured, key])

  const setValue = useCallback(
    (nextValueOrFn) => {
      const next =
        typeof nextValueOrFn === 'function'
          ? nextValueOrFn(valueRef.current)
          : nextValueOrFn
      setLocalVal(next)
      if (user && isConfigured && supabase && cloudLoaded) {
        setCloudVal(next)
        supabase
          .from('user_data')
          .upsert(
            { user_id: user.id, key, value: next, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,key' }
          )
          .then(({ error }) => {
            if (error) console.error('Error saving user_data:', error)
          })
      }
    },
    [user?.id, isConfigured, cloudLoaded, key]
  )

  return [value, setValue]
}
