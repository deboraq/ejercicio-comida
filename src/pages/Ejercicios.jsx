import { useState, useRef, useEffect } from 'react'
import { useStorage } from '../hooks/useStorage'
import {
  caloriasEjercicioRegistro,
  formatearFecha,
  fechaToISO,
  fechaSoloDia,
  minutosDesdeKm,
  sinAcentos,
  tipoAdmiteKilometros,
  TIPOS_EJERCICIO_AGRUPADOS,
  etiquetaTipo,
} from '../utils/calorias'
import { getUltimosNDias } from '../utils/estadisticas'

const TIPO_DEFAULT = TIPOS_EJERCICIO_AGRUPADOS[0].opciones[0].value
const TIPOS_FLAT = TIPOS_EJERCICIO_AGRUPADOS.flatMap((g) => g.opciones)

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
  const [busquedaTipo, setBusquedaTipo] = useState('')
  const [mostrarDropdownTipo, setMostrarDropdownTipo] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const refTipoDropdown = useRef(null)
  const refPanelFormulario = useRef(null)

  const tipoSeleccionadoLabel = TIPOS_FLAT.find((o) => o.value === tipo)?.label ?? ''
  const tiposFiltrados = busquedaTipo.trim()
    ? TIPOS_FLAT.filter((o) => sinAcentos(o.label).includes(sinAcentos(busquedaTipo)))
    : TIPOS_FLAT

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (refTipoDropdown.current && !refTipoDropdown.current.contains(e.target)) setMostrarDropdownTipo(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!editandoId) return
    const el = refPanelFormulario.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editandoId])

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
    setBusquedaTipo('')
    setMostrarDropdownTipo(false)
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
      const nuevo = {
        id: crypto.randomUUID(),
        ...camposBase,
      }
      if (!kmOk) delete nuevo.distanciaKm
      setEjercicios((prev) => [nuevo, ...prev])
    }
    limpiarFormulario()
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
    setBusquedaTipo('')
    setMostrarDropdownTipo(false)
  }

  const eliminar = (id) => {
    setEditandoId((eid) => (eid === id ? null : eid))
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
    <section className="section py-4">
      <div className="container" style={{ maxWidth: '560px' }}>
        <header className="mb-4">
          <h1 className="title is-5 mb-2">Ejercicios</h1>
          <p className="is-size-7 has-text-grey mb-0">Registra por día. Calorías quemadas son aproximadas según tipo y duración.</p>
        </header>

        <div className="box py-3 mb-4">
          <div className="columns is-mobile mb-0">
            <div className="column">
              <p className="is-size-7 has-text-grey mb-1">Hoy ({hoyIso})</p>
              <p className="mb-0">
                <span className="title is-5 has-text-link">{minutosHoy}</span>
                <span className="is-size-7 has-text-grey ml-1">min</span>
                <span className="ml-2">
                  <span className="title is-5 has-text-success">{caloriasHoy}</span>
                  <span className="is-size-7 has-text-grey ml-1">kcal aprox.</span>
                </span>
              </p>
            </div>
            <div className="column">
              <p className="is-size-7 has-text-grey mb-1">Últimos 7 días</p>
              <p className="mb-0">
                <span className="title is-5 has-text-link">{minutosUltimos7}</span>
                <span className="is-size-7 has-text-grey ml-1">min</span>
                <span className="ml-2">
                  <span className="title is-5 has-text-success">{caloriasUltimos7}</span>
                  <span className="is-size-7 has-text-grey ml-1">kcal aprox.</span>
                </span>
              </p>
            </div>
          </div>
          <p className="is-size-7 has-text-grey mb-0 mt-2">
            Si hoy no registraste nada pero sí otros días, los totales de la semana muestran tu actividad reciente.
          </p>
        </div>

        <div ref={refPanelFormulario} className="box mb-4 py-3" style={{ scrollMarginTop: '0.75rem' }}>
          <h2 className="title is-6 mb-2">{editandoId ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h2>
          <form onSubmit={agregar}>
            <div className="field">
              <label className="label is-size-7">Fecha</label>
              <div className="control">
                <input
                  className="input is-small"
                  type="date"
                  value={fechaInput}
                  onChange={(e) => setFechaInput(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label className="label is-size-7">Nombre</label>
              <div className="control">
                <input
                  className="input is-small"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Correr, Yoga, Pesas..."
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="columns">
              <div className="column">
                <div className="field" ref={refTipoDropdown} style={{ position: 'relative' }}>
                  <label className="label is-size-7">Tipo de actividad</label>
                  <div className="control">
                    <input
                      className="input is-small"
                      type="text"
                      value={mostrarDropdownTipo || busquedaTipo ? busquedaTipo : tipoSeleccionadoLabel}
                      onChange={(e) => {
                        setBusquedaTipo(e.target.value)
                        setMostrarDropdownTipo(true)
                      }}
                      onFocus={() => setMostrarDropdownTipo(true)}
                      placeholder="Buscar tipo (ej. correr, yoga, pesas...)"
                      autoComplete="off"
                    />
                    {mostrarDropdownTipo && (
                      <div className="box p-2 mt-1 dropdown-panel" style={{ maxHeight: '220px', overflowY: 'auto', position: 'absolute', left: 0, right: 0, zIndex: 30, minWidth: '200px' }}>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {tiposFiltrados.length === 0 ? (
                            <li className="is-size-7 has-text-grey">Sin resultados</li>
                          ) : (
                            tiposFiltrados.map((op) => (
                              <li key={op.value}>
                                <button
                                  type="button"
                                  className="button is-fullwidth is-small is-light has-text-left"
                                  onClick={() => {
                                    setTipo(op.value)
                                    if (!tipoAdmiteKilometros(op.value)) setModoMedida('minutos')
                                    setBusquedaTipo('')
                                    setMostrarDropdownTipo(false)
                                  }}
                                >
                                  {op.label}
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="column">
                {tipoAdmiteKilometros(tipo) ? (
                  <div className="field">
                    <label className="label is-size-7">Medida</label>
                    <div className="control">
                      <div className="buttons has-addons are-small">
                        <button
                          type="button"
                          className={`button is-small ${modoMedida === 'minutos' ? 'is-link' : ''}`}
                          onClick={() => setModoMedida('minutos')}
                        >
                          Minutos
                        </button>
                        <button
                          type="button"
                          className={`button is-small ${modoMedida === 'km' ? 'is-link' : ''}`}
                          onClick={() => setModoMedida('km')}
                        >
                          Kilómetros
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="field">
                    <label className="label is-size-7">Duración (min)</label>
                    <div className="control">
                      <input
                        className="input is-small"
                        type="number"
                        min="1"
                        value={duracion}
                        onChange={(e) => setDuracion(e.target.value)}
                        placeholder="30"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            {tipoAdmiteKilometros(tipo) && (
              <div className="field">
                <label className="label is-size-7">{modoMedida === 'km' ? 'Distancia (km)' : 'Duración (min)'}</label>
                <div className="control">
                  {modoMedida === 'km' ? (
                    <input
                      className="input is-small"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={distanciaKm}
                      onChange={(e) => setDistanciaKm(e.target.value)}
                      placeholder="Ej: 5"
                    />
                  ) : (
                    <input
                      className="input is-small"
                      type="number"
                      min="1"
                      value={duracion}
                      onChange={(e) => setDuracion(e.target.value)}
                      placeholder="30"
                    />
                  )}
                </div>
                <p className="is-size-7 has-text-grey mt-1 mb-0">
                  Los km usan la velocidad típica del tipo (ej. correr 10 km/h) para estimar minutos y kcal.
                </p>
              </div>
            )}
            <div className="field">
              <label className="label is-size-7">Kcal manual (opcional)</label>
              <div className="control">
                <input
                  className="input is-small"
                  type="number"
                  min="1"
                  step="1"
                  value={caloriasManual}
                  onChange={(e) => setCaloriasManual(e.target.value)}
                  placeholder="Si lo completás, reemplaza el cálculo automático"
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
                <p className="is-size-7 has-text-grey mb-2">
                  Aprox.{' '}
                  <strong>{caloriasEjercicioRegistro({ tipo, duracion: durEst, caloriasManual: m || undefined }, pesoKg)}</strong> kcal
                  {m ? ' (valor manual)' : ' según tu peso en Config'}.
                </p>
              )
            })()}
            <div className="field">
              <label className="label is-size-7">Notas (opcional)</label>
              <div className="control">
                <input
                  className="input is-small"
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Intensidad, cómo te sentiste..."
                />
              </div>
            </div>
            <div className="field">
              <div className="control">
                <button type="submit" className="button is-link is-fullwidth is-small">
                  {editandoId ? 'Guardar cambios' : 'Guardar ejercicio'}
                </button>
              </div>
            </div>
            {editandoId && (
              <div className="field mb-0">
                <button type="button" className="button is-light is-fullwidth is-small" onClick={limpiarFormulario}>
                  Cancelar edición
                </button>
              </div>
            )}
          </form>
        </div>

        <h2 className="title is-6 mb-2">Historial por día</h2>
        <div className="box mb-4 py-3">
          <p className="is-size-7 has-text-grey mb-2">Filtrar historial</p>
          <div className="columns is-mobile is-multiline is-variable is-1">
            <div className="column is-full">
              <input
                className="input is-small"
                type="text"
                placeholder="Buscar por nombre, notas o tipo..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
              />
            </div>
            <div className="column is-half">
              <div className="select is-small is-fullwidth">
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                  <option value="">Todos los tipos</option>
                  {TIPOS_FLAT.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="column is-half">
              <input
                className="input is-small"
                type="date"
                placeholder="Desde"
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
                title="Desde fecha"
              />
            </div>
            <div className="column is-half">
              <input
                className="input is-small"
                type="date"
                placeholder="Hasta"
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
                title="Hasta fecha"
              />
            </div>
            <div className="column is-half is-flex is-align-items-center">
              <button
                type="button"
                className="button is-small is-light"
                onClick={() => { setFiltroTexto(''); setFiltroTipo(''); setFiltroDesde(''); setFiltroHasta('') }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
          {(filtroTexto || filtroTipo || filtroDesde || filtroHasta) && (
            <p className="is-size-7 has-text-grey mt-2 mb-0">
              {ejerciciosFiltrados.length} resultado{ejerciciosFiltrados.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {Object.keys(porFecha).length === 0 ? (
          <div className="box has-text-centered has-text-grey is-size-7 py-3">
            Aún no hay ejercicios registrados.
          </div>
        ) : (
          <ul className="mb-0" style={{ listStyle: 'none', padding: 0 }}>
            {Object.entries(porFecha)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([fecha, lista]) => {
                const totalCal = lista.reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoKg), 0)
                const totalMin = lista.reduce((s, e) => s + e.duracion, 0)
                return (
                  <li key={fecha} className="mb-4">
                    <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
                      <p className="is-size-7 has-text-grey mb-0" style={{ textTransform: 'capitalize' }}>
                        {formatearFecha(fecha)}
                      </p>
                      <span className="tag is-success is-light is-size-7">
                        {totalCal} kcal · {totalMin} min
                      </span>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {lista.map((e) => (
                        <li key={e.id} className="box py-2 px-3 mb-2 ejercicio-historial-fila">
                          <div className="is-flex is-justify-content-space-between is-align-items-flex-start">
                            <div className="is-flex-wrap-wrap is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                              <strong>{e.nombre}</strong>
                              <span className="tag is-link is-light">{etiquetaTipo(e.tipo)}</span>
                              <span className="is-size-7 ej-hist-duracion">
                                {e.distanciaKm != null && Number(e.distanciaKm) > 0 ? `${e.distanciaKm} km · ` : ''}
                                {e.duracion} min
                              </span>
                              <span className="tag is-success is-light">
                                ~{caloriasEjercicioRegistro(e, pesoKg)} kcal
                                {e.caloriasManual != null && Number(e.caloriasManual) > 0 ? ' (manual)' : ''}
                              </span>
                              {e.notas && (
                                <span className="is-size-7 ej-hist-notas" style={{ width: '100%' }}>
                                  — {e.notas}
                                </span>
                              )}
                            </div>
                            <div className="is-flex is-align-items-flex-start" style={{ gap: '0.25rem' }}>
                              <button
                                type="button"
                                className="button is-small is-text"
                                onClick={() => iniciarEdicion(e)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="button is-small is-text has-text-grey"
                                onClick={() => eliminar(e.id)}
                                aria-label="Eliminar"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
          </ul>
        )}
      </div>
    </section>
  )
}
