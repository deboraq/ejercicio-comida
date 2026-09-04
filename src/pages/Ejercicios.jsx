import { useState, useRef, useEffect } from 'react'
import { useStorage } from '../hooks/useStorage'
import {
  caloriasEjercicioRegistro,
  fechaToISO,
  fechaSoloDia,
  minutosDesdeKm,
  sinAcentos,
  tipoAdmiteKilometros,
  TIPOS_EJERCICIO_AGRUPADOS,
  etiquetaTipo,
  getCategoriaTipo,
} from '../utils/calorias'
import PageHeader from '../components/PageHeader'
import { getUltimosNDias } from '../utils/estadisticas'
import { getIconoActividad } from '../utils/iconosActividad'

const TIPO_DEFAULT = TIPOS_EJERCICIO_AGRUPADOS[0].opciones[0].value
const TIPOS_FLAT = TIPOS_EJERCICIO_AGRUPADOS.flatMap((g) => g.opciones)

function tituloDiaHistorial(fecha) {
  const d = new Date(`${fecha}T12:00:00`)
  return d
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()
}

export default function Ejercicios() {
  const [ejercicios, setEjercicios] = useStorage('ejercicios', [])
  const [config] = useStorage('config', { pesoKg: 70 })
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState(TIPO_DEFAULT)
  const [duracion, setDuracion] = useState('')
  const [modoMedida, setModoMedida] = useState('minutos')
  const [distanciaKm, setDistanciaKm] = useState('')
  const [caloriasManual, setCaloriasManual] = useState('')
  const [notas, setNotas] = useState('')
  const [fechaInput, setFechaInput] = useState(() => fechaToISO(new Date()))
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [histLimit, setHistLimit] = useState(12)
  const [formAbierto, setFormAbierto] = useState(false)
  const refPanelFormulario = useRef(null)

  useEffect(() => {
    if (!formAbierto) return
    const el = refPanelFormulario.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [formAbierto, editandoId])

  useEffect(() => {
    if (!tipoAdmiteKilometros(tipo) && modoMedida === 'km') setModoMedida('minutos')
  }, [tipo, modoMedida])

  const pesoKg = config?.pesoKg || 70

  const limpiarFormulario = () => {
    setNombre('')
    setTipo(TIPO_DEFAULT)
    setDuracion('')
    setModoMedida('minutos')
    setDistanciaKm('')
    setCaloriasManual('')
    setNotas('')
    setFechaInput(fechaToISO(new Date()))
    setEditandoId(null)
  }

  const abrirNuevoEjercicio = () => {
    limpiarFormulario()
    setFormAbierto(true)
  }

  const cerrarFormulario = () => {
    limpiarFormulario()
    setFormAbierto(false)
  }

  const parseManualCal = () => {
    const n = parseFloat(String(caloriasManual).replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }

  const agregar = (e) => {
    e.preventDefault()
    if (!nombre.trim()) return
    const fecha = fechaInput || fechaToISO(new Date())
    const manualVal = parseManualCal()
    const kmVal = Number(distanciaKm)
    const kmOk = modoMedida === 'km' && tipoAdmiteKilometros(tipo) && kmVal > 0
    const minVal = Number(duracion)
    const minOk = modoMedida === 'minutos' && minVal > 0
    if (!manualVal && !kmOk && !minOk) return

    let duracionFinal = 0
    let distanciaKmSave
    if (kmOk) {
      distanciaKmSave = kmVal
      duracionFinal = minutosDesdeKm(tipo, kmVal)
    } else if (minOk) {
      duracionFinal = Math.round(minVal)
    }

    const camposBase = {
      nombre: nombre.trim(),
      tipo,
      duracion: duracionFinal,
      notas: notas.trim(),
      fecha,
    }
    if (manualVal) camposBase.caloriasManual = manualVal
    if (kmOk) camposBase.distanciaKm = distanciaKmSave

    if (editandoId) {
      setEjercicios((prev) =>
        prev.map((item) => {
          if (item.id !== editandoId) return item
          const durF = kmOk || minOk ? duracionFinal : manualVal ? Number(item.duracion) || 0 : duracionFinal
          const merged = { ...item, ...camposBase, duracion: durF }
          if (!manualVal) delete merged.caloriasManual
          if (kmOk) merged.distanciaKm = distanciaKmSave
          else delete merged.distanciaKm
          return merged
        })
      )
    } else {
      const nuevo = { id: crypto.randomUUID(), ...camposBase }
      if (!kmOk) delete nuevo.distanciaKm
      setEjercicios((prev) => [nuevo, ...prev])
    }
    cerrarFormulario()
  }

  const iniciarEdicion = (item) => {
    setEditandoId(item.id)
    setNombre(item.nombre || '')
    const t = item.tipo || TIPO_DEFAULT
    setTipo(t)
    if (item.distanciaKm != null && Number(item.distanciaKm) > 0 && tipoAdmiteKilometros(t)) {
      setModoMedida('km')
      setDistanciaKm(String(item.distanciaKm))
      setDuracion('')
    } else {
      setModoMedida('minutos')
      setDistanciaKm('')
      setDuracion(item.duracion != null ? String(item.duracion) : '')
    }
    setCaloriasManual(item.caloriasManual != null && Number(item.caloriasManual) > 0 ? String(item.caloriasManual) : '')
    setNotas(item.notas || '')
    setFechaInput(fechaSoloDia(item.fecha) || fechaToISO(new Date()))
    setFormAbierto(true)
  }

  const eliminar = (id) => {
    if (editandoId === id) cerrarFormulario()
    setEjercicios((prev) => prev.filter((e) => e.id !== id))
  }

  const ejerciciosFiltrados = ejercicios.filter((e) => {
    if (filtroTexto.trim()) {
      const t = sinAcentos(filtroTexto.trim())
      const matchNombre = sinAcentos(e.nombre || '').includes(t)
      const matchNotas = sinAcentos(e.notas || '').includes(t)
      const matchTipo = sinAcentos(etiquetaTipo(e.tipo)).includes(t)
      if (!matchNombre && !matchNotas && !matchTipo) return false
    }
    if (filtroTipo && e.tipo !== filtroTipo) return false
    const fKey = fechaSoloDia(e.fecha)
    if (filtroDesde && fKey < filtroDesde) return false
    if (filtroHasta && fKey > filtroHasta) return false
    return true
  })

  const porFecha = ejerciciosFiltrados.reduce((acc, e) => {
    const key = fechaSoloDia(e.fecha)
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  const fechasOrdenadas = Object.keys(porFecha).sort((a, b) => b.localeCompare(a))
  const fechasVisibles = fechasOrdenadas.slice(0, histLimit)
  const hayMasHistorial = fechasOrdenadas.length > histLimit

  const hoyIso = fechaToISO(new Date())
  const minutosHoy = ejercicios.filter((e) => fechaSoloDia(e.fecha) === hoyIso).reduce((s, e) => s + e.duracion, 0)
  const caloriasHoy = ejercicios
    .filter((e) => fechaSoloDia(e.fecha) === hoyIso)
    .reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoKg), 0)

  const dias7 = getUltimosNDias(7)
  const minutosUltimos7 = ejercicios
    .filter((e) => dias7.includes(fechaSoloDia(e.fecha)))
    .reduce((s, e) => s + e.duracion, 0)
  const caloriasUltimos7 = ejercicios
    .filter((e) => dias7.includes(fechaSoloDia(e.fecha)))
    .reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoKg), 0)

  return (
    <section className="section py-4 ejercicios-page">
      <div className="container app-page-container">
        <PageHeader
          title="Ejercicios"
          subtitle="Registra y monitorea tu actividad física."
          action={(
            <button
              type="button"
              className="button is-light ti-page-action-btn ej-nuevo-btn"
              onClick={abrirNuevoEjercicio}
            >
              + Nuevo ejercicio
            </button>
          )}
        />

        <div className="ejercicios-layout">
          <div className="ejercicios-metric-slot ejercicios-metric--hoy">
            <div className="box py-3 app-summary-card ejercicios-metric-card mb-0">
              <p className="ejercicios-metric-title mb-2">Hoy</p>
              <p className="ejercicios-metric-row mb-1">
                <span className="ejercicios-metric-label">Tiempo activo</span>
                <span className="ejercicios-metric-value">{minutosHoy} min</span>
              </p>
              <p className="ejercicios-metric-row mb-0">
                <span className="ejercicios-metric-label">Calorías</span>
                <span className="ejercicios-metric-value ejercicios-metric-kcal">{caloriasHoy} kcal</span>
              </p>
              <p className={`ejercicios-metric-empty mb-0${minutosHoy === 0 ? '' : ' is-invisible'}`}>No hay actividad aún</p>
            </div>
          </div>

          <div className="ejercicios-metric-slot ejercicios-metric--week">
            <div className="box py-3 app-summary-card ejercicios-metric-card mb-0">
              <p className="ejercicios-metric-title mb-2">Últimos 7 días</p>
              <p className="ejercicios-metric-row mb-1">
                <span className="ejercicios-metric-label">Total tiempo</span>
                <span className="ejercicios-metric-value">{minutosUltimos7} min</span>
              </p>
              <p className="ejercicios-metric-row mb-0">
                <span className="ejercicios-metric-label">Total calorías</span>
                <span className="ejercicios-metric-value ejercicios-metric-kcal ejercicios-metric-kcal--week">
                  {caloriasUltimos7.toLocaleString('es-AR')} kcal
                </span>
              </p>
              <p className="ejercicios-metric-empty mb-0 is-invisible" aria-hidden="true">—</p>
            </div>
          </div>

          <div className="ejercicios-layout-main">
            <div ref={refPanelFormulario} className="box ejercicios-form-card mb-0 py-0">
              {!formAbierto ? (
                <button
                  type="button"
                  className="ej-form-cta-cerrado"
                  onClick={abrirNuevoEjercicio}
                >
                  <span>
                    <strong className="ej-form-cta-titulo">Registrar ejercicio</strong>
                    <span className="ej-form-cta-sub">Caminata, cardio, deportes…</span>
                  </span>
                  <span className="ej-form-cta-btn">+ Nuevo</span>
                </button>
              ) : (
                <div className="ejercicios-form-abierto">
                  <div className="ej-form-head">
                    <h2 className="ej-form-title mb-0">
                      {editandoId ? 'Editar ejercicio' : 'Nuevo ejercicio'}
                    </h2>
                    <button type="button" className="button is-small is-light" onClick={cerrarFormulario}>
                      Cerrar
                    </button>
                  </div>
                  <form onSubmit={agregar} className="ej-form">
                    <div className="field">
                      <label className="ej-form-label" htmlFor="ej-fecha">Fecha</label>
                      <div className="control">
                        <input
                          id="ej-fecha"
                          className="input"
                          type="date"
                          value={fechaInput}
                          onChange={(e) => setFechaInput(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label className="ej-form-label" htmlFor="ej-nombre">Nombre del ejercicio</label>
                      <div className="control">
                        <input
                          id="ej-nombre"
                          className="input"
                          type="text"
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          placeholder="Ej: Padel, Correr, Pesas..."
                          autoComplete="off"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label className="ej-form-label" htmlFor="ej-tipo">Tipo de actividad</label>
                      <div className="control">
                        <div className="select is-fullwidth">
                          <select
                            id="ej-tipo"
                            value={tipo}
                            onChange={(e) => {
                              const v = e.target.value
                              setTipo(v)
                              if (!tipoAdmiteKilometros(v)) setModoMedida('minutos')
                            }}
                          >
                            {TIPOS_EJERCICIO_AGRUPADOS.map((g) => (
                              <optgroup key={g.categoria} label={g.categoria}>
                                {g.opciones.map((op) => (
                                  <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {tipoAdmiteKilometros(tipo) ? (
                      <div className="field">
                        <label className="ej-form-label">Medida</label>
                        <div className="ti-segmented">
                          <button
                            type="button"
                            className={modoMedida === 'minutos' ? 'is-active' : ''}
                            onClick={() => setModoMedida('minutos')}
                          >
                            Minutos
                          </button>
                          <button
                            type="button"
                            className={modoMedida === 'km' ? 'is-active' : ''}
                            onClick={() => setModoMedida('km')}
                          >
                            Kilómetros
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="field">
                      <label className="ej-form-label" htmlFor="ej-duracion">
                        {tipoAdmiteKilometros(tipo) && modoMedida === 'km' ? 'Distancia (km)' : 'Duración (min)'}
                      </label>
                      <div className="control">
                        {tipoAdmiteKilometros(tipo) && modoMedida === 'km' ? (
                          <input
                            id="ej-duracion"
                            className="input"
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={distanciaKm}
                            onChange={(e) => setDistanciaKm(e.target.value)}
                            placeholder="Ej: 5"
                          />
                        ) : (
                          <input
                            id="ej-duracion"
                            className="input"
                            type="number"
                            min="1"
                            value={duracion}
                            onChange={(e) => setDuracion(e.target.value)}
                            placeholder="30"
                          />
                        )}
                      </div>
                    </div>

                    <div className="field">
                      <label className="ej-form-label" htmlFor="ej-kcal">Kcal manual (opcional)</label>
                      <div className="control">
                        <input
                          id="ej-kcal"
                          className="input"
                          type="number"
                          min="1"
                          step="1"
                          value={caloriasManual}
                          onChange={(e) => setCaloriasManual(e.target.value)}
                          placeholder="Reemplaza el cálculo automático"
                        />
                      </div>
                    </div>

                    {(() => {
                      const m = parseManualCal()
                      const kmP = modoMedida === 'km' && tipoAdmiteKilometros(tipo) && Number(distanciaKm) > 0
                      const minP = modoMedida === 'minutos' && Number(duracion) > 0
                      if (!tipo || (!m && !kmP && !minP)) return null
                      const durEst = kmP ? minutosDesdeKm(tipo, Number(distanciaKm)) : Number(duracion) || 0
                      return (
                        <p className="ej-form-hint mb-3">
                          Aprox. <strong>{caloriasEjercicioRegistro({ tipo, duracion: durEst, caloriasManual: m || undefined }, pesoKg)}</strong> kcal
                          {m ? ' (manual)' : ' según tu peso en Config'}.
                        </p>
                      )
                    })()}

                    <div className="field">
                      <label className="ej-form-label" htmlFor="ej-notas">Notas (opcional)</label>
                      <div className="control">
                        <input
                          id="ej-notas"
                          className="input"
                          type="text"
                          value={notas}
                          onChange={(e) => setNotas(e.target.value)}
                          placeholder="Intensidad, cómo te sentiste..."
                        />
                      </div>
                    </div>

                    <button type="submit" className="button is-link is-fullwidth ej-form-submit">
                      {editandoId ? 'Guardar cambios' : 'Guardar ejercicio'}
                    </button>
                    <button type="button" className="button is-light is-fullwidth mt-2" onClick={cerrarFormulario}>
                      {editandoId ? 'Cancelar edición' : 'Cancelar'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          <aside className="ejercicios-layout-aside">
            <div className="ejercicios-hist-panel">
            <div className="ej-hist-toolbar mb-3">
              <div className="ej-hist-search">
                <span className="ej-hist-search-icon" aria-hidden>🔍</span>
                <input
                  type="text"
                  placeholder="Buscar por nombre, actividad..."
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                />
              </div>
              <button
                type="button"
                className={`ej-hist-filtros-btn${filtrosOpen ? ' is-active' : ''}`}
                onClick={() => setFiltrosOpen((v) => !v)}
              >
                ☰ Filtros
              </button>
            </div>

            {filtrosOpen && (
              <div className="box ej-hist-filtros-panel mb-3 py-3">
                <div className="field mb-2">
                  <label className="ej-form-label">Tipo</label>
                  <div className="select is-fullwidth is-small">
                    <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                      <option value="">Todos los tipos</option>
                      {TIPOS_FLAT.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="columns is-mobile mb-2">
                  <div className="column">
                    <label className="ej-form-label">Desde</label>
                    <input className="input is-small" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
                  </div>
                  <div className="column">
                    <label className="ej-form-label">Hasta</label>
                    <input className="input is-small" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
                  </div>
                </div>
                <button
                  type="button"
                  className="button is-small is-light"
                  onClick={() => { setFiltroTexto(''); setFiltroTipo(''); setFiltroDesde(''); setFiltroHasta('') }}
                >
                  Limpiar filtros
                </button>
              </div>
            )}

            {fechasVisibles.length === 0 ? (
              <div className="box ej-hist-empty has-text-centered py-5">
                <p className="mb-0">Aún no hay ejercicios registrados.</p>
              </div>
            ) : (
              <div className="ej-hist-list">
                {fechasVisibles.map((fecha) => (
                  <section key={fecha} className="ej-hist-dia">
                    <h3 className="ej-hist-dia-titulo">{tituloDiaHistorial(fecha)}</h3>
                    <ul className="ej-hist-items">
                      {porFecha[fecha].map((e) => {
                        const ui = getIconoActividad(e.tipo, e.nombre)
                        const kcal = caloriasEjercicioRegistro(e, pesoKg)
                        return (
                          <li key={e.id} className="ej-hist-item">
                            <span className={`ej-hist-icon ej-hist-icon--${ui.tone}`} aria-hidden>{ui.icon}</span>
                            <div className="ej-hist-body">
                              <strong className="ej-hist-nombre">{e.nombre}</strong>
                              <span className={`ej-hist-cat ej-hist-cat--${ui.tone}`}>{getCategoriaTipo(e.tipo)}</span>
                            </div>
                            <div className="ej-hist-stats">
                              <span>{e.duracion} min</span>
                              <span className="ej-hist-kcal">~{kcal} kcal</span>
                            </div>
                            <div className="ej-hist-actions">
                              <button type="button" className="ej-hist-edit" onClick={() => iniciarEdicion(e)} aria-label="Editar">
                                ✏️
                              </button>
                              <button type="button" className="ej-hist-delete" onClick={() => eliminar(e.id)} aria-label="Eliminar">
                                ×
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {hayMasHistorial && (
              <button type="button" className="ej-hist-more" onClick={() => setHistLimit((n) => n + 10)}>
                Cargar más historial
              </button>
            )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
