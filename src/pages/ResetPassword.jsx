import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { user, updatePassword, authError, setAuthError } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [listo, setListo] = useState(false)

  useEffect(() => {
    setAuthError(null)
  }, [setAuthError])

  if (!user && !window.location.hash) {
    navigate('/login', { replace: true })
    return null
  }

  if (!user && window.location.hash) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: '400px' }}>
          <div className="box has-text-centered">
            <p className="mb-2">Procesando enlace...</p>
            <p className="is-size-7 has-text-grey">Si no cambia, el enlace puede haber expirado.</p>
            <Link to="/login" className="button is-light is-small mt-3">Ir a iniciar sesión</Link>
          </div>
        </div>
      </section>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAuthError(null)
    if (!password || password !== confirmar) {
      setAuthError('Las contraseñas deben coincidir.')
      return
    }
    if (password.length < 6) {
      setAuthError('Mínimo 6 caracteres.')
      return
    }
    const { error } = await updatePassword(password)
    if (!error) setListo(true)
  }

  if (listo) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: '400px' }}>
          <div className="box has-text-centered">
            <p className="title is-5">Contraseña actualizada</p>
            <p className="mb-4">Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <button type="button" className="button is-link" onClick={() => navigate('/login', { replace: true })}>
              Ir a iniciar sesión
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: '400px' }}>
        <div className="box">
          <h1 className="title is-5 has-text-centered mb-4">Nueva contraseña</h1>
          {authError && (
            <div className="notification is-danger is-light is-size-7 mb-3">{authError}</div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label">Nueva contraseña (mín. 6)</label>
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
                <button type="submit" className="button is-link is-fullwidth">Guardar contraseña</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
