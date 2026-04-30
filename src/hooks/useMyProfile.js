import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchMyProfile } from '../lib/profeDb'

/** Perfil `profiles` del usuario logueado (rol, etc.). */
export function useMyProfile() {
  const { user, isConfigured } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!user?.id || !isConfigured) {
      setProfile(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchMyProfile(user.id).then(({ data, error }) => {
      if (cancelled) return
      setProfile(error ? null : data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id, isConfigured, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && user?.id && isConfigured) refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [user?.id, isConfigured, refresh])

  return { profile, loading, refresh }
}
