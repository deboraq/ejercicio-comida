import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { fetchMyProfile } from '../lib/profeDb'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const { user, isConfigured } = useAuth()
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const lastFetchRef = useRef(0)
  const profileUserRef = useRef(null)

  useEffect(() => {
    if (!user?.id || !isConfigured) {
      setProfile(null)
      setProfileError(null)
      setLoading(false)
      profileUserRef.current = null
      return
    }

    if (profileUserRef.current !== user.id) {
      profileUserRef.current = user.id
      setProfile(null)
      setLoading(true)
    }

    let cancelled = false
    setProfileError(null)

    fetchMyProfile(user.id)
      .then(({ data, error }) => {
        if (cancelled) return
        lastFetchRef.current = Date.now()
        const errMsg = error?.message
          ?? (!data
            ? 'No se encontró tu perfil en la nube. Ejecutá en Supabase el bloque «get_my_profile» del SUPABASE.md y recargá la página.'
            : null)
        setProfile(data ?? null)
        setProfileError(errMsg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, isConfigured, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    const onProfileSync = () => refresh()
    window.addEventListener('fitnesspro-profile-refresh', onProfileSync)
    return () => window.removeEventListener('fitnesspro-profile-refresh', onProfileSync)
  }, [refresh])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !user?.id || !isConfigured) return
      const idleMs = 5 * 60 * 1000
      if (Date.now() - lastFetchRef.current < idleMs) return
      refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [user?.id, isConfigured, refresh])

  const value = useMemo(
    () => ({ profile, profileError, loading, refresh }),
    [profile, profileError, loading, refresh],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

/** Perfil `profiles` del usuario logueado (una sola carga compartida en toda la app). */
export function useMyProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useMyProfile debe usarse dentro de ProfileProvider')
  return ctx
}
