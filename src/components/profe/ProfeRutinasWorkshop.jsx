import { useState, useEffect, useCallback, useMemo } from 'react'
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

export default function ProfeRutinasWorkshop({ students, teacherId, busqueda = '', onToast, onEnviado }) {
  const [plantillas, setPlantillas] = useStorage('profePlantillasRutina', [])
  const [catalogo] = useStorage('profeCatalogoEjercicios', [])
  const listP = Array.isArray(plantillas) ? plantillas : []
  const listC = Array.isArray(catalogo) ? catalogo.filter((c) => String(c.nombre || '').trim()) : []

  const [selectedId, setSelectedId] = useState('')
  const [picker, setPicker] = useState(null)
  const [sendStudentId, setSendStudentId] = useState('')
  const [sendPlantillaId, setSendPlantillaId] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busqCat, setBusqCat] = useState('')

  const qBusq = (busqueda || '').trim().toLowerCase()
  const plantillasFiltradas = useMemo(
    () => listP.filter((p) => plantillaCoincideBusqueda(p, students, qBusq)),
    [listP, students, qBusq]
  )

  const plantilla = listP.find((p) => p.id === selectedId)
  const enviablesParaEnvio = listP.filter((p) => !p.soloStudentId || p.soloStudentId === sendStudentId)

  const catFiltrado = useMemo(() => {
    const q = busqCat.trim().toLowerCase()
    if (!q) return listC.slice(0, 16)
    return listC.filter((c) => String(c.nombre || '').toLowerCase().includes(q)).slice(0, 24)
  }, [listC, busqCat])

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
    if (!listP.length) {
      setSelectedId('')
      return
    }
    if (plantillasFiltradas.length) {
      if (!plantillasFiltradas.some((p) => p.id === selectedId)) {
        setSelectedId(plantillasFiltradas[0].id)
      }
      return
    }
    if (!listP.some((p) => p.id === selectedId)) setSelectedId(listP[0].id)
  }, [listP, plantillasFiltradas, selectedId])

  useEffect(() => {
    if (students.length && !sendStudentId) setSendStudentId(students[0].studentId)
  }, [students, sendStudentId])

  useEffect(() => {
    const visibles = listP.filter((p) => !p.soloStudentId || p.soloStudentId === sendStudentId)
    if (visibles.length && !visibles.some((p) => p.id === sendPlantillaId)) setSendPlantillaId(visibles[0].id)
    if (!visibles.length) setSendPlantillaId('')
  }, [listP, sendStudentId, sendPlantillaId])

  const agregarPlantilla = () => {
    const n = emptyPlantilla()
    setPlantillas((prev) => [...(Array.isArray(prev) ? prev : []), n])
    setSelectedId(n.id)
  }

  const quitarPlantilla = () => {
    if (!plantilla || !window.confirm('¿Borrar esta plantilla?')) return
    setPlantillas((prev) => (Array.isArray(prev) ? prev.filter((p) => p.id !== plantilla.id) : []))
  }

  const updatePlantilla = useCallback(
    (id, fn) => {
      setPlantillas((prev) =>
        (Array.isArray(prev) ? prev : []).map((p) => (p.id === id ? fn({ ...p }) : p))
      )
    },
    [setPlantillas]
  )

  const abrirPicker = (dayIndex) => {
    if (!plantilla) return
    setPicker({ dayIndex, selectedIds: new Set() })
  }

  const aplicarPicker = () => {
    if (!picker || !plantilla) return
    const dayIndex = picker.dayIndex
    const dia = plantilla.dias[dayIndex]
    const actuales = normalizarEjerciciosDia(dia?.ejercicios)

    const agregar = listC
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

  const agregarLineaVacia = (dayIndex) => {
    if (!plantilla) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[dayIndex] }
      d.ejercicios = [...(d.ejercicios || []), { nombre: '', series: '', repeticiones: '' }]
      dias[dayIndex] = d
      return { ...p, dias }
    })
  }

  const agregarDesdeCatalogo = (dayIndex, nombre) => {
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

  const moverEjercicio = (dayIndex, ei, delta) => {
    if (!plantilla) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[dayIndex] }
      const ej = [...(d.ejercicios || [])]
      const j = ei + delta
      if (j < 0 || j >= ej.length) return p
      const tmp = ej[ei]
      ej[ei] = ej[j]
      ej[j] = tmp
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

  const enviar = async () => {
    const p = listP.find((x) => x.id === sendPlantillaId)
    if (!teacherId || !sendStudentId || !p) {
      onToast({ err: 'Elegí alumno y plantilla.' })
      return
    }
    if (p.soloStudentId && p.soloStudentId !== sendStudentId) {
      onToast({ err: 'Esa plantilla es solo para otro alumno.' })
      return
    }
    setEnviando(true)
    try {
      const obj = JSON.parse(exportarRutinaAJson({ nombre: p.nombre, dias: p.dias }))
      const dias = Array.isArray(obj.dias) ? obj.dias : []
      const { error } = await createRoutineAssignment(teacherId, sendStudentId, p.nombre || 'Rutina', { dias })
      if (error) onToast({ err: error.message || 'No se pudo enviar.' })
      else {
        onToast({ msg: `Rutina «${p.nombre}» enviada. El alumno la ve en Rutina → Asignadas.` })
        onEnviado?.()
      }
    } catch (e) {
      onToast({ err: e?.message || 'Error al preparar la rutina.' })
    }
    setEnviando(false)
  }

  return (
    <>
      <div className="box mb-4 py-3">
        <h2 className="title is-6 mb-2">Plantillas de rutina</h2>
        <p className="is-size-7 has-text-grey mb-3">
          Armás cada día con filas claras (ejercicio, series y repeticiones). Sumá ítems desde el catálogo o líneas a mano.
          Podés marcar una plantilla <strong>solo para un alumno</strong> (personalizada); el resto sirven para cualquiera.
        </p>
        <div className="is-flex is-flex-wrap-wrap mb-3" style={{ gap: '0.5rem' }}>
          <button type="button" className="button is-link is-small" onClick={agregarPlantilla}>
            Nueva plantilla
          </button>
        </div>

        {!listP.length ? (
          <p className="is-size-7 has-text-grey mb-0">Creá una plantilla para poder enviarla.</p>
        ) : (
          <>
            <div className="field mb-3">
              <label className="label is-size-7">Editando</label>
              <div className="control">
                {plantillasFiltradas.length === 0 && qBusq ? (
                  <p className="is-size-7 has-text-grey mb-0">Ninguna plantilla coincide con la búsqueda.</p>
                ) : (
                  <div className="select is-small is-fullwidth">
                    <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                      {(plantillasFiltradas.length ? plantillasFiltradas : listP).map((p) => (
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

            {plantilla && (
              <>
                <div className="field mb-3">
                  <label className="label is-size-7">Nombre de la plantilla</label>
                  <input
                    className="input is-small"
                    value={plantilla.nombre}
                    onChange={(e) => updatePlantilla(plantilla.id, (p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div className="field mb-3">
                  <label className="label is-size-7">Solo para alumno (opcional)</label>
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
                      <option value="">Cualquier alumno vinculado</option>
                      {students.map((s) => (
                        <option key={s.studentId} value={s.studentId}>
                          {s.fullName || s.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(plantilla.dias || []).map((d, idx) => {
                  const filas = normalizarEjerciciosDia(d.ejercicios)
                  return (
                    <div key={d.id || idx} className="mb-4 p-3" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                      <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
                        <span className="is-size-7 has-text-weight-semibold">Día {idx + 1}</span>
                        {(plantilla.dias || []).length > 1 && (
                          <button type="button" className="button is-small is-light" onClick={() => quitarDia(idx)}>
                            Quitar día
                          </button>
                        )}
                      </div>
                      <div className="field mb-3">
                        <label className="label is-size-7 mb-1">Nombre del día</label>
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
                        />
                      </div>

                      <p className="is-size-7 has-text-weight-semibold mb-2">Ejercicios del día</p>
                      {filas.length === 0 ? (
                        <p className="is-size-7 has-text-grey mb-3">
                          Todavía no hay ejercicios. Usá el buscador del catálogo, «Línea vacía» o «Añadir varios».
                        </p>
                      ) : (
                        <ul className="mb-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {filas.map((row, ei) => (
                            <li
                              key={`${d.id || `dia-${idx}`}-ex-${ei}`}
                              className="box py-2 px-3 mb-2"
                              style={{ background: 'rgba(255,255,255,0.05)' }}
                            >
                              <div className="columns is-mobile is-multiline mb-0">
                                <div className="column is-12-mobile is-5-tablet pb-1">
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
                                  <div className="buttons has-addons mb-0">
                                    <button
                                      type="button"
                                      className="button is-small is-light"
                                      disabled={ei === 0}
                                      onClick={() => moverEjercicio(idx, ei, -1)}
                                      aria-label="Subir"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      className="button is-small is-light"
                                      disabled={ei === filas.length - 1}
                                      onClick={() => moverEjercicio(idx, ei, 1)}
                                      aria-label="Bajar"
                                    >
                                      ↓
                                    </button>
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
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="field mb-2">
                        <label className="label is-size-7 mb-1">Buscar en tu catálogo</label>
                        <input
                          className="input is-small"
                          value={busqCat}
                          onChange={(e) => setBusqCat(e.target.value)}
                          placeholder="Filtrá por nombre…"
                        />
                      </div>
                      {listC.length > 0 ? (
                        <div className="mb-3" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {catFiltrado.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="button is-small is-light"
                              onClick={() => agregarDesdeCatalogo(idx, String(c.nombre || '').trim())}
                            >
                              + {c.nombre}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="is-flex is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
                        <button type="button" className="button is-small is-link is-light" onClick={() => agregarLineaVacia(idx)}>
                          + Línea vacía
                        </button>
                        <button
                          type="button"
                          className="button is-small is-info is-light"
                          onClick={() => abrirPicker(idx)}
                          disabled={!listC.length}
                        >
                          Añadir varios del catálogo…
                        </button>
                      </div>
                      {!listC.length ? (
                        <p className="is-size-7 has-text-grey mt-2 mb-0">Cargá el catálogo en la pestaña Ejercicios.</p>
                      ) : null}
                    </div>
                  )
                })}

                <button type="button" className="button is-small is-light mb-3" onClick={agregarDia}>
                  + Agregar día
                </button>
                <div>
                  <button type="button" className="button is-small is-danger is-light" onClick={quitarPlantilla}>
                    Borrar esta plantilla
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="box py-3">
        <h2 className="title is-6 mb-2">Enviar al alumno</h2>
        <p className="is-size-7 has-text-grey mb-3">Se guarda en la nube; el alumno la abre en <strong>Rutina → Asignadas</strong>.</p>
        {students.length === 0 ? (
          <p className="is-size-7 has-text-grey mb-0">Vinculá alumnos en la pestaña Alumnos.</p>
        ) : !listP.length ? (
          <p className="is-size-7 has-text-grey mb-0">Creá al menos una plantilla arriba.</p>
        ) : !enviablesParaEnvio.length ? (
          <p className="is-size-7 has-text-grey mb-0">
            No hay plantillas para este alumno (si solo tenés plantillas “personalizadas”, elegí al alumno correcto o
            creá una plantilla para cualquier alumno).
          </p>
        ) : (
          <>
            <div className="field mb-3">
              <label className="label is-size-7">Alumno</label>
              <div className="select is-small is-fullwidth">
                <select value={sendStudentId} onChange={(e) => setSendStudentId(e.target.value)}>
                  {students.map((s) => (
                    <option key={s.linkId} value={s.studentId}>
                      {s.fullName || s.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field mb-3">
              <label className="label is-size-7">Plantilla</label>
              <div className="select is-small is-fullwidth">
                <select value={sendPlantillaId} onChange={(e) => setSendPlantillaId(e.target.value)}>
                  {enviablesParaEnvio.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre || 'Sin nombre'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button type="button" className="button is-link is-small is-fullwidth" disabled={enviando} onClick={enviar}>
              {enviando ? 'Enviando…' : 'Enviar rutina al alumno'}
            </button>
          </>
        )}
      </div>

      {picker && (
        <div className="modal is-active">
          <button type="button" className="modal-background" aria-label="Cerrar" onClick={() => setPicker(null)} />
          <div className="modal-card" style={{ maxWidth: '420px' }}>
            <header className="modal-card-head py-3">
              <p className="modal-card-title is-size-6">Añadir del catálogo</p>
              <button type="button" className="delete" aria-label="Cerrar" onClick={() => setPicker(null)} />
            </header>
            <section className="modal-card-body py-3">
              <p className="is-size-7 has-text-grey mb-3">
                Marcá los ejercicios que querés sumar al final del día (orden = orden del catálogo). Después podés editar series y repeticiones en la lista.
              </p>
              <ul className="mb-0" style={{ listStyle: 'none', padding: 0 }}>
                {listC.map((c) => {
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
                Aplicar
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
