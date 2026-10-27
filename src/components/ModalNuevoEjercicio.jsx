import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStorage } from '../hooks/useStorage'
import {
  caloriasEjercicioRegistro,
  fechaSoloDia,
  fechaToISO,
  formatearFecha,
  minutosDesdeKm,
  sinAcentos,
  tipoAdmiteKilometros,
  tipoPrefiereKilometros,
  normalizarTipoCarrera,
  TIPOS_EJERCICIO_AGRUPADOS,
  etiquetaTipo,
} from '../utils/calorias'
import { getIconoActividad } from '../utils/iconosActividad'

const TIPO_DEFAULT = TIPOS_EJERCICIO_AGRUPADOS[0].opciones[0].value

const PRESETS_DEPORTES = [
  { nombre: 'Pádel', tipo: 'padel', duracion: 90 },
  { nombre: 'Fútbol 7 / 11', tipo: 'futbol', duracion: 90 },
  { nombre: 'Trote', tipo: 'trote', duracion: 30 },
  { nombre: 'Correr', tipo: 'correr', duracion: 30 },
  { nombre: 'Caminata activa', tipo: 'caminata_rapida', duracion: 40 },
]

const RAPIDOS_BASE = [
  { nombre: 'Pádel', tipo: 'padel', duracion: 90 },
  { nombre: 'Natación', tipo: 'nadar_moderado', duracion: 40 },
  { nombre: 'Trote', tipo: 'trote', duracion: 30 },
  { nombre: 'Musculación', tipo: 'pesas_general', duracion: 60 },
]

/**
 * Modal de alta/edición de actividad (mismo formulario que Ejercicios + chips rápidos).
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   fechaInicial?: string,
 *   contexto?: 'ejercicios' | 'deportes',
 *   editItem?: object | null,
 *   onVerHistorial?: () => void,
 * }} props
 */
export default function ModalNuevoEjercicio({
  open,
  onClose,
  fechaInicial,
  contexto = 'ejercicios',
  editItem = null,
  onVerHistorial,
}) {
  const [ejercicios, setEjercicios] = useStorage('ejercicios', [])
  const [config] = useStorage('config', { pesoKg: 70 })
  const pesoKg = config?.pesoKg || 70

  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState(TIPO_DEFAULT)
  const [duracion, setDuracion] = useState('')
  const [modoMedida, setModoMedida] = useState('minutos')
  const [distanciaKm, setDistanciaKm] = useState('')
  const [caloriasManual, setCaloriasManual] = useState('')
  const [notas, setNotas] = useState('')
  const [fechaInput, setFechaInput] = useState(() => fechaToISO(new Date()))
  const [editandoId, setEditandoId] = useState(null)
  const [presetActivo, setPresetActivo] = useState(null)
  const extrasDetailsRef = useRef(null)

  const hoy = fechaToISO(new Date())
  const fechaRef = fechaSoloDia(fechaInicial) || fechaSoloDia(fechaInput) || hoy

  const limpiarFormulario = (fecha = fechaInicial || hoy) => {
    setNombre('')
    setTipo(TIPO_DEFAULT)
    setDuracion('')
    setModoMedida('minutos')
    setDistanciaKm('')
    setCaloriasManual('')
    setNotas('')
    setFechaInput(fechaSoloDia(fecha) || hoy)
    setEditandoId(null)
    setPresetActivo(null)
  }

  const cargarItem = (item) => {
    setEditandoId(item.id)
    setNombre(item.nombre || '')
    const t = normalizarTipoCarrera(item.tipo || TIPO_DEFAULT)
    setTipo(t)
    if (item.distanciaKm != null && Number(item.distanciaKm) > 0 && tipoAdmiteKilometros(t)) {
      setModoMedida('km')
      setDistanciaKm(String(item.distanciaKm))
      setDuracion('')
    } else if (tipoPrefiereKilometros(t)) {
      setModoMedida('km')
      setDistanciaKm('')
      setDuracion('')
    } else {
      setModoMedida('minutos')
      setDistanciaKm('')
      setDuracion(item.duracion != null ? String(item.duracion) : '')
    }
    setCaloriasManual(
      item.caloriasManual != null && Number(item.caloriasManual) > 0 ? String(item.caloriasManual) : '',
    )
    setNotas(item.notas || '')
    setFechaInput(fechaSoloDia(item.fecha) || hoy)
    setPresetActivo(null)
  }

  useEffect(() => {
    if (!open) return
    if (editItem?.id) cargarItem(editItem)
    else limpiarFormulario(fechaInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open, editItem?.id, fechaInicial])

  useEffect(() => {
    if (!tipoAdmiteKilometros(tipo) && modoMedida === 'km') setModoMedida('minutos')
  }, [tipo, modoMedida])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (ev) => {
      if (ev.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    if (extrasDetailsRef.current) {
      extrasDetailsRef.current.open = window.matchMedia('(min-width: 769px)').matches
    }
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const chipsRapidos = useMemo(() => {
    const base = contexto === 'deportes' ? PRESETS_DEPORTES : RAPIDOS_BASE
    const frecuentes = {}
    for (const e of ejercicios) {
      const k = sinAcentos((e.nombre || '').trim()) || sinAcentos(etiquetaTipo(e.tipo))
      if (!k) continue
      if (!frecuentes[k]) {
        frecuentes[k] = {
          nombre: e.nombre || etiquetaTipo(e.tipo),
          tipo: e.tipo,
          duracion: Number(e.duracion) || 30,
          count: 0,
        }
      }
      frecuentes[k].count += 1
    }
    const top = Object.values(frecuentes)
      .sort((a, b) => b.count - a.count)
      .slice(0, contexto === 'deportes' ? 2 : 4)

    const out = []
    const seen = new Set()
    const pushUnique = (chip) => {
      const k = sinAcentos((chip.nombre || '').trim())
      const maxChips = contexto === 'deportes' ? 5 : 4
      if (!k || seen.has(k) || out.length >= maxChips) return
      seen.add(k)
      out.push(chip)
    }
    if (contexto === 'deportes') {
      for (const p of PRESETS_DEPORTES) pushUnique(p)
    } else {
      for (const t of top) pushUnique(t)
      for (const r of base) pushUnique(r)
    }
    return out
  }, [ejercicios, contexto])

  const kcalDelDia = useMemo(() => {
    return ejercicios
      .filter((e) => fechaSoloDia(e.fecha) === fechaRef)
      .reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoKg), 0)
  }, [ejercicios, fechaRef, pesoKg])

  const parseManualCal = () => {
    const n = parseFloat(String(caloriasManual).replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }

  const kcalEstimadasPreview = (() => {
    const m = parseManualCal()
    const kmP = modoMedida === 'km' && tipoAdmiteKilometros(tipo) && Number(distanciaKm) > 0
    const minP = modoMedida === 'minutos' && Number(duracion) > 0
    if (!tipo || (!m && !kmP && !minP)) return null
    const durEst = kmP ? minutosDesdeKm(tipo, Number(distanciaKm)) : Number(duracion) || 0
    return caloriasEjercicioRegistro({ tipo, duracion: durEst, caloriasManual: m || undefined }, pesoKg)
  })()

  const aplicarPreset = (p) => {
    setPresetActivo(p)
    setNombre(p.nombre)
    setTipo(p.tipo)
    if (tipoPrefiereKilometros(p.tipo)) {
      setModoMedida('km')
      setDistanciaKm('')
      setDuracion('')
    } else {
      setModoMedida('minutos')
      setDistanciaKm('')
      setDuracion(String(p.duracion))
    }
  }

  const guardarPresetRapido = (p) => {
    const fecha = fechaInput || fechaRef || hoy
    setEjercicios((prev) => [
      {
        id: crypto.randomUUID(),
        nombre: p.nombre,
        tipo: p.tipo,
        duracion: p.duracion,
        notas: '',
        fecha,
      },
      ...prev,
    ])
    onClose()
  }

  const ajustarDuracion = (delta) => {
    const actual = Number(duracion) || 0
    setDuracion(String(Math.max(0, actual + delta)))
  }

  const agregar = (e) => {
    e.preventDefault()
    if (!nombre.trim()) return
    const fecha = fechaInput || fechaRef || hoy
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
        }),
      )
    } else {
      const nuevo = { id: crypto.randomUUID(), ...camposBase }
      if (!kmOk) delete nuevo.distanciaKm
      setEjercicios((prev) => [nuevo, ...prev])
    }
    onClose()
  }

  if (!open || typeof document === 'undefined') return null

  const fechaLabel = fechaRef === hoy ? 'hoy' : formatearFecha(fechaRef).toLowerCase()
  const titulo = editandoId ? 'Editar ejercicio' : 'Nuevo ejercicio'
  const subtitulo =
    contexto === 'deportes' && !editandoId
      ? `Registro de deportes · ${fechaRef === hoy ? 'Hoy' : formatearFecha(fechaRef)}`
      : 'Registra los detalles de tu actividad para el cálculo calórico.'

  const esDeportesCompacto = contexto === 'deportes' && !editandoId

  return createPortal(
    <div
      className={`ej-modal${esDeportesCompacto ? ' ej-modal--deportes-fit' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ej-modal-title"
    >
      <button type="button" className="ej-modal-backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className={`ej-modal-panel${esDeportesCompacto ? ' ej-modal-panel--deportes' : ''}`}>
        <div className="ej-modal-head">
          <div className="ej-modal-head-left">
            <span className="ej-modal-icon" aria-hidden>
              {esDeportesCompacto ? '🎾' : '+'}
            </span>
            <div>
              <h2 id="ej-modal-title" className="ej-modal-title mb-0">
                {titulo}
              </h2>
              <p className="ej-modal-sub mb-0">{subtitulo}</p>
              {esDeportesCompacto ? (
                <p className="ej-modal-deportes-kcal ej-modal-deportes-kcal--inline mb-0">
                  {kcalDelDia > 0
                    ? `${Math.round(kcalDelDia)} kcal de deporte ${fechaLabel}`
                    : `Sin deporte registrado ${fechaLabel}`}
                </p>
              ) : null}
            </div>
          </div>
          <button type="button" className="ej-modal-close" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {esDeportesCompacto ? (
          <p className="ej-modal-deportes-kcal ej-modal-deportes-kcal--block mb-0">
            {kcalDelDia > 0
              ? `${Math.round(kcalDelDia)} kcal de deporte ${fechaLabel}`
              : `Sin deporte registrado ${fechaLabel}`}
          </p>
        ) : null}

        {!editandoId && chipsRapidos.length > 0 ? (
          <>
            <p className="entren-cardio-rapidos-label ej-modal-rapidos-label">Elegí el deporte</p>
            <div className="entren-cardio-rapidos ej-modal-rapidos">
              {chipsRapidos.map((p) => {
                const ui = getIconoActividad(p.tipo, p.nombre)
                const on = presetActivo?.nombre === p.nombre
                return (
                  <button
                    key={`${p.nombre}-${p.tipo}`}
                    type="button"
                    className={`entren-cardio-rapido${on ? ' is-active' : ''}`}
                    onClick={() => aplicarPreset(p)}
                    onDoubleClick={() => guardarPresetRapido(p)}
                    title="Doble clic: guardar con duración habitual"
                  >
                    <span aria-hidden>{ui.icon}</span>
                    {p.nombre}
                  </button>
                )
              })}
            </div>
          </>
        ) : null}

        <form onSubmit={agregar} className="ej-form">
          <div className="ej-form-body">
            <div className={`ej-form-grid${esDeportesCompacto ? ' ej-form-grid--deportes-fit' : ''}`}>
              <div className="ej-form-col">
                <div className="field ej-form-field--fecha">
                  <label className="ej-form-label" htmlFor="ej-fecha-modal">
                    Fecha
                  </label>
                  <div className="control">
                    <input
                      id="ej-fecha-modal"
                      className="input"
                      type="date"
                      value={fechaInput}
                      onChange={(ev) => setFechaInput(ev.target.value)}
                    />
                  </div>
                </div>

                <div className="field ej-form-field--nombre">
                  <label className="ej-form-label" htmlFor="ej-nombre-modal">
                    Nombre del ejercicio
                  </label>
                  <div className="control">
                    <input
                      id="ej-nombre-modal"
                      className="input"
                      type="text"
                      value={nombre}
                      onChange={(ev) => setNombre(ev.target.value)}
                      placeholder="Ej: Padel, Correr, Pesas..."
                      autoComplete="off"
                      autoFocus={!editandoId}
                    />
                  </div>
                  <p className="ej-form-suggest mb-0">Sugerencia rápida: Tenis, Calistenia, Spinning, Boxeo.</p>
                </div>

                <div className="field ej-form-field--tipo">
                  <label className="ej-form-label" htmlFor="ej-tipo-modal">
                    Tipo de actividad
                  </label>
                  <div className="control">
                    <div className="select is-fullwidth">
                      <select
                        id="ej-tipo-modal"
                        value={tipo}
                        onChange={(ev) => {
                          const v = ev.target.value
                          setTipo(v)
                          if (tipoPrefiereKilometros(v)) {
                            setModoMedida('km')
                            setDistanciaKm('')
                          } else if (!tipoAdmiteKilometros(v)) setModoMedida('minutos')
                        }}
                      >
                        {TIPOS_EJERCICIO_AGRUPADOS.map((g) => (
                          <optgroup key={g.categoria} label={g.categoria}>
                            {g.opciones.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ej-form-col">
                {tipoAdmiteKilometros(tipo) && (
                  <div className="field ej-form-field--medida">
                    <label className="ej-form-label">Medida</label>
                    <div className="ti-segmented ej-medida-seg">
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
                )}

                <div className="field ej-form-field--duracion">
                  <label className="ej-form-label" htmlFor="ej-duracion-modal">
                    {tipoAdmiteKilometros(tipo) && modoMedida === 'km' ? 'Distancia (km)' : 'Duración (min)'}
                  </label>
                  {tipoAdmiteKilometros(tipo) && modoMedida === 'km' ? (
                    <div className="control">
                      <input
                        id="ej-duracion-modal"
                        className="input"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={distanciaKm}
                        onChange={(ev) => setDistanciaKm(ev.target.value)}
                        placeholder="Ej: 5"
                      />
                    </div>
                  ) : (
                    <div className="ej-duracion-stepper">
                      <input
                        id="ej-duracion-modal"
                        className="input"
                        type="number"
                        min="1"
                        value={duracion}
                        onChange={(ev) => setDuracion(ev.target.value)}
                        placeholder="30"
                      />
                      <button type="button" className="ej-step-btn" onClick={() => ajustarDuracion(-15)} aria-label="Restar 15 min">
                        −
                      </button>
                      <button type="button" className="ej-step-btn" onClick={() => ajustarDuracion(15)} aria-label="Sumar 15 min">
                        +
                      </button>
                    </div>
                  )}
                </div>

                <details ref={extrasDetailsRef} className="ej-form-details ej-form-field--extras">
                  <summary className="ej-form-details-summary">Kcal y notas (opcional)</summary>
                  <div className="ej-form-details-body">
                    <div className="field">
                      <div className="ej-kcal-label-row">
                        <label className="ej-form-label mb-0" htmlFor="ej-kcal-modal">
                          Kcal manual
                        </label>
                        {kcalEstimadasPreview != null && (
                          <span className="ej-kcal-badge">~{kcalEstimadasPreview} kcal estimadas</span>
                        )}
                      </div>
                      <div className="control">
                        <input
                          id="ej-kcal-modal"
                          className="input"
                          type="number"
                          min="1"
                          step="1"
                          value={caloriasManual}
                          onChange={(ev) => setCaloriasManual(ev.target.value)}
                          placeholder="Reemplaza el cálculo automático"
                        />
                      </div>
                    </div>
                    <div className="field ej-form-notas mb-0">
                      <label className="ej-form-label" htmlFor="ej-notas-modal">
                        Notas
                      </label>
                      <div className="control">
                        <textarea
                          id="ej-notas-modal"
                          className="textarea"
                          rows={2}
                          value={notas}
                          onChange={(ev) => setNotas(ev.target.value)}
                          placeholder="Intensidad, cómo te sentiste, sets..."
                        />
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>

          <div className="ej-form-actions">
            <button type="submit" className="button is-link ej-form-submit">
              ✓ {editandoId ? 'Guardar cambios' : 'Guardar ejercicio'}
            </button>
            <button type="button" className="button is-light ej-form-cancel" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>

        {contexto === 'deportes' && onVerHistorial && !editandoId ? (
          <p className="entren-cardio-modal-foot mb-0">
            <button type="button" className="entren-cardio-ver-mas" onClick={onVerHistorial}>
              Ver historial
            </button>
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
