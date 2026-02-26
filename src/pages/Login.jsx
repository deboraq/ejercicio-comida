import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const TAB = { login: 'login', register: 'register', recover: 'recover' }

export default function Login() {
  const navigate = useNavigate()
  const { user, authError, setAuthError, isConfigured, signIn, signUp, resetPasswordForEmail } = useAuth()
  const [tab, setTab] = useState(TAB.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [enviado, setEnviado] = useState(false)

  if (user) {
    navigate('/', { replace: true })
    return null
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError(null)
    if (!email.trim() || !password) return
    const { error } = await signIn(email.trim(), password)
    if (!error) navigate('/', { replace: true })
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setAuthError(null)
    if (!email.trim() || !password || password !== confirmar) {
      setAuthError('Completa todos los campos y que las contraseñas coincidan.')
      return
    }
    if (password.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    const { error } = await signUp(email.trim(), password, { nombre: nombre.trim() || undefined })
    if (!error) {
      setEnviado(true)
      setAuthError(null)
    } else {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('already') && msg.includes('registered')) setTab(TAB.login)
    }
  }

  const handleRecover = async (e) => {
    e.preventDefault()
    setAuthError(null)
    if (!email.trim()) return
    const { error } = await resetPasswordForEmail(email.trim())
    if (!error) setEnviado(true)
  }

  const clearForm = () => {
    setAuthError(null)
    setEnviado(false)
    setPassword('')
    setConfirmar('')
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: '400px' }}>
        <div className="box">
          <h1 className="title is-5 has-text-centered mb-4">
            {tab === TAB.login && 'Iniciar sesión'}
            {tab === TAB.register && 'Crear cuenta'}
            {tab === TAB.recover && 'Recuperar contraseña'}
          </h1>

          {!isConfigured && (
            <div className="notification is-warning is-light mb-4">
              <p className="is-size-7">
                Las cuentas no están configuradas. Crea un proyecto en{' '}
                <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>, añade las variables en <code>.env</code> y crea la tabla <code>user_data</code> (ver README).
            </p>
              <Link to="/" className="button is-small is-fullwidth mt-2">Continuar sin cuenta</Link>
            </div>
          )}

          {isConfigured && (
            <>
              {authError && (
                <div className="notification is-danger is-light is-size-7 mb-3">
                  {authError}
                </div>
              )}

              {tab === TAB.login && (
                <form onSubmit={handleLogin}>
                  <div className="field">
                    <label className="label">Correo</label>
                    <div className="control">
                      <input
                        className="input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Contraseña</label>
                    <div className="control">
                      <input
                        className="input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <div className="control">
                      <button type="submit" className="button is-link is-fullwidth">Entrar</button>
                    </div>
                  </div>
                  <p className="is-size-7 has-text-centered">
                    <button type="button" className="is-link" onClick={() => { setTab(TAB.recover); clearForm(); }}>
                      ¿Olvidaste tu contraseña?
                    </button>
                  </p>
                  <p className="is-size-7 has-text-centered mt-2">
                    ¿No tienes cuenta?{' '}
                    <button type="button" className="is-link" onClick={() => { setTab(TAB.register); clearForm(); }}>
                      Registrarse
                    </button>
                  </p>
                </form>
              )}

              {tab === TAB.register && (
                <form onSubmit={handleRegister}>
                  <div className="field">
                    <label className="label">Nombre (opcional)</label>
                    <div className="control">
                      <input
                        className="input"
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Tu nombre"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Correo</label>
                    <div className="control">
                      <input
                        className="input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Contraseña (mín. 6 caracteres)</label>
                    <div className="control">
                      <input
                        className="input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={6}
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Repetir contraseña</label>
                    <div className="control">
                      <input
                        className="input"
                        type="password"
                        value={confirmar}
                        onChange={(e) => setConfirmar(e.target.value)}
                        minLength={6}
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <div className="control">
                      <button type="submit" className="button is-link is-fullwidth">Crear cuenta</button>
                    </div>
                  </div>
                  {enviado && (
                    <p className="notification is-success is-light is-size-7">
                      Revisa tu correo para confirmar la cuenta. Luego inicia sesión.
                    </p>
                  )}
                  <p className="is-size-7 has-text-centered mt-2">
                    ¿Ya tienes cuenta?{' '}
                    <button type="button" className="is-link" onClick={() => { setTab(TAB.login); clearForm(); }}>
                      Iniciar sesión
                    </button>
                  </p>
                </form>
              )}

              {tab === TAB.recover && (
                <form onSubmit={handleRecover}>
                  <div className="field">
                    <label className="label">Correo con el que te registraste</label>
                    <div className="control">
                      <input
                        className="input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <div className="control">
                      <button type="submit" className="button is-link is-fullwidth">Enviar enlace para restablecer</button>
                    </div>
                  </div>
                  {enviado && (
                    <p className="notification is-success is-light is-size-7">
                      Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.
                    </p>
                  )}
                  <p className="is-size-7 has-text-centered mt-2">
                    <button type="button" className="is-link" onClick={() => { setTab(TAB.login); clearForm(); }}>
                      Volver a iniciar sesión
                    </button>
                  </p>
                </form>
              )}
            </>
          )}

          {isConfigured && tab === TAB.login && (
            <>
              <hr className="my-4" />
              <Link to="/" className="button is-light is-fullwidth is-size-7">
                Continuar sin cuenta (solo en este dispositivo)
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
