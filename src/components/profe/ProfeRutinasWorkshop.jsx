import { useState, useEffect, useCallback } from 'react'
import { useStorage } from '../../hooks/useStorage'
import { exportarRutinaAJson } from '../../utils/rutinaShare'
import { createRoutineAssignment } from '../../lib/profeDb'

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function emptyDia(i) {
  return { id: newId('pd'), nombre: `Día ${i}`, ejercicios: [] }
}

function emptyPlantilla() {
  return { id: newId('pt'), nombre: 'Nueva plantilla', dias: [emptyDia(1)], soloStudentId: null }
}

export default function ProfeRutinasWorkshop({ students, teacherId, onToast, onEnviado }) {
  const [plantillas, setPlantillas] = useStorage('profePlantillasRutina', [])
  const [catalogo] = useStorage('profeCatalogoEjercicios', [])
  const listP = Array.isArray(plantillas) ? plantillas : []
  const listC = Array.isArray(catalogo) ? catalogo.filter((c) => String(c.nombre || '').trim()) : []

  const [selectedId, setSelectedId] = useState('')
  const [picker, setPicker] = useState(null)
  const [sendStudentId, setSendStudentId] = useState('')
  const [sendPlantillaId, setSendPlantillaId] = useState('')
  const [enviando, setEnviando] = useState(false)

  const plantilla = listP.find((p) => p.id === selectedId)
  const enviablesParaEnvio = listP.filter((p) => !p.soloStudentId || p.soloStudentId === sendStudentId)

  useEffect(() => {
    if (!listP.length) {
      setSelectedId('')
      return
    }
    if (!listP.some((p) => p.id === selectedId)) setSelectedId(listP[0].id)
  }, [listP, selectedId])

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
    const dia = plantilla.dias[dayIndex]
    const nombresDia = new Set((dia?.ejercicios || []).map((e) => String(e).trim()).filter(Boolean))
    const idsSel = new Set(
      listC.filter((c) => nombresDia.has(String(c.nombre || '').trim())).map((c) => c.id)
    )
    setPicker({ dayIndex, selectedIds: idsSel })
  }

  const aplicarPicker = () => {
    if (!picker || !plantilla) return
    const nombresOrden = listC.filter((c) => picker.selectedIds.has(c.id)).map((c) => String(c.nombre || '').trim())
    const dayIndex = picker.dayIndex
    const dia = plantilla.dias[dayIndex]
    const nombresCatalogo = new Set(listC.map((c) => String(c.nombre || '').trim()))
    const extra = (dia?.ejercicios || [])
      .map((e) => String(e).trim())
      .filter(Boolean)
      .filter((n) => !nombresCatalogo.has(n))
    const dayIndexFinal = dayIndex
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...(p.dias || [])]
      const d = { ...dias[dayIndexFinal], ejercicios: [...nombresOrden, ...extra] }
      dias[dayIndexFinal] = d
      return { ...p, dias }
    })
    setPicker(null)
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
          Armás días y ejercicios desde tu catálogo. Podés marcar una plantilla <strong>solo para un alumno</strong> (personalizada); el resto sirven para cualquiera.
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
                <div className="select is-small is-fullwidth">
                  <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                    {listP.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre || 'Sin nombre'}
                        {p.soloStudentId ? ' (solo un alumno)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
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

                {(plantilla.dias || []).map((d, idx) => (
                  <div key={d.id || idx} className="mb-4 p-3" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                    <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
                      <span className="is-size-7 has-text-weight-semibold">Día {idx + 1}</span>
                      {(plantilla.dias || []).length > 1 && (
                        <button type="button" className="button is-small is-light" onClick={() => quitarDia(idx)}>
                          Quitar día
                        </button>
                      )}
                    </div>
                    <div className="field mb-2">
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
                    <p className="is-size-7 has-text-grey mb-2">
                      Ejercicios: {(d.ejercicios || []).length ? (d.ejercicios || []).join(' · ') : 'ninguno'}
                    </p>
                    <button
                      type="button"
                      className="button is-small is-link is-light"
                      onClick={() => abrirPicker(idx)}
                      disabled={!listC.length}
                    >
                      Elegir del catálogo…
                    </button>
                    {!listC.length ? (
                      <span className="is-size-7 has-text-grey ml-2">Primero cargá el catálogo (pestaña Ejercicios).</span>
                    ) : null}
                  </div>
                ))}

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
              <p className="modal-card-title is-size-6">Ejercicios del día</p>
              <button type="button" className="delete" aria-label="Cerrar" onClick={() => setPicker(null)} />
            </header>
            <section className="modal-card-body py-3">
              <p className="is-size-7 has-text-grey mb-3">Marcá los que entran en este día (orden = orden del catálogo).</p>
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
