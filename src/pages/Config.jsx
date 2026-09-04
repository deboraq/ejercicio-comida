import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../context/AuthContext'
import { useMyProfile } from '../hooks/useMyProfile'
import { updateMyFullName } from '../lib/profeDb'
import { OBJETIVOS } from '../utils/consejos'
import { SUPLEMENTOS } from '../utils/suplementos'
import { buildPerfilCorporal, SEXOS, NIVELES_ACTIVIDAD } from '../utils/composicion'
import PesoSeguimiento from '../components/PesoSeguimiento'
import MedidasSeguimiento from '../components/MedidasSeguimiento'
import PageHeader from '../components/PageHeader'
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
  const [historialMedidas, setHistorialMedidas] = useStorage('medidasHistorial', [])
  const [config, setConfig] = useStorage('config', {
    objetivo: 'mantener_peso',
    pesoKg: 70,
    alturaCm: '',
    sexo: '',
    edad: '',
    nivelActividad: '',
    metaCalorias: '',
    metaProteina: '',
    metaCarbohidratos: '',
    metaGrasa: '',
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
  const setAltura = (v) => {
    if (v === '' || v == null) {
      setConfig((c) => ({ ...c, alturaCm: '' }))
      return
    }
    const num = Number(String(v).replace(',', '.'))
    if (!Number.isNaN(num) && num >= 0) setConfig((c) => ({ ...c, alturaCm: num }))
  }
  const setSexo = (v) => setConfig((c) => ({ ...c, sexo: v }))
  const setEdad = (v) => {
    if (v === '' || v == null) {
      setConfig((c) => ({ ...c, edad: '' }))
      return
    }
    const num = parseInt(v, 10)
    if (!Number.isNaN(num) && num >= 0) setConfig((c) => ({ ...c, edad: num }))
  }
  const setNivelActividad = (v) => setConfig((c) => ({ ...c, nivelActividad: v }))
  const setMetaCalorias = (v) => setConfig((c) => ({ ...c, metaCalorias: v === '' ? '' : String(Math.max(0, parseInt(v, 10) || 0)) }))
  const setMetaProteina = (v) => setConfig((c) => ({ ...c, metaProteina: v === '' ? '' : String(Math.max(0, parseInt(v, 10) || 0)) }))
  const setMetaCarbohidratos = (v) => setConfig((c) => ({ ...c, metaCarbohidratos: v === '' ? '' : String(Math.max(0, parseInt(v, 10) || 0)) }))
  const setMetaGrasa = (v) => setConfig((c) => ({ ...c, metaGrasa: v === '' ? '' : String(Math.max(0, parseInt(v, 10) || 0)) }))

  const perfilCorporal = buildPerfilCorporal(config)

  const aplicarSugerenciaMetas = () => {
    const s = perfilCorporal.sugerencia
    if (!s) return
    setConfig((c) => ({
      ...c,
      metaCalorias: String(s.calorias),
      metaProteina: String(s.proteina),
      metaCarbohidratos: String(s.carbohidratos),
      metaGrasa: String(s.grasa),
    }))
  }
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

  return (
    <section className="section py-4 config-page">
      <div className="container app-page-container">
        <PageHeader
          title={esProfe && !profileLoading ? 'Tu cuenta' : 'Configuración'}
          subtitle={
            esProfe && !profileLoading
              ? 'Ajustá tu perfil y sesión en la nube.'
              : 'Ajustá tu perfil y metas personales.'
          }
        />

        {cargandoPerfilNube && (
          <p className="is-size-7 has-text-grey mb-4">Cargando tu perfil…</p>
        )}

        {user && (
          <div className="box config-profile-card mb-4">
            <div className="config-profile-head">
              <div className="config-profile-avatar" aria-hidden>
                {(profile?.full_name || user.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="config-profile-info">
                <div className="is-flex is-align-items-center is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
                  <strong className="config-profile-name">
                    {(profile?.full_name || '').trim() || user.email}
                  </strong>
                  {isConfigured && !profileLoading && (
                    <span className={`config-role-badge config-role-badge--${profile?.role || 'alumno'}`}>
                      {etiquetaRol(profile?.role)}
                    </span>
                  )}
                </div>
                <p className="is-size-7 has-text-grey mb-0 config-profile-email">{user.email}</p>
              </div>
              <button type="button" className="button is-small is-light config-profile-logout" onClick={() => signOut()}>
                ↪ Cerrar sesión
              </button>
            </div>
            {isConfigured && profileError && (
              <p className="is-size-7 has-text-warning mt-3 mb-0">{profileError}</p>
            )}
          </div>
        )}

        {user && isConfigured && !profileLoading && (
          <div className="box mb-4 py-3">
            <h2 className="title is-6 mb-2">Nombre y apellido</h2>
            <div className="field mb-2">
              <input
                className="input"
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
              className="button is-light"
              disabled={guardandoNombre || !nombreDistintoAlGuardado}
              onClick={guardarNombrePerfil}
            >
              {guardandoNombre ? 'Guardando…' : 'Guardar nombre'}
            </button>
            {nombrePerfilMsg && <p className="is-size-7 has-text-success mt-2 mb-0">{nombrePerfilMsg}</p>}
            {nombrePerfilErr && <p className="is-size-7 has-text-danger mt-2 mb-0">{nombrePerfilErr}</p>}
          </div>
        )}

        {!cargandoPerfilNube && mostrarSeccionesAlumno && (
        <div className="box mb-4 py-3 config-cuenta-card">
          <h2 className="title is-6 mb-2">☁️ Cuenta</h2>
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
          <div className="notification config-info-box py-3 px-3 mt-3 mb-0">
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
          <h2 className="title is-6 mb-3">Tu objetivo</h2>
          <div className="config-objetivo-grid">
            {OBJETIVOS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`config-objetivo-tile${config.objetivo === o.value ? ' is-active' : ''}`}
                onClick={() => setObjetivo(o.value)}
              >
                <span className="config-objetivo-icon">{o.icon}</span>
                <span className="config-objetivo-label">{o.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div id="datos-corporales" className="box mb-4 py-3">
          <h2 className="title is-6 mb-2">Datos corporales</h2>
          <p className="is-size-7 has-text-grey mb-3">
            Peso + altura = IMC. Con sexo, edad y nivel de actividad estimamos tu gasto diario (TDEE) y sugerimos metas.
          </p>
          <div className="columns is-mobile is-multiline mb-0">
            <div className="column is-half">
              <label className="label is-size-7">Peso (kg)</label>
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
            <div className="column is-half">
              <label className="label is-size-7">Altura (cm)</label>
              <input
                className="input is-small"
                type="number"
                min="100"
                max="250"
                step="0.1"
                value={config.alturaCm === '' || config.alturaCm == null ? '' : config.alturaCm}
                onChange={(e) => setAltura(e.target.value)}
                placeholder="Ej: 165"
              />
            </div>
            <div className="column is-half">
              <label className="label is-size-7">Sexo</label>
              <div className="select is-fullwidth is-small">
                <select value={config.sexo || ''} onChange={(e) => setSexo(e.target.value)}>
                  {SEXOS.map((s) => (
                    <option key={s.value || 'na'} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="column is-half">
              <label className="label is-size-7">Edad</label>
              <input
                className="input is-small"
                type="number"
                min="10"
                max="120"
                value={config.edad === '' || config.edad == null ? '' : config.edad}
                onChange={(e) => setEdad(e.target.value)}
                placeholder="Ej: 28"
              />
            </div>
            <div className="column is-full">
              <label className="label is-size-7">Nivel de actividad</label>
              <div className="select is-fullwidth is-small">
                <select
                  value={config.nivelActividad || ''}
                  onChange={(e) => setNivelActividad(e.target.value)}
                >
                  <option value="">Elegí tu nivel…</option>
                  {NIVELES_ACTIVIDAD.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label} — {n.hint}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {(perfilCorporal.imc != null || perfilCorporal.tmb != null) && (
            <div className="medidas-chips mt-3">
              {perfilCorporal.imc != null && (
                <span className="medidas-chip">
                  <span className="medidas-chip-label">IMC</span>
                  <strong>{perfilCorporal.imc}</strong>
                  {perfilCorporal.categoria && (
                    <span className="has-text-grey ml-1">· {perfilCorporal.categoria.label}</span>
                  )}
                </span>
              )}
              {perfilCorporal.rango && (
                <span className="medidas-chip">
                  <span className="medidas-chip-label">Rango orientativo</span>
                  <strong>{perfilCorporal.rango.min}–{perfilCorporal.rango.max}</strong>
                  <span className="has-text-grey"> kg</span>
                </span>
              )}
              {perfilCorporal.tmb != null && (
                <span className="medidas-chip">
                  <span className="medidas-chip-label">TMB</span>
                  <strong>{perfilCorporal.tmb}</strong>
                  <span className="has-text-grey"> kcal</span>
                </span>
              )}
              {perfilCorporal.tdee != null && (
                <span className="medidas-chip">
                  <span className="medidas-chip-label">Gasto diario</span>
                  <strong>{perfilCorporal.tdee}</strong>
                  <span className="has-text-grey"> kcal</span>
                </span>
              )}
            </div>
          )}
          {!perfilCorporal.alturaCm && (
            <p className="is-size-7 has-text-grey mt-3 mb-0">
              Cargá tu altura para ver IMC.
            </p>
          )}
          {perfilCorporal.alturaCm && perfilCorporal.pesoKg && (!perfilCorporal.edad || !config.nivelActividad) && (
            <p className="is-size-7 has-text-grey mt-3 mb-0">
              Completá edad y nivel de actividad para estimar tu gasto diario y sugerir metas.
            </p>
          )}
          <p className="is-size-7 has-text-grey mt-2 mb-0">
            Estimaciones orientativas (Mifflin–St Jeor). El IMC no distingue músculo de grasa: seguí también las medidas.
          </p>
        </div>

        <div className="box mb-4 py-3 config-metas-card">
          <h2 className="title is-6 mb-2">Metas diarias (opcional)</h2>
          <p className="is-size-7 has-text-grey mb-3">Para ver barras de progreso en Inicio y Comida.</p>

          {perfilCorporal.sugerencia ? (
            <div className="config-sugerencia-metas mb-3">
              <p className="is-size-7 mb-2">
                Según tu objetivo, perfil y actividad, una sugerencia es{' '}
                <strong>{perfilCorporal.sugerencia.calorias} kcal</strong>
                {' · '}P {perfilCorporal.sugerencia.proteina} g
                {' · '}C {perfilCorporal.sugerencia.carbohidratos} g
                {' · '}G {perfilCorporal.sugerencia.grasa} g
                {perfilCorporal.tdee != null && (
                  <span className="has-text-grey">
                    {' '}(mantenimiento ≈ {perfilCorporal.tdee} kcal)
                  </span>
                )}
              </p>
              <button type="button" className="button is-link is-small" onClick={aplicarSugerenciaMetas}>
                Aplicar sugerencia a mis metas
              </button>
            </div>
          ) : (
            <p className="is-size-7 has-text-grey mb-3">
              Completá peso, altura, edad y nivel de actividad arriba para obtener una sugerencia automática.
            </p>
          )}

          <div className="config-metas-grid">
            <div className="field">
              <label className="label is-size-7">🔥 Calorías (kcal)</label>
              <input className="input" type="number" min="0" placeholder="Ej: 2000" value={config.metaCalorias ?? ''} onChange={(e) => setMetaCalorias(e.target.value)} />
            </div>
            <div className="field">
              <label className="label is-size-7">🥩 Proteínas (g)</label>
              <input className="input" type="number" min="0" placeholder="Ej: 150" value={config.metaProteina ?? ''} onChange={(e) => setMetaProteina(e.target.value)} />
            </div>
            <div className="field">
              <label className="label is-size-7">🌾 Carbohidratos (g)</label>
              <input className="input" type="number" min="0" placeholder="Ej: 250" value={config.metaCarbohidratos ?? ''} onChange={(e) => setMetaCarbohidratos(e.target.value)} />
            </div>
            <div className="field">
              <label className="label is-size-7">💧 Grasas (g)</label>
              <input className="input" type="number" min="0" placeholder="Ej: 60" value={config.metaGrasa ?? ''} onChange={(e) => setMetaGrasa(e.target.value)} />
            </div>
          </div>
          <div className="is-flex is-justify-content-flex-end mt-3">
            <span className="tag is-success">Guardado automático</span>
          </div>
        </div>

        <PesoSeguimiento
          historial={historialPeso}
          setHistorial={setHistorialPeso}
          onActualizarPesoConfig={(kg) => setConfig((c) => ({ ...c, pesoKg: kg }))}
        />

        <MedidasSeguimiento
          historial={historialMedidas}
          setHistorial={setHistorialMedidas}
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
