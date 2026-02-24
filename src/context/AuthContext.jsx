import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, metadata = {}) => {
    setAuthError(null)
    if (!supabase) {
      setAuthError('Cuentas no configuradas. Usa la app en modo local.')
      return { error: { message: 'Supabase no configurado' } }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })
    if (error) setAuthError(error.message)
    return { data, error }
  }

  const signIn = async (email, password) => {
    setAuthError(null)
    if (!supabase) {
      setAuthError('Cuentas no configuradas.')
      return { error: { message: 'Supabase no configurado' } }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    return { data, error }
  }

  const signOut = async () => {
    setAuthError(null)
    if (supabase) await supabase.auth.signOut()
    setUser(null)
  }

  const resetPasswordForEmail = async (email) => {
    setAuthError(null)
    if (!supabase) {
      setAuthError('Cuentas no configuradas.')
      return { error: { message: 'Supabase no configurado' } }
    }
    const redirectTo = `${window.location.origin}/reset-password`
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) setAuthError(error.message)
    return { data, error }
  }

  const updatePassword = async (newPassword) => {
    setAuthError(null)
    if (!supabase) return { error: { message: 'Supabase no configurado' } }
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setAuthError(error.message)
    return { data, error }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        setAuthError,
        isConfigured: isSupabaseConfigured(),
        signUp,
        signIn,
        signOut,
        resetPasswordForEmail,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
