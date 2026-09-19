import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../context/AuthContext'
import { useMyProfile } from '../hooks/useMyProfile'
import { updateMyFullName } from '../lib/profeDb'
import { OBJETIVOS } from '../utils/consejos'
import { SUPLEMENTOS } from '../utils/suplementos'
import { buildPerfilCorporal, SEXOS, NIVELES_ACTIVIDAD } from '../utils/composicion'
import { normalizarPesoHistorial, sembrarPesoDesdeConfig } from '../utils/pesoStorage'
import { normalizarMedidasHistorial } from '../utils/medidasStorage'
import { asArray } from '../hooks/useLocalStorage'
import PesoSeguimiento from '../components/PesoSeguimiento'
import MedidasSeguimiento from '../components/MedidasSeguimiento'
import SeguimientoCaja from '../components/SeguimientoCaja'
import PageHeader from '../components/PageHeader'
import {
  exportarComidasCsv,
  exportarComidasExcel,
  exportarComidasJson,
  exportarEjerciciosActividadJson,
  exportarEjerciciosActividadCsv,
  exportarEjerciciosActividadExcel,
  exportarGymCsv,
  exportarGymExcel,
  exportarGymJson,
} from '../utils/exportData'
import '../components/config/ConfigTitanium.css'

const OBJETIVO_DETALLE = {
  bajar_peso: { sub: 'Déficit moderado (-400 kcal)', badge: 'Déficit calórico activo' },
  mantener_peso: { sub: 'Equilibrio normocalórico' },
  aumentar_peso: { sub: 'Superávit progresivo' },
  ganar_musculo: { sub: 'Hipertrofia & alta proteína' },
}

const META_HINTS = {
  calorias: 'Energía limpia',
  proteina: 'Reparación muscular',
  carbohidratos: 'Rendimiento',
  grasa: 'Salud hormonal',
}

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
  const [historialPesoRaw, setHistorialPeso, pesoCloudReady] = useStorage('pesoHistorial', [])
  const historialPeso = useMemo(
    () => normalizarPesoHistorial(asArray(historialPesoRaw)),
    [historialPesoRaw],
  )
  const [historialMedidasRaw, setHistorialMedidas, medidasCloudReady] = useStorage('medidasHistorial', [])
  const historialMedidas = useMemo(
    () => normalizarMedidasHistorial(asArray(historialMedidasRaw)),
    [historialMedidasRaw],
  )
  const [comidas] = useStorage('comida', [])
  const [rutinaPesos] = useStorage('rutinaPesos', [])
  const [rutinas] = useStorage('rutinas', [])
  const [rutinaActivaId] = useStorage('rutinaActivaId', '')
  const [ejerciciosActividad] = useStorage('ejercicios', [])
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

  useEffect(() => {
    if (!pesoCloudReady) return
    const normalizado = normalizarPesoHistorial(historialPesoRaw)
    if (JSON.stringify(normalizado) !== JSON.stringify(historialPesoRaw)) {
      setHistorialPeso(normalizado)
    }
  }, [pesoCloudReady, historialPesoRaw, setHistorialPeso])

  useEffect(() => {
    if (!pesoCloudReady || isConfigured) return
    if (normalizarPesoHistorial(historialPesoRaw).length > 0) return
    const sembrado = sembrarPesoDesdeConfig(historialPesoRaw, config)
    if (sembrado.length > 0) setHistorialPeso(sembrado)
  }, [pesoCloudReady, isConfigured, historialPesoRaw, config?.pesoKg, setHistorialPeso])

  useEffect(() => {
    if (!medidasCloudReady) return
    const normalizado = normalizarMedidasHistorial(historialMedidasRaw)
    if (JSON.stringify(normalizado) !== JSON.stringify(historialMedidasRaw)) {
      setHistorialMedidas(normalizado)
    }
  }, [medidasCloudReady, historialMedidasRaw, setHistorialMedidas])

  useEffect(() => {
    if (!historialPeso?.length) return
    const latest = [...historialPeso].sort((a, b) =>
      String(b.fecha).localeCompare(String(a.fecha))
    )[0]
    const kg = Number(latest?.pesoKg)
    if (!Number.isFinite(kg) || kg <= 0) return
    if (Number(config.pesoKg) === kg) return
    setConfig((c) => ({ ...c, pesoKg: kg }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar historial
  }, [historialPeso])

  const perfilCorporal = buildPerfilCorporal(config)
  const pesoMostrado = perfilCorporal.pesoKg

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
  const totalComidas = Array.isArray(comidas) ? comidas.length : 0
  const totalSeriesGym = Array.isArray(rutinaPesos) ? rutinaPesos.length : 0
  const totalActividad = Array.isArray(ejerciciosActividad) ? ejerciciosActividad.length : 0

  const avisoSinDatos = (tipo) => {
    window.alert(`No hay registros de ${tipo} para exportar todavía.`)
  }

  const abrirExportar = () => {
    window.location.hash = 'exportar-datos'
  }

  const cargandoPerfilNube = Boolean(user && isConfigured && profileLoading)
  const esProfe = profile?.role === 'profe'
  const mostrarSeccionesAlumno = !user || !isConfigured || (user && !profileLoading && !esProfe)
  const objetivoActivo = OBJETIVOS.find((o) => o.value === config.objetivo)
  const detalleObjetivo = OBJETIVO_DETALLE[config.objetivo]

  const etiquetaRol = (role) => {
    if (role === 'admin') return 'Administrador'
    if (role === 'profe') return 'Entrenador'
    if (role === 'alumno') return 'Alumno'
    return role || '—'
  }

  const nombreMostrado = (profile?.full_name || '').trim() || user?.email || 'Usuario'
  const inicialAvatar = nombreMostrado.charAt(0).toUpperCase()

  return (
    <section className="section config-page cfg-ti-page">
      <div className="container app-page-container">
        <PageHeader
          title={esProfe && !profileLoading ? 'Tu cuenta' : 'Configuración'}
          subtitle={
            esProfe && !profileLoading
              ? 'Ajustá tu perfil y sesión en la nube.'
              : 'Perfil, objetivos y seguimiento corporal en un solo lugar.'
          }
        />

        {cargandoPerfilNube && (
          <p className="cfg-ti-sub mb-4">Cargando tu perfil…</p>
        )}

        {user && (
          <div className="cfg-ti-hero">
            <div className="cfg-ti-hero-top">
              <div className="cfg-ti-hero-main">
                <div className="cfg-ti-avatar" aria-hidden>{inicialAvatar}</div>
                <div className="cfg-ti-hero-meta">
                  <p className="cfg-ti-hero-name mb-0">{nombreMostrado}</p>
                  <div className="cfg-ti-badges">
                    {isConfigured && !profileLoading && profile?.role === 'admin' && (
                      <span className="cfg-ti-badge cfg-ti-badge--admin">Administrador</span>
                    )}
                    {isConfigured && !profileLoading && profile?.role === 'profe' && (
                      <span className="cfg-ti-badge cfg-ti-badge--profe">Entrenador</span>
                    )}
                    {isConfigured && !profileLoading && profile?.role === 'admin' && mostrarSeccionesAlumno && (
                      <span className="cfg-ti-badge cfg-ti-badge--alumna">Alumna</span>
                    )}
                    {isConfigured && !profileLoading && profile?.role === 'alumno' && (
                      <span className="cfg-ti-badge cfg-ti-badge--alumno">{etiquetaRol(profile.role)}</span>
                    )}
                  </div>
                  <p className="cfg-ti-email mb-0">{user.email}</p>
                  {user && isConfigured && !profileLoading && (
                    <p className="cfg-ti-sync mb-0">✓ Sincronizado con la nube de Fitness Pro</p>
                  )}
                </div>
              </div>
              <div className="cfg-ti-hero-actions">
                {!cargandoPerfilNube && (
                  <button type="button" className="cfg-ti-btn cfg-ti-btn--ghost" onClick={abrirExportar}>
                    ↓ Exportar mis datos
                  </button>
                )}
                <button type="button" className="cfg-ti-btn cfg-ti-btn--danger" onClick={() => signOut()}>
                  ↪ Cerrar sesión
                </button>
              </div>
            </div>

            {user && isConfigured && !profileLoading && (
              <div className="cfg-ti-hero-bottom">
                <div className="cfg-ti-name-field">
                  <label htmlFor="cfg-nombre">Nombre y apellido</label>
                  <div className="cfg-ti-name-row">
                    <input
                      id="cfg-nombre"
                      className="cfg-ti-input input"
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
                    <button
                      type="button"
                      className="cfg-ti-btn-primary"
                      disabled={guardandoNombre || !nombreDistintoAlGuardado}
                      onClick={guardarNombrePerfil}
                    >
                      {guardandoNombre ? '…' : 'Guardar'}
                    </button>
                  </div>
                  {nombrePerfilMsg && <p className="cfg-ti-msg-ok mb-0">{nombrePerfilMsg}</p>}
                  {nombrePerfilErr && <p className="cfg-ti-msg-err mb-0">{nombrePerfilErr}</p>}
                </div>
                {mostrarSeccionesAlumno && (
                  <div className="cfg-ti-info-box">
                    <strong>¿Sos entrenador?</strong> Un administrador te marca el rol en Admin. Después entrá a{' '}
                    <Link to="/profe">Profe</Link> para vincular alumnos y enviar rutinas.
                  </div>
                )}
              </div>
            )}

            {isConfigured && profileError && (
              <p className="cfg-ti-msg-err mt-3 mb-0">{profileError}</p>
            )}
          </div>
        )}

        {!cargandoPerfilNube && (
          <SeguimientoCaja
            id="exportar-datos"
            className="cfg-ti-export-panel"
            titulo="Exportar datos"
            resumen={`${totalComidas} comidas · ${totalSeriesGym} series · ${totalActividad} actividad`}
            ctaCerrado="Descargar"
          >
            <p className="config-hint mb-3">
              Descargá tu historial para Excel, Google Sheets o respaldo.
            </p>
            <p className="config-section-label mb-2">Comidas</p>
            <div className="buttons are-small mb-3">
              <button type="button" className="button is-link is-light" onClick={() => { if (!totalComidas) return avisoSinDatos('comidas'); exportarComidasExcel(comidas) }}>↓ Excel ({totalComidas})</button>
              <button type="button" className="button is-light" onClick={() => { if (!totalComidas) return avisoSinDatos('comidas'); exportarComidasCsv(comidas) }}>↓ CSV</button>
              <button type="button" className="button is-light" onClick={() => { if (!totalComidas) return avisoSinDatos('comidas'); exportarComidasJson(comidas) }}>↓ JSON</button>
            </div>
            <p className="config-section-label mb-2">Gimnasio</p>
            <div className="buttons are-small mb-3">
              <button type="button" className="button is-link is-light" onClick={() => { if (!totalSeriesGym) return avisoSinDatos('entrenamientos de gym'); exportarGymExcel(rutinaPesos) }}>↓ Excel ({totalSeriesGym})</button>
              <button type="button" className="button is-light" onClick={() => { if (!totalSeriesGym) return avisoSinDatos('entrenamientos de gym'); exportarGymCsv(rutinaPesos) }}>↓ CSV</button>
              <button type="button" className="button is-light" onClick={() => { if (!totalSeriesGym) return avisoSinDatos('entrenamientos de gym'); exportarGymJson(rutinaPesos, rutinas, rutinaActivaId) }}>↓ JSON + plan</button>
            </div>
            <p className="config-section-label mb-2">Actividad libre</p>
            <div className="buttons are-small">
              <button type="button" className="button is-link is-light" onClick={() => { if (!totalActividad) return avisoSinDatos('actividad libre'); exportarEjerciciosActividadExcel(ejerciciosActividad) }}>↓ Excel ({totalActividad})</button>
              <button type="button" className="button is-light" onClick={() => { if (!totalActividad) return avisoSinDatos('actividad libre'); exportarEjerciciosActividadCsv(ejerciciosActividad) }}>↓ CSV</button>
              <button type="button" className="button is-light" onClick={() => { if (!totalActividad) return avisoSinDatos('actividad libre'); exportarEjerciciosActividadJson(ejerciciosActividad) }}>↓ JSON</button>
            </div>
          </SeguimientoCaja>
        )}

        {!user && !cargandoPerfilNube && mostrarSeccionesAlumno && (
          <div className="cfg-ti-cuenta mb-4">
            <h2 className="title is-6 mb-2">☁️ Cuenta</h2>
            {!isConfigured ? (
              <p className="is-size-7 has-text-grey mb-0">Configura Supabase (ver README) para usar cuentas.</p>
            ) : (
              <Link to="/login" className="button is-link is-small">Iniciar sesión o crear cuenta</Link>
            )}
          </div>
        )}

        {!cargandoPerfilNube && mostrarSeccionesAlumno && (
          <>
            <section className="cfg-ti-objetivos">
              <div className="cfg-ti-objetivos-head">
                <h2>Tu objetivo actual</h2>
                {detalleObjetivo?.badge && (
                  <span className="cfg-ti-objetivo-badge">{detalleObjetivo.badge}</span>
                )}
              </div>
              <div className="cfg-ti-objetivo-grid">
                {OBJETIVOS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`cfg-ti-objetivo-tile cfg-ti-objetivo-tile--${o.value}${config.objetivo === o.value ? ' is-active' : ''}`}
                    onClick={() => setObjetivo(o.value)}
                  >
                    <span className="cfg-ti-objetivo-icon">{o.icon}</span>
                    <span className="cfg-ti-objetivo-label">{o.label}</span>
                    <span className="cfg-ti-objetivo-sub">{OBJETIVO_DETALLE[o.value]?.sub || ''}</span>
                  </button>
                ))}
              </div>
              <p className="cfg-ti-objetivo-hint mb-0">
                Al cambiar tu objetivo, las sugerencias calóricas y macros se recalculan automáticamente según tu perfil.
                {objetivoActivo ? ` Ahora: ${objetivoActivo.label.toLowerCase()}.` : ''}
              </p>
            </section>

            <div className="cfg-ti-grid">
              <div className="cfg-ti-col cfg-ti-col--left">
                <PesoSeguimiento
                  historial={historialPeso}
                  setHistorial={setHistorialPeso}
                  pesoActualKg={pesoMostrado}
                  variant="titanium"
                  onActualizarPesoConfig={(kg) => setConfig((c) => ({ ...c, pesoKg: kg }))}
                />
                <MedidasSeguimiento
                  historial={historialMedidas}
                  setHistorial={setHistorialMedidas}
                  variant="titanium"
                />
              </div>

              <div className="cfg-ti-col cfg-ti-col--right">
                <article className="cfg-ti-card cfg-ti-card--violet" id="datos-corporales">
                  <header className="cfg-ti-card-head">
                    <div>
                      <h2 className="cfg-ti-card-title">Datos biométricos para cálculos</h2>
                      <p className="cfg-ti-card-sub">IMC, gasto basal y rango orientativo según tu perfil.</p>
                    </div>
                  </header>

                  {(perfilCorporal.imc != null || perfilCorporal.tmb != null) && (
                    <div className="cfg-ti-kpi-row">
                      {perfilCorporal.imc != null && (
                        <div className="cfg-ti-kpi cfg-ti-kpi--green">
                          <span className="cfg-ti-kpi-label">IMC</span>
                          <strong className="cfg-ti-kpi-value">{perfilCorporal.imc}</strong>
                          {perfilCorporal.categoria && (
                            <span className="cfg-ti-kpi-note">{perfilCorporal.categoria.label}</span>
                          )}
                        </div>
                      )}
                      {perfilCorporal.rango && (
                        <div className="cfg-ti-kpi cfg-ti-kpi--blue">
                          <span className="cfg-ti-kpi-label">Rango orientativo</span>
                          <strong className="cfg-ti-kpi-value">{perfilCorporal.rango.min}–{perfilCorporal.rango.max}</strong>
                          <span className="cfg-ti-kpi-note">kg recomendados</span>
                        </div>
                      )}
                      {perfilCorporal.tmb != null && (
                        <div className="cfg-ti-kpi cfg-ti-kpi--teal">
                          <span className="cfg-ti-kpi-label">TMB (basal)</span>
                          <strong className="cfg-ti-kpi-value">{perfilCorporal.tmb}</strong>
                          <span className="cfg-ti-kpi-note">kcal / día</span>
                        </div>
                      )}
                      {perfilCorporal.tdee != null && (
                        <div className="cfg-ti-kpi cfg-ti-kpi--violet">
                          <span className="cfg-ti-kpi-label">Gasto diario (TDEE)</span>
                          <strong className="cfg-ti-kpi-value">~{perfilCorporal.tdee}</strong>
                          <span className="cfg-ti-kpi-note cfg-ti-kpi-note--purple">kcal mantenimiento</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="cfg-ti-perfil-grid">
                    <div className="cfg-ti-field">
                      <label className="cfg-ti-label">Altura (cm)</label>
                      <input
                        className="cfg-ti-input input"
                        type="number"
                        min="100"
                        max="250"
                        step="0.1"
                        value={config.alturaCm === '' || config.alturaCm == null ? '' : config.alturaCm}
                        onChange={(e) => setAltura(e.target.value)}
                        placeholder="Ej: 165"
                      />
                    </div>
                    <div className="cfg-ti-field">
                      <label className="cfg-ti-label">Sexo biológico</label>
                      <div className="cfg-ti-select-wrap">
                        <select className="cfg-ti-input" value={config.sexo || ''} onChange={(e) => setSexo(e.target.value)}>
                          {SEXOS.map((s) => (
                            <option key={s.value || 'na'} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="cfg-ti-field">
                      <label className="cfg-ti-label">Edad</label>
                      <input
                        className="cfg-ti-input input"
                        type="number"
                        min="10"
                        max="120"
                        value={config.edad === '' || config.edad == null ? '' : config.edad}
                        onChange={(e) => setEdad(e.target.value)}
                        placeholder="Ej: 28"
                      />
                    </div>
                    <div className="cfg-ti-field cfg-ti-field--wide">
                      <label className="cfg-ti-label">Nivel de actividad habitual</label>
                      <div className="cfg-ti-select-wrap">
                        <select className="cfg-ti-input" value={config.nivelActividad || ''} onChange={(e) => setNivelActividad(e.target.value)}>
                          <option value="">Elegí tu nivel…</option>
                          {NIVELES_ACTIVIDAD.map((n) => (
                            <option key={n.value} value={n.value}>{n.label} — {n.hint}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {!perfilCorporal.alturaCm && (
                    <p className="cfg-ti-objetivo-hint mt-3 mb-0">Cargá tu altura para ver el IMC.</p>
                  )}
                  {!pesoMostrado && (
                    <p className="cfg-ti-objetivo-hint mt-2 mb-0">Registrá tu peso en la columna izquierda para completar los cálculos.</p>
                  )}
                </article>

                <article className="cfg-ti-card cfg-ti-card--amber" id="metas-diarias">
                  <header className="cfg-ti-card-head">
                    <div>
                      <h2 className="cfg-ti-card-title">Metas diarias de nutrición</h2>
                      <p className="cfg-ti-card-sub">Para barras de progreso en Inicio y Comida.</p>
                    </div>
                  </header>

                  {perfilCorporal.sugerencia ? (
                    <div className="cfg-ti-sugerencia">
                      <p className="mb-0">
                        Según tu objetivo ({objetivoActivo?.label?.toLowerCase() || 'actual'}) y perfil, sugerimos{' '}
                        <strong>{perfilCorporal.sugerencia.calorias} kcal</strong>
                        {' · '}P {perfilCorporal.sugerencia.proteina} g
                        {' · '}C {perfilCorporal.sugerencia.carbohidratos} g
                        {' · '}G {perfilCorporal.sugerencia.grasa} g
                        {perfilCorporal.tdee != null && (
                          <span className="has-text-grey"> (mantenimiento ≈ {perfilCorporal.tdee} kcal)</span>
                        )}
                      </p>
                      <button type="button" className="cfg-ti-btn-primary mt-2" onClick={aplicarSugerenciaMetas}>
                        Aplicar sugerencia
                      </button>
                    </div>
                  ) : (
                    <p className="cfg-ti-objetivo-hint mb-3">
                      Completá peso, altura, edad y actividad para una sugerencia automática.
                    </p>
                  )}

                  <div className="cfg-ti-metas-grid">
                    <div className="cfg-ti-field">
                      <label className="cfg-ti-label">Calorías (kcal)</label>
                      <input className="cfg-ti-input input" type="number" min="0" placeholder="Ej: 2000" value={config.metaCalorias ?? ''} onChange={(e) => setMetaCalorias(e.target.value)} />
                      <p className="cfg-ti-meta-hint mb-0">{META_HINTS.calorias}</p>
                    </div>
                    <div className="cfg-ti-field">
                      <label className="cfg-ti-label">Proteínas (g)</label>
                      <input className="cfg-ti-input input" type="number" min="0" placeholder="Ej: 150" value={config.metaProteina ?? ''} onChange={(e) => setMetaProteina(e.target.value)} />
                      <p className="cfg-ti-meta-hint mb-0">{META_HINTS.proteina}</p>
                    </div>
                    <div className="cfg-ti-field">
                      <label className="cfg-ti-label">Carbohidratos (g)</label>
                      <input className="cfg-ti-input input" type="number" min="0" placeholder="Ej: 250" value={config.metaCarbohidratos ?? ''} onChange={(e) => setMetaCarbohidratos(e.target.value)} />
                      <p className="cfg-ti-meta-hint mb-0">{META_HINTS.carbohidratos}</p>
                    </div>
                    <div className="cfg-ti-field">
                      <label className="cfg-ti-label">Grasas (g)</label>
                      <input className="cfg-ti-input input" type="number" min="0" placeholder="Ej: 60" value={config.metaGrasa ?? ''} onChange={(e) => setMetaGrasa(e.target.value)} />
                      <p className="cfg-ti-meta-hint mb-0">{META_HINTS.grasa}</p>
                    </div>
                  </div>
                  <p className="cfg-ti-autosave mb-0">Guarda solo</p>
                </article>

                <article className="cfg-ti-card cfg-ti-card--indigo" id="suplementos-config">
                  <div className="cfg-ti-supp-head">
                    <h2 className="cfg-ti-card-title mb-0">Suplementos activos</h2>
                    <span className="cfg-ti-supp-count">{suplementosActivos.length} seleccionados</span>
                  </div>
                  <p className="cfg-ti-card-sub mb-3">Marcá cuáles querés registrar cada día en Inicio.</p>
                  <div className="cfg-ti-chips">
                    {SUPLEMENTOS.map((s) => {
                      const activo = suplementosActivos.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`cfg-ti-chip${activo ? ' is-active' : ''}`}
                          onClick={() => toggleSuplemento(s.id)}
                        >
                          {activo ? '✓ ' : ''}{s.label}
                        </button>
                      )
                    })}
                  </div>
                </article>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
