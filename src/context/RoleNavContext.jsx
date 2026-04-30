import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { fetchRoleNavHidden } from '../lib/profeDb'
import { DEFAULT_ROLE_NAV_HIDDEN, normalizeRoleNavMap } from '../utils/navModules'

const RoleNavContext = createContext({
  roleNavMap: DEFAULT_ROLE_NAV_HIDDEN,
  loading: true,
  refresh: async () => {},
})

export function RoleNavProvider({ children }) {
  const { user, isConfigured } = useAuth()
  const [roleNavMap, setRoleNavMap] = useState(() => normalizeRoleNavMap({}))
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user || !isConfigured) {
      setRoleNavMap(normalizeRoleNavMap({}))
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await fetchRoleNavHidden()
    setRoleNavMap(normalizeRoleNavMap(data || {}))
    setLoading(false)
  }, [user?.id, isConfigured])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo(
    () => ({
      roleNavMap,
      loading,
      refresh: load,
    }),
    [roleNavMap, loading, load]
  )

  return <RoleNavContext.Provider value={value}>{children}</RoleNavContext.Provider>
}

export function useRoleNav() {
  return useContext(RoleNavContext)
}
