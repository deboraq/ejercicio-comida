import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../context/AuthContext'
import { useMyProfile } from '../hooks/useMyProfile'
import { updateMyFullName } from '../lib/profeDb'
import { OBJETIVOS } from '../utils/consejos'
import { SUPLEMENTOS } from '../utils/suplementos'
import PesoSeguimiento from '../components/PesoSeguimiento'
export default function Config() {
  const { user, signOut, isConfigured } = useAuth()
  const { profile, profileError, loading: profileLoading, refresh: refreshProfile } = useMyProfile()
  const [nombrePerfil, setNombrePerfil] = useState('')
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [nombrePerfilMsg, setNombrePerfilMsg] = useState(null)
  const [nombrePerfilErr, setNombrePerfilErr] = useState(null)

  useEffect(() => {
    setNombrePerfil((profile?.full_name || '').trim())
    setNombrePerfilMsg(null)
    setNombrePerfilErr(null)
  }, [profile?.full_name, user?.id])

  const guardarNombrePerfil = async () => {
    if (!user?.id || !isConfigured) return
    setGuardandoNombre(true)
    setNombrePerfilMsg(null)
    setNombrePerfilErr(null)
    const { error } = await updateMyFullName(nombrePerfil)
    setGuardandoNombre(false)
    if (error) {
      setNombrePerfilErr(error.message || 'No se pudo guardar.')
      return
    }
    setNombrePerfilMsg('Nombre guardado.')
    refreshProfile()
  }

  const nombreDistintoAlGuardado = nombrePerfil.trim() !== (profile?.full_name || '').trim()
  const [historialPeso, setHistorialPeso] = useStorage('pesoHistorial', [])
  const [config, setConfig] = useStorage('config', {
    objetivo: 'mantener_peso',
    pesoKg: 70,
    metaCalorias: '',
    metaProteina: '',
    suplementosActivos: SUPLEMENTOS.map((s) => s.id),
  })

  const setObjetivo = (v) => setConfig((c) => ({ ...c, objetivo: v }))
  const setPeso = (v) => {
    if (v === '' || v == null) {
      setConfig((c) => ({ ...c, pesoKg: '' }))
      return
    }
    const num = Number(v)
    if (!Number.isNaN(num) && num >= 0) setConfig((c) => ({ ...c, pesoKg: num }))
  }
  const setMetaCalorias = (v) => setConfig((c) => ({ ...c, metaCalorias: v === '' ? '' : String(Math.max(0, parseInt(v, 10) || 0)) }))
  const setMetaProteina = (v) => setConfig((c) => ({ ...c, metaProteina: v === '' ? '' : String(Math.max(0, parseInt(v, 10) || 0)) }))

  const toggleSuplemento = (id) => {
    setConfig((c) => {
      const act = c.suplementosActivos ?? SUPLEMENTOS.map((s) => s.id)
      const has = act.includes(id)
      return { ...c, suplementosActivos: has ? act.filter((x) => x !== id) : [...act, id] }
    })
  }

  const suplementosActivos = config.suplementosActivos ?? SUPLEMENTOS.map((s) => s.id)

  const cargandoPerfilNube = Boolean(user && isConfigured && profileLoading)
  const esProfe = profile?.role === 'profe'
  /** Objetivo, peso, suplementos y metas son del alumno; el entrenador solo gestiona su cuenta en la nube. */
  const mostrarSeccionesAlumno = !user || !isConfigured || (user && !profileLoading && !esProfe)

  const etiquetaRol = (role) => {
    if (role === 'admin') return 'Administrador'
    if (role === 'profe') return 'Entrenador'
    if (role === 'alumno') return 'Alumno'
    return role || '—'
  }

  const claseTagRol = (role) => {
    if (role === 'admin') return 'tag is-warning mb-0'
    if (role === 'profe') return 'tag is-info mb-0'
    if (role === 'alumno') return 'tag is-link is-light mb-0'
    return 'tag is-light mb-0'
  }

  return (
    <section className="section py-4">
      <div className="container" style={{ maxWidth: '560px' }}>
        <header className="app-page-hero mb-4">
          <div className="app-page-hero-icon" aria-hidden="true">⚙️</div>
          <h1 className="title is-5 mb-2">{esProfe && !profileLoading ? 'Tu cuenta' : 'Configuración'}</h1>
          {!esProfe && (
            <p className="is-size-7 has-text-grey mb-0">
              Tu objetivo y peso se usan para calorías quemadas y consejos personalizados
            </p>
          )}
          {esProfe && !profileLoading && (
            <p className="is-size-7 has-text-grey mb-0">
              Acá solo ajustás cómo te muestra la app y tu sesión. Metas, peso y suplementos son de cada alumno en su
              propia cuenta.
            </p>
          )}
        </header>

        {cargandoPerfilNube && (
          <p className="is-size-7 has-text-grey mb-4">Cargando tu perfil…</p>
        )}

        {user && (
          <div
            className="mb-4 px-3 py-3"
            style={{
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <p className="is-size-7 has-text-grey mb-2">Sesión iniciada</p>
            <div className="is-flex is-flex-wrap-wrap is-align-items-center" style={{ gap: '0.5rem' }}>
              <span className="is-size-7" style={{ wordBreak: 'break-all' }}>
                {(profile?.full_name || '').trim() ? (
                  <>
                    <strong>{(profile.full_name || '').trim()}</strong>
                    <span className="has-text-grey"> · {user.email}</span>
                  </>
                ) : (
                  user.email
                )}
              </span>
              {isConfigured && (
                <>
                  {profileLoading ? (
                    <span className="tag is-light">Cargando rol…</span>
                  ) : (
                    <span className={claseTagRol(profile?.role)}>{etiquetaRol(profile?.role)}</span>
                  )}
                </>
              )}
            </div>
            <div className="is-flex is-flex-wrap-wrap is-align-items-center mt-2" style={{ gap: '0.5rem' }}>
              <button type="button" className="button is-small is-light" onClick={() => signOut()}>
                Cerrar sesión
              </button>
            </div>
            {isConfigured && profileError && (
              <p className="is-size-7 has-text-warning mt-2 mb-0">{profileError}</p>
            )}
            {isConfigured && user && !profileLoading && (
              <div className="field mt-3 mb-0">
                <label className="label is-size-7">Nombre y apellido</label>
                <p className="is-size-7 has-text-grey mb-2">
                  {esProfe
                    ? 'Así te verán tus alumnos al vincularte (junto a tu correo).'
                    : 'Así te verá tu entrenador en Profe (junto a tu correo).'}
                </p>
                <div className="control mb-2">
                  <input
                    className="input is-small"
                    type="text"
                    value={nombrePerfil}
                    onChange={(e) => {
                      setNombrePerfil(e.target.value)
                      setNombrePerfilMsg(null)
                      setNombrePerfilErr(null)
                    }}
                    placeholder="Ej. Juan Pérez"
                    autoComplete="name"
                  />
                </div>
                <button
                  type="button"
                  className="button is-link is-small"
                  disabled={guardandoNombre || !nombreDistintoAlGuardado}
                  onClick={guardarNombrePerfil}
                >
                  {guardandoNombre ? 'Guardando…' : 'Guardar nombre'}
                </button>
                {nombrePerfilMsg && (
                  <p className="is-size-7 has-text-success mt-2 mb-0">{nombrePerfilMsg}</p>
                )}
                {nombrePerfilErr && (
                  <p className="is-size-7 has-text-danger mt-2 mb-0">{nombrePerfilErr}</p>
                )}
              </div>
            )}
          </div>
        )}

        {!cargandoPerfilNube && mostrarSeccionesAlumno && (
        <div className="box mb-4 py-3">
          <h2 className="title is-6 mb-2">Cuenta</h2>
          <p className="is-size-7 has-text-grey mb-2">
            Con una cuenta tu progreso se guarda en la nube y podrás recuperarlo en otro dispositivo.
          </p>
          {!user && isConfigured && (
            <Link to="/login" className="button is-link is-small">Iniciar sesión o crear cuenta</Link>
          )}
          {!user && !isConfigured && (
            <p className="is-size-7 has-text-grey mb-0">
              Configura Supabase (ver README) para usar cuentas.
            </p>
          )}
          <div className="notification is-light py-3 px-3 mt-3 mb-0" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <p className="is-size-7 mb-2">
              <strong>¿Sos entrenador?</strong> Un administrador de la plataforma te marca el rol en <strong>Admin</strong>. Después entrá a <Link to="/profe">Profe</Link> para ver avisos del admin, vincular alumnos y enviar rutinas.
            </p>
            {!isConfigured && (
              <p className="is-size-7 mb-0">
                En esta instalación no están cargadas las claves de Supabase (por ejemplo en Vercel: Settings → Environment Variables:
                <code className="mx-1">VITE_SUPABASE_URL</code> y <code className="mx-1">VITE_SUPABASE_ANON_KEY</code>
                ). Después de guardarlas, hacé un redeploy. Sin eso la app no muestra Profe en el menú.
              </p>
            )}
          </div>
        </div>
        )}

        {!cargandoPerfilNube && mostrarSeccionesAlumno && (
        <>
        <div className="box mb-4 py-3">
          <h2 className="title is-6 mb-2">Tu objetivo</h2>
          <div className="buttons are-small is-flex-wrap-wrap">
            {OBJETIVOS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`button ${config.objetivo === o.value ? 'is-link' : 'is-light'}`}
                onClick={() => setObjetivo(o.value)}
              >
                <span className="mr-2">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="box mb-4 py-3">
          <h2 className="title is-6 mb-2">Metas diarias (opcional)</h2>
          <p className="is-size-7 has-text-grey mb-2">Para ver barras de progreso en Inicio y Comida.</p>
          <div className="columns">
            <div className="column">
              <div className="field">
                <label className="label is-size-7">Meta calorías (kcal/día)</label>
                <div className="control">
                  <input className="input is-small" type="number" min="0" placeholder="Ej: 2000" value={config.metaCalorias ?? ''} onChange={(e) => setMetaCalorias(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="column">
              <div className="field">
                <label className="label is-size-7">Meta proteína (g/día)</label>
                <div className="control">
                  <input className="input is-small" type="number" min="0" placeholder="Ej: 100" value={config.metaProteina ?? ''} onChange={(e) => setMetaProteina(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="box mb-4 py-3">
          <h2 className="title is-6 mb-2">Peso (kg)</h2>
          <p className="is-size-7 has-text-grey mb-2">
            Se usa para estimar calorías quemadas en ejercicio. Aproximado.
          </p>
          <div className="field">
            <div className="control">
              <input
                className="input is-small"
                type="number"
                min="0"
                step="0.1"
                value={config.pesoKg === '' || config.pesoKg == null ? '' : config.pesoKg}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="70"
              />
            </div>
          </div>
        </div>

        <PesoSeguimiento
          historial={historialPeso}
          setHistorial={setHistorialPeso}
          onActualizarPesoConfig={(kg) => setConfig((c) => ({ ...c, pesoKg: kg }))}
        />

        <div className="box py-3 mb-0">
          <h2 className="title is-6 mb-2">Suplementos que tomas</h2>
          <p className="is-size-7 has-text-grey mb-2">
            Elige cuáles quieres registrar cada día. En Inicio podrás marcar si los tomaste.
          </p>
          <div className="buttons are-small are-flex-wrap-wrap">
            {SUPLEMENTOS.map((s) => {
              const activo = suplementosActivos.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`button ${activo ? 'is-success' : 'is-light'}`}
                  onClick={() => toggleSuplemento(s.id)}
                >
                  {activo ? '✓ ' : ''}{s.label}
                </button>
              )
            })}
          </div>
        </div>
        </>
        )}

      </div>
    </section>
  )
}
