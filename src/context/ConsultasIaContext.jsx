import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { fetchConsultasIaEnabled } from '../lib/profeDb'

const ConsultasIaContext = createContext({
  enabled: true,
  loading: true,
  refresh: async () => {},
})

export function ConsultasIaProvider({ children }) {
  const { user, isConfigured } = useAuth()
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user || !isConfigured) {
      setEnabled(true)
      setLoading(false)
      return
    }
    setLoading(true)
    const { enabled: on, error } = await fetchConsultasIaEnabled()
    setEnabled(error ? true : on)
    setLoading(false)
  }, [user?.id, isConfigured])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo(
    () => ({
      enabled,
      loading,
      refresh: load,
    }),
    [enabled, loading, load],
  )

  return <ConsultasIaContext.Provider value={value}>{children}</ConsultasIaContext.Provider>
}

export function useConsultasIa() {
  return useContext(ConsultasIaContext)
}
