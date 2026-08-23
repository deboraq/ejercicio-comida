import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { ensureMyProfile } from '../lib/profeDb'

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

  useEffect(() => {
    if (!isSupabaseConfigured() || !user?.id) return
    ensureMyProfile(user).catch(() => {})
  }, [user?.id])

  const signUp = async (email, password, metadata = {}) => {
    setAuthError(null)
    if (!supabase) {
      setAuthError('Cuentas no configuradas. Usa la app en modo local.')
      return { error: { message: 'Supabase no configurado' } }
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      })
      if (error) {
        const msg = (error.message || '').toLowerCase()
        const yaRegistrado = msg.includes('already been registered') || msg.includes('already registered') || error.code === 'user_already_registered'
        setAuthError(yaRegistrado ? 'Ya existe una cuenta con ese correo. Iniciá sesión en su lugar.' : mensajeAuth(error))
      }
      return { data, error }
    } catch (err) {
      const msg = mensajeAuth(err)
      setAuthError(msg)
      return { error: { message: msg } }
    }
  }

  function esErrorRed(err) {
    const m = (err?.message || String(err || '')).toLowerCase()
    return (
      m.includes('load failed') ||
      m.includes('failed to fetch') ||
      m.includes('networkerror') ||
      m.includes('network request failed') ||
      m.includes('could not resolve') ||
      m.includes('fetch failed')
    )
  }

  function mensajeAuth(error) {
    if (!error?.message) return 'No se pudo iniciar sesión. Probá de nuevo.'
    if (esErrorRed(error)) {
      return 'No se pudo conectar con el servidor de cuentas. Revisá que el proyecto de Supabase esté activo y que VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env (o en Vercel) sean los actuales. Reiniciá npm run dev después de cambiarlas.'
    }
    if (error.code === 'email_not_confirmed') {
      return 'Tenés que confirmar el correo antes de entrar. Revisá la bandeja de entrada y spam.'
    }
    const m = error.message.toLowerCase()
    if (m.includes('email not confirmed') || m.includes('not confirmed')) {
      return 'Tenés que confirmar el correo antes de entrar. Revisá la bandeja de entrada y spam.'
    }
    if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('wrong password')) {
      return 'Correo o contraseña incorrectos.'
    }
    if (m.includes('too many requests') || m.includes('rate limit')) {
      return 'Demasiados intentos. Esperá un minuto y probá de nuevo.'
    }
    return error.message
  }

  const signIn = async (email, password) => {
    setAuthError(null)
    if (!supabase) {
      setAuthError('Cuentas no configuradas.')
      return { error: { message: 'Supabase no configurado' } }
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthError(mensajeAuth(error))
      return { data, error }
    } catch (err) {
      const msg = mensajeAuth(err)
      setAuthError(msg)
      return { error: { message: msg } }
    }
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
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) setAuthError(mensajeAuth(error))
      return { data, error }
    } catch (err) {
      const msg = mensajeAuth(err)
      setAuthError(msg)
      return { error: { message: msg } }
    }
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
