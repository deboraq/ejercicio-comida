import { createContext, useContext, useMemo } from 'react'

const AppMobileNavContext = createContext(null)

export function AppMobileNavProvider({ open, setOpen, children }) {
  const value = useMemo(
    () => ({
      open,
      toggle: () => setOpen((prev) => !prev),
      close: () => setOpen(false),
    }),
    [open, setOpen],
  )

  return (
    <AppMobileNavContext.Provider value={value}>
      {children}
    </AppMobileNavContext.Provider>
  )
}

export function useAppMobileNav() {
  return useContext(AppMobileNavContext)
}
