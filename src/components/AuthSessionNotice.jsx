import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  isGuestModeContinued,
  isSessionLostUnexpectedly,
  markGuestModeContinued,
} from '../utils/authSessionUi'

export default function AuthSessionNotice() {
  const { user, loading, isConfigured } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [guestContinued, setGuestContinued] = useState(() => isGuestModeContinued())
  const [sessionLost, setSessionLost] = useState(() => isSessionLostUnexpectedly())

  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/reset-password'

  useEffect(() => {
    if (user?.id) {
      setGuestContinued(false)
      setSessionLost(false)
      return
    }
    setGuestContinued(isGuestModeContinued())
    setSessionLost(isSessionLostUnexpectedly())
  }, [user?.id])

  useEffect(() => {
    const onSessionLost = () => {
      setSessionLost(true)
      setGuestContinued(false)
    }
    window.addEventListener('fitnesspro-auth-session-lost', onSessionLost)
    return () => window.removeEventListener('fitnesspro-auth-session-lost', onSessionLost)
  }, [])

  if (!isConfigured || loading || user || isAuthPage) return null

  const showModal = !guestContinued || sessionLost
  const showBanner = guestContinued && !showModal

  const handleContinueGuest = () => {
    markGuestModeContinued()
    setGuestContinued(true)
    setSessionLost(false)
  }

  const handleGoLogin = () => {
    navigate('/login', { state: { from: location.pathname + location.search } })
  }

  return (
    <>
      {showModal && (
        <div className="modal is-active auth-session-modal" role="dialog" aria-modal="true" aria-labelledby="auth-session-modal-title">
          <button
            type="button"
            className="modal-background"
            aria-label="Cerrar"
            onClick={handleContinueGuest}
          />
          <div className="modal-card auth-session-modal-card">
            <header className="modal-card-head">
              <p className="modal-card-title" id="auth-session-modal-title">
                {sessionLost ? 'Tu sesión se cerró' : 'Iniciar sesión'}
              </p>
            </header>
            <section className="modal-card-body">
              {sessionLost ? (
                <>
                  <p className="mb-3">
                    No estás conectado a tu cuenta. Si cargás rutina, comida o ejercicios ahora,{' '}
                    <strong>queda solo en este dispositivo</strong> y no se verá al volver a iniciar sesión
                    hasta que sincronices.
                  </p>
                  <p className="is-size-7 has-text-grey mb-0">
                    Para seguir con tu historial en la nube, iniciá sesión antes de registrar.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-3">
                    Podés iniciar sesión para guardar y sincronizar tu progreso entre dispositivos.
                  </p>
                  <p className="is-size-7 has-text-grey mb-0">
                    Si preferís, también podés usar la app solo en este teléfono o navegador.
                  </p>
                </>
              )}
            </section>
            <footer className="modal-card-foot auth-session-modal-foot">
              <button type="button" className="button is-link" onClick={handleGoLogin}>
                Iniciar sesión
              </button>
              <button type="button" className="button is-light" onClick={handleContinueGuest}>
                Continuar sin iniciar
              </button>
            </footer>
          </div>
        </div>
      )}

      {showBanner && (
        <div
          className="app-auth-guest-banner"
          role="status"
          aria-live="polite"
        >
          <span className="app-auth-guest-banner-text">
            Modo solo en este dispositivo — no hay sesión iniciada. Lo que guardes no se sincroniza con tu cuenta.
          </span>
          <Link to="/login" className="app-auth-guest-banner-link">
            Iniciar sesión
          </Link>
        </div>
      )}
    </>
  )
}
