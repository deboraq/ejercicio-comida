import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useStorage } from '../../hooks/useStorage'
import { exportarRutinaAJson } from '../../utils/rutinaShare'
import { createRoutineAssignment } from '../../lib/profeDb'
import { nombreDeEjercicioDiaItem, itemEjercicioDiaNormalizado } from '../../utils/rutinaEjercicioDia'

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function emptyDia(i) {
  return { id: newId('pd'), nombre: `Día ${i}`, ejercicios: [] }
}

function emptyPlantilla() {
  return { id: newId('pt'), nombre: 'Nueva plantilla', dias: [emptyDia(1)], soloStudentId: null }
}

function plantillaCoincideBusqueda(p, students, q) {
  if (!q) return true
  const n = (p.nombre || '').toLowerCase()
  if (n.includes(q)) return true
  if (p.soloStudentId) {
    const st = students.find((s) => s.studentId === p.soloStudentId)
    const blob = `${st?.fullName || ''} ${st?.email || ''}`.toLowerCase()
    if (blob.includes(q)) return true
  }
  for (const d of p.dias || []) {
    if (String(d.nombre || '').toLowerCase().includes(q)) return true
    for (const ex of d.ejercicios || []) {
      if (nombreDeEjercicioDiaItem(ex).toLowerCase().includes(q)) return true
    }
  }
  return false
}

function etiquetaAlumnoOpcionEnvio(s) {
  const name = String(s.fullName || '').trim()
  const mail = String(s.email || '').trim()
  if (name && mail) return `${name} · ${mail}`
  return name || mail || 'Sin datos'
}

function puedeRecibirPlantilla(plantilla, studentId) {
  if (!plantilla?.soloStudentId) return true
  return plantilla.soloStudentId === studentId
}

function plantillasNecesitanMigracion(arr) {
  for (const p of arr || []) {
    for (const d of p.dias || []) {
      for (const e of d.ejercicios || []) {
        if (typeof e === 'string') return true
      }
    }
  }
  return false
}

const rutWorkshopCaja = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.14)',
}

const rutListadoFila = {
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.2)',
  padding: '0.85rem 1rem',
}

function normalizarEjerciciosDia(list) {
  return (list || [])
    .map((e) => {
      if (typeof e === 'string') {
        const n = e.trim()
        return n ? { nombre: n, series: '', repeticiones: '' } : null
      }
      if (e && typeof e === 'object' && e.nombre != null) {
        const nombre = String(e.nombre).trim()
        if (!nombre) return null
        return {
          nombre,
          series: e.series != null ? String(e.series) : '',
          repeticiones: e.repeticiones != null ? String(e.repeticiones) : '',
        }
      }
      return null
    })
    .filter(Boolean)
}

/** Plantilla recién creada sin contenido útil: se puede descartar al cerrar el editor. */
function plantillaEsBorradorVacio(p) {
  if (!p) return false
  const nom = String(p.nombre || '').trim()
  if (nom !== '' && nom !== 'Nueva plantilla') return false
  if (p.soloStudentId) return false
  const dias = Array.isArray(p.dias) ? p.dias : []
  if (dias.length !== 1) return false
  const d0 = dias[0]
  if (String(d0?.nombre || '').trim() !== 'Día 1') return false
  const ej = normalizarEjerciciosDia(d0?.ejercicios || [])
  return ej.length === 0
}

function CatalogoEjercicioSelect({ ejercicios, sinCatalogo, onElegir }) {
  const [valor, setValor] = useState('')
  if (sinCatalogo) {
    return (
      <p className="is-size-7 has-text-grey mb-2">
        Cargá ejercicios en la pestaña <strong>Ejercicios</strong> para poder armar el día.
      </p>
    )
  }
  return (
    <div className="field mb-0">
      <label className="label is-size-7 mb-1">Sumar uno del catálogo</label>
      <p className="is-size-7 has-text-grey mb-2" style={{ lineHeight: 1.4 }}>
        Elegí un nombre: se agrega al final de la lista de este día.
      </p>
      <div className="select is-small is-fullwidth">
        <select
          value={valor}
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            const item = ejercicios.find((x) => x.id === id)
            if (item) onElegir(item)
            setValor('')
          }}
        >
          <option value="">Elegí un ejercicio…</option>
          {ejercicios.map((c) => (
            <option key={c.id} value={c.id}>
              {String(c.nombre || '').trim() || '(sin nombre)'}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default function ProfeRutinasWorkshop({ students, teacherId, busqueda = '', onToast, onEnviado }) {
  const [plantillas, setPlantillas] = useStorage('profePlantillasRutina', [])
  const [catalogo] = useStorage('profeCatalogoEjercicios', [])
  const listP = Array.isArray(plantillas) ? plantillas : []
  const listC = Array.isArray(catalogo) ? catalogo.filter((c) => String(c.nombre || '').trim()) : []
  const listCOrdenado = useMemo(
    () =>
      [...listC].sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), undefined, { sensitivity: 'base' })
      ),
    [listC]
  )

  const [selectedId, setSelectedId] = useState('')
  const [picker, setPicker] = useState(null)
  const [editorPlantillaAbierto, setEditorPlantillaAbierto] = useState(false)
  const [modoEditor, setModoEditor] = useState('editar')
  const idBorradorNuevaRef = useRef(null)
  const [modalEnviar, setModalEnviar] = useState(null)
  const [qModalEnviar, setQModalEnviar] = useState('')
  const [enviandoModal, setEnviandoModal] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)

  const qBusq = (busqueda || '').trim().toLowerCase()
  const plantillasFiltradas = useMemo(
    () => listP.filter((p) => plantillaCoincideBusqueda(p, students, qBusq)),
    [listP, students, qBusq]
  )

  const qModalTrim = (qModalEnviar || '').trim().toLowerCase()
  const alumnosModalFiltrados = useMemo(() => {
    if (!modalEnviar) return []
    const p = listP.find((x) => x.id === modalEnviar.plantillaId)
    const base = students.filter((s) => p && puedeRecibirPlantilla(p, s.studentId))
    if (!qModalTrim) return base
    return base.filter((s) => {
      const fn = (s.fullName || '').toLowerCase()
      const em = (s.email || '').toLowerCase()
      return fn.includes(qModalTrim) || em.includes(qModalTrim)
    })
  }, [modalEnviar, students, listP, qModalTrim])

  const plantilla = listP.find((p) => p.id === selectedId)

  useEffect(() => {
    setPlantillas((prev) => {
      const arr = Array.isArray(prev) ? prev : []
      if (!plantillasNecesitanMigracion(arr)) return prev
      return arr.map((p) => ({
        ...p,
        dias: (p.dias || []).map((d) => ({
          ...d,
          ejercicios: normalizarEjerciciosDia(d.ejercicios),
        })),
      }))
    })
  }, [setPlantillas])

  useEffect(() => {
    if (!editorPlantillaAbierto) return
    if (!listP.length) {
      idBorradorNuevaRef.current = null
      setSelectedId('')
      setEditorPlantillaAbierto(false)
      return
    }
    const visibles = plantillasFiltradas.length ? plantillasFiltradas : listP
    if (selectedId && !visibles.some((p) => p.id === selectedId)) {
      setSelectedId(visibles[0].id)
    } else if (!selectedId) {
      setSelectedId(visibles[0].id)
    }
  }, [editorPlantillaAbierto, listP, plantillasFiltradas, selectedId])

  useEffect(() => {
    if (!editorPlantillaAbierto || !idBorradorNuevaRef.current) return
    if (selectedId !== idBorradorNuevaRef.current) setModoEditor('editar')
  }, [selectedId, editorPlantillaAbierto])

  useEffect(() => {
    if (!editorPlantillaAbierto) setEditorDirty(false)
  }, [editorPlantillaAbierto])

  const agregarPlantilla = () => {
    const n = emptyPlantilla()
    idBorradorNuevaRef.current = n.id
    setModoEditor('nueva')
    setPlantillas((prev) => [...(Array.isArray(prev) ? prev : []), n])
    setSelectedId(n.id)
    setEditorPlantillaAbierto(true)
  }

  const abrirEditorPlantilla = (id) => {
    idBorradorNuevaRef.current = null
    setModoEditor('editar')
    setSelectedId(id)
    setEditorPlantillaAbierto(true)
  }

  const cerrarEditorPlantilla = () => {
    const cur = listP.find((x) => x.id === selectedId)
    if (cur && plantillaEsBorradorVacio(cur)) {
      const next = listP.filter((x) => x.id !== selectedId)
      setPlantillas(next)
      setSelectedId(next[0]?.id ?? '')
      onToast?.({ msg: 'Borrador vacío descartado.' })
    }
    idBorradorNuevaRef.current = null
    setEditorPlantillaAbierto(false)
  }

  const eliminarRutinaPorId = (id) => {
    const p = listP.find((x) => x.id === id)
    if (!p || !window.confirm(`¿Eliminar la rutina «${p.nombre || 'Sin nombre'}»? Esta acción no se puede deshacer.`)) {
      return
    }
    setPlantillas((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== id) : []))
    if (selectedId === id) {
      if (idBorradorNuevaRef.current === id) idBorradorNuevaRef.current = null
      setEditorPlantillaAbierto(false)
      setSelectedId('')
    }
  }

  const updatePlantilla = useCallback(
    (id, fn) => {
      setPlantillas((prev) =>
        (Array.isArray(prev) ? prev : []).map((p) => (p.id === id ? fn({ ...p }) : p))
      )
      if (editorPlantillaAbierto) setEditorDirty(true)
    },
    [setPlantillas, editorPlantillaAbierto]
  )

  const guardarEditor = useCallback(() => {
    if (!editorDirty) return
    setPlantillas((prev) => {
      try {
        return JSON.parse(JSON.stringify(Array.isArray(prev) ? prev : []))
      } catch {
        return Array.isArray(prev) ? [...prev] : []
      }
    })
    setEditorDirty(false)
    onToast?.({
      msg: 'Rutina guardada en este dispositivo y en tu cuenta (si iniciaste sesión).',
    })
  }, [editorDirty, setPlantillas, onToast])

  const abrirPicker = (dayIndex) => {
    if (!plantilla) return
    setPicker({ dayIndex, selectedIds: new Set() })
  }

  const aplicarPicker = () => {
    if (!picker || !plantilla) return
    const dayIndex = picker.dayIndex
    const dia = plantilla.dias[dayIndex]
    const actuales = normalizarEjerciciosDia(dia?.ejercicios)

    const agregar = listCOrdenado
      .filter((c) => picker.selectedIds.has(c.id))
      .map((c) => ({
        nombre: String(c.nombre || '').trim(),
        series: '',
        repeticiones: '',
      }))
      .filter((x) => x.nombre)

    updatePlantilla(plantilla.id, (p) => {
      const dias = [...(p.dias || [])]
      dias[dayIndex] = { ...dias[dayIndex], ejercicios: [...actuales, ...agregar] }
      return { ...p, dias }
    })
    setPicker(null)
  }

  const agregarDesdeCatalogo = (dayIndex, itemCatalogo) => {
    const nombre = String(itemCatalogo?.nombre || '').trim()
    if (!plantilla || !nombre) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[dayIndex] }
      d.ejercicios = [...(d.ejercicios || []), { nombre, series: '', repeticiones: '' }]
      dias[dayIndex] = d
      return { ...p, dias }
    })
  }

  const quitarEjercicioLinea = (dayIndex, ei) => {
    if (!plantilla) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[dayIndex] }
      d.ejercicios = (d.ejercicios || []).filter((_, j) => j !== ei)
      dias[dayIndex] = d
      return { ...p, dias }
    })
  }

  const reordenarEjercicioDia = (dayIndex, desde, hasta) => {
    if (!plantilla || desde === hasta) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[dayIndex] }
      const ej = [...(d.ejercicios || [])]
      if (desde < 0 || hasta < 0 || desde >= ej.length || hasta >= ej.length) return p
      const [item] = ej.splice(desde, 1)
      ej.splice(hasta, 0, item)
      d.ejercicios = ej
      dias[dayIndex] = d
      return { ...p, dias }
    })
  }

  const patchEjercicioCampo = (dayIndex, ei, campo, valor) => {
    if (!plantilla) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[dayIndex] }
      const ej = [...(d.ejercicios || [])]
      const prev = itemEjercicioDiaNormalizado(ej[ei]) || { nombre: '', series: '', repeticiones: '' }
      ej[ei] = { ...prev, [campo]: valor }
      d.ejercicios = ej
      dias[dayIndex] = d
      return { ...p, dias }
    })
  }

  const agregarDia = () => {
    if (!plantilla) return
    updatePlantilla(plantilla.id, (p) => ({
      ...p,
      dias: [...(p.dias || []), emptyDia((p.dias || []).length + 1)],
    }))
  }

  const quitarDia = (idx) => {
    if (!plantilla || (plantilla.dias || []).length <= 1) return
    updatePlantilla(plantilla.id, (p) => ({
      ...p,
      dias: (p.dias || []).filter((_, i) => i !== idx),
    }))
  }

  const abrirModalEnviar = (plantillaId) => {
    if (!teacherId) {
      onToast({ err: 'No hay sesión de entrenador.' })
      return
    }
    const p = listP.find((x) => x.id === plantillaId)
    if (!p) return
    if (!students.length) {
      onToast({ err: 'Vinculá alumnos en la pestaña Alumnos.' })
      return
    }
    const compatibles = students.filter((s) => puedeRecibirPlantilla(p, s.studentId))
    if (!compatibles.length) {
      onToast({
        err: 'Ningún alumno vinculado puede recibir esta plantilla (está marcada solo para otro alumno).',
      })
      return
    }
    setQModalEnviar('')
    setModalEnviar({
      plantillaId,
      seleccion: new Set(compatibles.map((s) => s.studentId)),
    })
  }

  const toggleSeleccionModal = (studentId) => {
    setModalEnviar((prev) => {
      if (!prev) return prev
      const p = listP.find((x) => x.id === prev.plantillaId)
      if (!p || !puedeRecibirPlantilla(p, studentId)) return prev
      const s = new Set(prev.seleccion)
      if (s.has(studentId)) s.delete(studentId)
      else s.add(studentId)
      return { ...prev, seleccion: s }
    })
  }

  const confirmarEnviarModal = async () => {
    if (!modalEnviar || !teacherId) return
    const p = listP.find((x) => x.id === modalEnviar.plantillaId)
    if (!p) {
      setModalEnviar(null)
      return
    }
    const ids = [...modalEnviar.seleccion].filter((sid) => puedeRecibirPlantilla(p, sid))
    if (!ids.length) {
      onToast({ err: 'Elegí al menos un alumno.' })
      return
    }
    setEnviandoModal(true)
    let ok = 0
    let fail = 0
    let lastErr = ''
    try {
      const obj = JSON.parse(exportarRutinaAJson({ nombre: p.nombre, dias: p.dias }))
      const dias = Array.isArray(obj.dias) ? obj.dias : []
      for (const studentId of ids) {
        const { error } = await createRoutineAssignment(teacherId, studentId, p.nombre || 'Rutina', { dias })
        if (error) {
          fail += 1
          lastErr = error.message || ''
        } else ok += 1
      }
    } catch (e) {
      onToast({ err: e?.message || 'Error al preparar la rutina.' })
      setEnviandoModal(false)
      return
    }
    setEnviandoModal(false)
    setModalEnviar(null)
    if (ok && !fail) {
      onToast({
        msg:
          ok === 1
            ? `Rutina «${p.nombre}» enviada. El alumno la ve en Rutina → Asignadas.`
            : `Rutina «${p.nombre}» enviada a ${ok} alumnos. La ven en Rutina → Asignadas.`,
      })
      onEnviado?.()
    } else if (ok && fail) {
      onToast({
        msg: `Enviada a ${ok} alumno${ok === 1 ? '' : 's'}.`,
        err: `Falló ${fail} envío${fail === 1 ? '' : 's'}${lastErr ? `: ${lastErr}` : '.'}`,
      })
      onEnviado?.()
    } else {
      onToast({ err: lastErr || 'No se pudo enviar.' })
    }
  }

  const listaRutinasListado = plantillasFiltradas.length ? plantillasFiltradas : listP
  const plantillaModal = modalEnviar ? listP.find((x) => x.id === modalEnviar.plantillaId) : null
  const nSeleccionModal = modalEnviar?.seleccion?.size ?? 0

  return (
    <>
      <div className="box mb-4 py-4 px-4" style={rutWorkshopCaja}>
        <h2 className="title is-6 mb-2">Plantillas de rutina</h2>
        <p className="is-size-7 has-text-grey mb-4" style={{ lineHeight: 1.5 }}>
          Armás cada día con filas (ejercicio, series y repeticiones). Podés marcar una plantilla{' '}
          <strong>solo para un alumno</strong> (personalizada); el resto sirven para cualquiera. Desde el listado usá{' '}
          <strong>Enviar</strong> para mandarla a uno o varios alumnos a la vez.
        </p>

        {!editorPlantillaAbierto && (
          <>
            <div className="is-flex is-flex-wrap-wrap is-justify-content-flex-start is-align-items-center mb-3" style={{ gap: '0.5rem' }}>
              <button type="button" className="button is-link is-small" onClick={agregarPlantilla}>
                + Nueva rutina
              </button>
            </div>
            {!listP.length ? (
              <p className="is-size-7 has-text-grey mb-0">Tocá «Nueva rutina» para crear la primera y editarla.</p>
            ) : (
              <ul className="mb-0" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {listaRutinasListado.map((p) => (
                  <li
                    key={p.id}
                    className="is-flex is-justify-content-space-between is-align-items-center is-flex-wrap-wrap"
                    style={{
                      ...rutListadoFila,
                      gap: '0.65rem',
                    }}
                  >
                    <span className="is-size-7" style={{ wordBreak: 'break-word', flex: '1 1 12rem', minWidth: 0 }}>
                      <strong>{p.nombre || 'Sin nombre'}</strong>
                      {p.soloStudentId ? (
                        <span className="has-text-grey"> · solo un alumno</span>
                      ) : null}
                    </span>
                    <div className="is-flex is-align-items-center" style={{ gap: '0.4rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="button is-small is-link is-light"
                        onClick={() => abrirEditorPlantilla(p.id)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button is-small is-info is-light"
                        onClick={() => abrirModalEnviar(p.id)}
                      >
                        Enviar
                      </button>
                      <button
                        type="button"
                        className="button is-small is-danger is-light"
                        onClick={() => eliminarRutinaPorId(p.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {plantillasFiltradas.length === 0 && qBusq && listP.length > 0 ? (
              <p className="is-size-7 has-text-grey mt-2 mb-0">Ninguna plantilla coincide con la búsqueda.</p>
            ) : null}
          </>
        )}

        {editorPlantillaAbierto && plantilla && (
          <>
            <p className="title is-6 mb-1">{modoEditor === 'nueva' ? 'Nueva plantilla' : 'Editar plantilla'}</p>
            <p className="is-size-7 has-text-grey mb-3" style={{ lineHeight: 1.45 }}>
              {modoEditor === 'nueva' ? (
                <>
                  Si todavía no sumaste ejercicios ni cambiaste el nombre ni el día, al volver{' '}
                  <strong>descartamos</strong> esta plantilla vacía. Cada cambio se va guardando en el dispositivo; tocá{' '}
                  <strong>Guardar</strong> para confirmar y sincronizar otra vez con tu cuenta (si hay sesión).
                </>
              ) : (
                <>
                  Los cambios se van guardando mientras editás. Tocá <strong>Guardar</strong> cuando quieras dejar
                  constancia o forzar la sincronización con tu cuenta. <strong>Volver al listado</strong> solo cierra
                  el editor (no perdés lo ya cargado).
                </>
              )}
            </p>
            <div className="mb-4">
              <div
                className="is-flex is-flex-wrap-wrap is-align-items-center mb-2"
                style={{ gap: '0.5rem', justifyContent: 'space-between' }}
              >
                <button type="button" className="button is-small is-link" onClick={cerrarEditorPlantilla}>
                  ← Volver al listado
                </button>
                <div className="is-flex is-flex-wrap-wrap is-align-items-center" style={{ gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`button is-small ${editorDirty ? 'is-primary' : 'is-light'}`}
                    disabled={!editorDirty}
                    onClick={guardarEditor}
                    title={
                      editorDirty
                        ? 'Confirmar y volver a guardar la rutina'
                        : 'No hay cambios nuevos desde el último Guardar'
                    }
                  >
                    Guardar
                  </button>
                  {!editorDirty ? (
                    <span className="is-size-7 has-text-grey">Sin cambios nuevos</span>
                  ) : null}
                </div>
              </div>
              {editorDirty ? (
                <div
                  className="py-2 px-3"
                  style={{
                    borderRadius: 8,
                    border: '1px solid rgba(255, 183, 77, 0.45)',
                    background: 'rgba(255, 183, 77, 0.12)',
                  }}
                >
                  <p className="is-size-7 mb-0" style={{ lineHeight: 1.45 }}>
                    <strong>Cambios nuevos.</strong> Tocá <strong>Guardar</strong> arriba para confirmarlos y volver a
                    sincronizar con tu cuenta.
                  </p>
                </div>
              ) : null}
            </div>

            {(() => {
              if (modoEditor === 'nueva') return null
              const opcionesEdicion = plantillasFiltradas.length ? plantillasFiltradas : listP
              if (opcionesEdicion.length > 1) {
                return (
                  <div className="field mb-3">
                    <label className="label is-size-7 mb-1">Rutina a editar</label>
                    <div className="control">
                      {plantillasFiltradas.length === 0 && qBusq ? (
                        <p className="is-size-7 has-text-grey mb-0">Ninguna plantilla coincide con la búsqueda.</p>
                      ) : (
                        <div className="select is-small is-fullwidth">
                          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                            {opcionesEdicion.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre || 'Sin nombre'}
                                {p.soloStudentId ? ' (solo un alumno)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              if (plantillasFiltradas.length === 0 && qBusq && listP.length > 0) {
                return (
                  <p className="is-size-7 has-text-grey mb-3">Ninguna plantilla coincide con la búsqueda.</p>
                )
              }
              return null
            })()}

                <div
                  className="mb-4 p-3"
                  style={{
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.18)',
                  }}
                >
                  <p className="is-size-7 has-text-weight-semibold mb-3">1 · Datos de la plantilla</p>
                  <div className="field mb-3">
                    <label className="label is-size-7 mb-1">Nombre de la rutina</label>
                    <input
                      className="input is-small"
                      value={plantilla.nombre}
                      onChange={(e) => updatePlantilla(plantilla.id, (p) => ({ ...p, nombre: e.target.value }))}
                      placeholder="Ej. Fuerza 3 días, Full body casa"
                    />
                  </div>
                  <div className="field mb-0">
                    <label className="label is-size-7 mb-1">¿Solo para un alumno? (opcional)</label>
                    <div className="select is-small is-fullwidth">
                      <select
                        value={plantilla.soloStudentId || ''}
                        onChange={(e) =>
                          updatePlantilla(plantilla.id, (p) => ({
                            ...p,
                            soloStudentId: e.target.value || null,
                          }))
                        }
                      >
                        <option value="">No — cualquier alumno vinculado</option>
                        {students.map((s) => (
                          <option key={s.studentId} value={s.studentId}>
                            Sí — {s.fullName || s.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div
                  className="mb-4 p-3"
                  style={{
                    borderRadius: 10,
                    border: '1px solid rgba(72, 199, 142, 0.35)',
                    background: 'rgba(72, 199, 142, 0.06)',
                  }}
                >
                  <div
                    className="is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap"
                    style={{ gap: '0.75rem' }}
                  >
                    <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                      <p className="is-size-7 has-text-weight-semibold mb-1">2 · Días de entrenamiento</p>
                      <p className="is-size-7 has-text-grey mb-0" style={{ lineHeight: 1.45 }}>
                        Cada bloque abajo es un día. Sumá ejercicios dentro del día; si necesitás otro día de la
                        semana, tocá <strong>Agregar día</strong>.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button is-small is-success"
                      onClick={agregarDia}
                      style={{ flexShrink: 0 }}
                    >
                      + Agregar día
                    </button>
                  </div>
                </div>

                {(plantilla.dias || []).map((d, idx) => {
                  const filas = normalizarEjerciciosDia(d.ejercicios)
                  const nDias = (plantilla.dias || []).length
                  return (
                    <div
                      key={d.id || idx}
                      className="mb-4 p-4"
                      style={{
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(0,0,0,0.24)',
                      }}
                    >
                      <div
                        className="is-flex is-justify-content-space-between is-align-items-center is-flex-wrap-wrap mb-3"
                        style={{ gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}
                      >
                        <span className="tag is-info is-light is-size-7 mb-0">
                          Día {idx + 1} de {nDias}
                        </span>
                        {nDias > 1 ? (
                          <button type="button" className="button is-small is-light" onClick={() => quitarDia(idx)}>
                            Quitar este día
                          </button>
                        ) : null}
                      </div>

                      <div className="field mb-3">
                        <label className="label is-size-7 mb-1">Nombre de este día</label>
                        <input
                          className="input is-small"
                          value={d.nombre}
                          onChange={(e) =>
                            updatePlantilla(plantilla.id, (p) => {
                              const dias = [...(p.dias || [])]
                              dias[idx] = { ...dias[idx], nombre: e.target.value }
                              return { ...p, dias }
                            })
                          }
                          placeholder="Ej. Tren superior, Piernas y glúteos, Cardio"
                        />
                      </div>

                      <div
                        className="p-3 mb-3"
                        style={{
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(255,255,255,0.04)',
                        }}
                      >
                        <p className="is-size-7 has-text-weight-semibold mb-2">Sumar ejercicios a este día</p>
                        <div className="columns is-mobile is-multiline mb-0" style={{ marginBottom: 0 }}>
                          <div className="column is-12-mobile is-7-tablet pb-2 pt-0">
                            <CatalogoEjercicioSelect
                              ejercicios={listCOrdenado}
                              sinCatalogo={listC.length === 0}
                              onElegir={(item) => agregarDesdeCatalogo(idx, item)}
                            />
                          </div>
                          <div className="column is-12-mobile is-5-tablet is-flex is-align-items-flex-end pb-2 pt-0">
                            <button
                              type="button"
                              className="button is-small is-info is-light is-fullwidth"
                              onClick={() => abrirPicker(idx)}
                              disabled={!listC.length}
                              title="Abrí una lista con tilde para sumar muchos de una vez"
                            >
                              Varios del catálogo…
                            </button>
                          </div>
                        </div>
                      </div>

                      <p className="is-size-7 has-text-weight-semibold mb-1">
                        Lista de ejercicios ({filas.length})
                      </p>
                      <p className="is-size-7 has-text-grey mb-2" style={{ lineHeight: 1.45 }}>
                        Reordená las filas arrastrando el icono ⋮⋮ a la izquierda de cada ejercicio.
                      </p>
                      {filas.length === 0 ? (
                        <p className="is-size-7 has-text-grey mb-0">
                          Todavía no hay filas. Usá el desplegable de arriba o <strong>Varios del catálogo</strong> para
                          cargar el día más rápido.
                        </p>
                      ) : (
                        <ul className="mb-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {filas.map((row, ei) => {
                            const payload = JSON.stringify({ dayIndex: idx, ei })
                            return (
                              <li
                                key={`${d.id || `dia-${idx}`}-ex-${ei}`}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('application/x-rutina-ej', payload)
                                  e.dataTransfer.setData('text/plain', payload)
                                  e.dataTransfer.effectAllowed = 'move'
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault()
                                  e.dataTransfer.dropEffect = 'move'
                                }}
                                onDrop={(e) => {
                                  e.preventDefault()
                                  let data
                                  try {
                                    data = JSON.parse(e.dataTransfer.getData('application/x-rutina-ej') || '{}')
                                  } catch {
                                    return
                                  }
                                  if (data.dayIndex !== idx || typeof data.ei !== 'number') return
                                  reordenarEjercicioDia(idx, data.ei, ei)
                                }}
                                className="box py-2 px-3 mb-2"
                                style={{ background: 'rgba(255,255,255,0.05)', touchAction: 'none' }}
                              >
                                <div className="columns is-mobile is-multiline mb-0 is-vcentered">
                                  <div
                                    className="column is-narrow pb-0 pt-0"
                                    title="Arrastrá desde acá para reordenar"
                                    style={{ cursor: 'grab', userSelect: 'none', color: 'rgba(255,255,255,0.35)' }}
                                  >
                                    <span className="is-size-5" aria-hidden>
                                      ⠿
                                    </span>
                                  </div>
                                  <div className="column is-12-mobile is-4-tablet pb-1">
                                    <label className="label is-size-7 mb-1">Ejercicio</label>
                                    <input
                                      className="input is-small"
                                      value={row.nombre}
                                      onChange={(e) => patchEjercicioCampo(idx, ei, 'nombre', e.target.value)}
                                      placeholder="Nombre"
                                    />
                                  </div>
                                  <div className="column is-narrow pb-1">
                                    <label className="label is-size-7 mb-1">Series</label>
                                    <input
                                      className="input is-small"
                                      type="text"
                                      inputMode="numeric"
                                      value={row.series}
                                      onChange={(e) => patchEjercicioCampo(idx, ei, 'series', e.target.value)}
                                      placeholder="ej. 4"
                                      style={{ width: '4.25rem' }}
                                    />
                                  </div>
                                  <div className="column pb-1">
                                    <label className="label is-size-7 mb-1">Repeticiones</label>
                                    <input
                                      className="input is-small"
                                      value={row.repeticiones}
                                      onChange={(e) => patchEjercicioCampo(idx, ei, 'repeticiones', e.target.value)}
                                      placeholder='ej. 10, 8+8, 30"'
                                    />
                                  </div>
                                  <div className="column is-narrow is-flex is-align-items-flex-end pb-1">
                                    <button
                                      type="button"
                                      className="button is-small is-danger is-light"
                                      onClick={() => quitarEjercicioLinea(idx, ei)}
                                      aria-label="Quitar ejercicio"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )
                })}

            <p className="is-size-7 has-text-grey mb-0 mt-2" style={{ lineHeight: 1.45 }}>
              ¿Falta un día más en la rutina? Usá <strong>+ Agregar día</strong> en el recuadro verde de arriba.
            </p>
          </>
        )}
      </div>

      {picker && (
        <div className="modal is-active">
          <button type="button" className="modal-background" aria-label="Cerrar" onClick={() => setPicker(null)} />
          <div className="modal-card" style={{ maxWidth: '420px' }}>
            <header className="modal-card-head py-3">
              <p className="modal-card-title is-size-6">Varios del catálogo</p>
              <button type="button" className="delete" aria-label="Cerrar" onClick={() => setPicker(null)} />
            </header>
            <section className="modal-card-body py-3">
              <p className="is-size-7 has-text-grey mb-3">
                Marcá los que querés sumar: se agregan al <strong>final</strong> del día, en el mismo orden que en tu
                catálogo. Después podés editar series y repeticiones en la lista.
              </p>
              <ul className="mb-0" style={{ listStyle: 'none', padding: 0 }}>
                {listCOrdenado.map((c) => {
                  const n = String(c.nombre).trim()
                  const on = picker.selectedIds.has(c.id)
                  return (
                    <li key={c.id} className="mb-2">
                      <label className="checkbox is-size-7">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            setPicker((prev) => {
                              const s = new Set(prev.selectedIds)
                              if (s.has(c.id)) s.delete(c.id)
                              else s.add(c.id)
                              return { ...prev, selectedIds: s }
                            })
                          }}
                        />
                        {` ${n}`}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </section>
            <footer className="modal-card-foot py-3" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="button is-small is-light" onClick={() => setPicker(null)}>
                Cancelar
              </button>
              <button type="button" className="button is-small is-link" onClick={aplicarPicker}>
                Sumar al día
              </button>
            </footer>
          </div>
        </div>
      )}

      {modalEnviar && (
        <div className="modal is-active">
          <button
            type="button"
            className="modal-background"
            aria-label="Cerrar"
            disabled={enviandoModal}
            onClick={() => !enviandoModal && setModalEnviar(null)}
          />
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <header className="modal-card-head py-3">
              <p className="modal-card-title is-size-6">Enviar plantilla</p>
              <button
                type="button"
                className="delete"
                aria-label="Cerrar"
                disabled={enviandoModal}
                onClick={() => setModalEnviar(null)}
              />
            </header>
            <section className="modal-card-body py-3">
              {!plantillaModal ? (
                <p className="is-size-7 has-text-grey mb-0">Esta plantilla ya no existe. Cerrá y elegí otra del listado.</p>
              ) : (
                <>
                  <p className="is-size-7 has-text-grey mb-3" style={{ lineHeight: 1.45 }}>
                    <strong>{plantillaModal.nombre || 'Sin nombre'}</strong>. Se guarda en la nube; cada alumno marcado la
                    abre en <strong>Rutina → Asignadas</strong>.
                  </p>
                  <div className="field mb-3">
                    <label className="label is-size-7 mb-1" htmlFor="rut-modal-envio-buscar">
                      Buscar alumno
                    </label>
                    <input
                      id="rut-modal-envio-buscar"
                      type="search"
                      className="input is-small"
                      placeholder="Nombre o correo…"
                      value={qModalEnviar}
                      onChange={(e) => setQModalEnviar(e.target.value)}
                    />
                  </div>
                  {alumnosModalFiltrados.length === 0 ? (
                    <p className="is-size-7 has-text-grey mb-0">Ningún alumno coincide con la búsqueda.</p>
                  ) : (
                    <ul
                      className="mb-0"
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        maxHeight: 'min(50vh, 320px)',
                        overflowY: 'auto',
                      }}
                    >
                      {alumnosModalFiltrados.map((s) => {
                        const on = modalEnviar.seleccion.has(s.studentId)
                        return (
                          <li key={s.linkId ?? s.studentId} className="mb-2">
                            <label className="checkbox is-size-7">
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={enviandoModal}
                                onChange={() => toggleSeleccionModal(s.studentId)}
                              />
                              {` ${etiquetaAlumnoOpcionEnvio(s)}`}
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}
            </section>
            <footer className="modal-card-foot py-3" style={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                type="button"
                className="button is-small is-light"
                disabled={enviandoModal}
                onClick={() => setModalEnviar(null)}
              >
                Cancelar
              </button>
              {plantillaModal ? (
                <button
                  type="button"
                  className="button is-small is-link"
                  disabled={enviandoModal || nSeleccionModal === 0}
                  onClick={confirmarEnviarModal}
                >
                  {enviandoModal
                    ? 'Enviando…'
                    : nSeleccionModal > 0
                      ? `Enviar a ${nSeleccionModal} alumno${nSeleccionModal === 1 ? '' : 's'}`
                      : 'Enviar'}
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
