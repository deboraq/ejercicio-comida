import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react'
import { useAuth } from './AuthContext'

function idNotificacionCampana() {
  return `av_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

const AppNotificationsContext = createContext(null)

export function AppNotificationsProvider({ children }) {
  const { user } = useAuth()
  const [notificaciones, setNotificaciones] = useState([])
  const [avisosAdmin, setAvisosAdminState] = useState([])
  const [adminAvisosLeidosIds, setAdminAvisosLeidosIds] = useState(() => new Set())

  useEffect(() => {
    if (!user) {
      setNotificaciones([])
      setAvisosAdminState([])
      setAdminAvisosLeidosIds(new Set())
    }
  }, [user?.id])

  const setAvisosAdmin = useCallback((arr) => {
    setAvisosAdminState(Array.isArray(arr) ? arr : [])
  }, [])

  const addNotificacionCampana = useCallback((kind, text) => {
    const t = String(text || '').trim()
    if (!t) return
    setNotificaciones((prev) =>
      [{ id: idNotificacionCampana(), kind, text: t, read: false, ts: Date.now() }, ...prev].slice(0, 80)
    )
  }, [])

  const onToast = useCallback(
    ({ msg: m, err: e }) => {
      if (m) addNotificacionCampana('success', m)
      if (e) addNotificacionCampana('danger', e)
    },
    [addNotificacionCampana]
  )

  const alAbrirPanelCampana = useCallback(() => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, read: true })))
    setAdminAvisosLeidosIds((prev) => {
      const next = new Set(prev)
      avisosAdmin.forEach((a) => next.add(a.id))
      return next
    })
  }, [avisosAdmin])

  const unreadToastCampana = useMemo(
    () => notificaciones.filter((n) => !n.read).length,
    [notificaciones]
  )
  const unreadAdminCampana = useMemo(
    () => avisosAdmin.filter((a) => !adminAvisosLeidosIds.has(a.id)).length,
    [avisosAdmin, adminAvisosLeidosIds]
  )
  const badgeCampana = unreadToastCampana + unreadAdminCampana

  const value = useMemo(
    () => ({
      onToast,
      setAvisosAdmin,
      notificaciones,
      avisosAdmin,
      badgeCampana,
      alAbrirPanelCampana,
    }),
    [onToast, setAvisosAdmin, notificaciones, avisosAdmin, badgeCampana, alAbrirPanelCampana]
  )

  return <AppNotificationsContext.Provider value={value}>{children}</AppNotificationsContext.Provider>
}

export function useAppNotifications() {
  const ctx = useContext(AppNotificationsContext)
  if (!ctx) throw new Error('useAppNotifications debe usarse dentro de AppNotificationsProvider')
  return ctx
}

/** Campana fija: avisos del admin (si hay) + actividad / toasts. */
export function AppNotificacionesCampana() {
  const { avisosAdmin, notificaciones, badgeCampana, alAbrirPanelCampana } = useAppNotifications()
  const [abierta, setAbierta] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierta) return
    const cerrar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierta(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierta])

  const toggle = () => {
    setAbierta((prev) => {
      if (!prev) alAbrirPanelCampana()
      return !prev
    })
  }

  const vacia = (!avisosAdmin || avisosAdmin.length === 0) && (!notificaciones || notificaciones.length === 0)

  return (
    <div className="is-relative" ref={ref} style={{ flexShrink: 0 }}>
      <button
        type="button"
        className="button is-small is-light"
        onClick={toggle}
        aria-expanded={abierta}
        aria-label="Avisos"
        style={{ position: 'relative', minWidth: '2.5rem' }}
      >
        <span aria-hidden="true">🔔</span>
        {badgeCampana > 0 ? (
          <span
            className="tag is-danger is-rounded"
            style={{
              position: 'absolute',
              top: '-0.35rem',
              right: '-0.35rem',
              fontSize: '0.65rem',
              minWidth: '1.1rem',
              height: '1.1rem',
              padding: '0 0.25rem',
              lineHeight: '1.1rem',
            }}
          >
            {badgeCampana > 9 ? '9+' : badgeCampana}
          </span>
        ) : null}
      </button>
      {abierta ? (
        <div
          className="box py-3 px-3"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            width: 'min(100vw - 2rem, 360px)',
            maxHeight: '70vh',
            overflowY: 'auto',
            zIndex: 40,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            background: 'rgba(22,22,26,0.98)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >
          <p className="is-size-7 has-text-weight-semibold mb-2">Avisos</p>
          {vacia ? (
            <p className="is-size-7 has-text-grey mb-0">No hay avisos todavía.</p>
          ) : (
            <>
              {avisosAdmin && avisosAdmin.length > 0 ? (
                <div className="mb-3">
                  <p className="is-size-7 has-text-grey mb-2">Del administrador</p>
                  <ul className="mb-0 pl-4" style={{ listStyle: 'disc' }}>
                    {avisosAdmin.map((a) => (
                      <li key={a.id} className="mb-2">
                        <p className="is-size-7 mb-1" style={{ whiteSpace: 'pre-wrap' }}>
                          {a.body}
                        </p>
                        <span className="is-size-7 has-text-grey">
                          {(a.created_at || '').slice(0, 16).replace('T', ' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {notificaciones && notificaciones.length > 0 ? (
                <div>
                  {avisosAdmin && avisosAdmin.length > 0 ? (
                    <p
                      className="is-size-7 has-text-grey mb-2 mt-3"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}
                    >
                      Actividad
                    </p>
                  ) : (
                    <p className="is-size-7 has-text-grey mb-2">Actividad</p>
                  )}
                  <ul className="mb-0" style={{ listStyle: 'none', padding: 0 }}>
                    {notificaciones.map((n) => (
                      <li
                        key={n.id}
                        className="py-2 is-size-7"
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          opacity: n.read ? 0.75 : 1,
                        }}
                      >
                        <span
                          className={`${n.kind === 'danger' ? 'has-text-danger' : n.kind === 'success' ? 'has-text-success' : 'has-text-info'}`}
                          style={{ fontWeight: n.read ? 400 : 600 }}
                        >
                          {n.kind === 'danger' ? 'Error · ' : n.kind === 'success' ? 'Listo · ' : ''}
                        </span>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{n.text}</span>
                        <span className="is-block has-text-grey mt-1" style={{ fontSize: '0.65rem' }}>
                          {new Date(n.ts).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
