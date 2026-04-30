import { useEffect, useState, useMemo } from 'react'
import { listRoutineAssignmentsForTeacher, deleteRoutineAssignment } from '../../lib/profeDb'

export default function ProfeHistorialAsignaciones({ teacherId, students, busqueda = '', onToast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [revocandoId, setRevocandoId] = useState(null)

  useEffect(() => {
    if (!teacherId) {
      setRows([])
      setLoading(false)
      return
    }
    let cancel = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      const { data, error } = await listRoutineAssignmentsForTeacher(teacherId)
      if (cancel) return
      if (error) {
        setErr(error.message || 'No se pudo cargar el historial.')
        setRows([])
      } else {
        setRows(Array.isArray(data) ? data : [])
      }
      setLoading(false)
    })()
    return () => {
      cancel = true
    }
  }, [teacherId])

  const nombreAlumno = (studentId) => {
    const s = students.find((x) => x.studentId === studentId)
    return s ? s.fullName || s.email || studentId : studentId
  }

  const revocarEnvio = async (r) => {
    if (
      !window.confirm(
        '¿Quitar esta rutina al alumno? Deja de verla en Rutina → Asignadas (al refrescar o volver a la app).'
      )
    ) {
      return
    }
    setRevocandoId(r.id)
    const { error } = await deleteRoutineAssignment(r.id)
    setRevocandoId(null)
    if (error) {
      onToast?.({ err: error.message || 'No se pudo revocar el envío.' })
      return
    }
    setRows((prev) => prev.filter((x) => x.id !== r.id))
    onToast?.({ msg: 'Rutina quitada al alumno.' })
  }

  const q = (busqueda || '').trim().toLowerCase()
  const rowsFiltrados = useMemo(() => {
    if (!q) return rows
    return rows.filter((r) => {
      const t = (r.title || '').toLowerCase()
      const f = String(r.created_at || '').toLowerCase()
      const alum = nombreAlumno(r.student_id).toLowerCase()
      return t.includes(q) || f.includes(q) || alum.includes(q)
    })
  }, [rows, q, students])

  return (
    <div className="box py-3">
      <h2 className="title is-6 mb-2">Historial de envíos</h2>
      <p className="is-size-7 has-text-grey mb-3">
        Listado de rutinas que enviaste (desde esta pantalla o versiones anteriores de la app).
      </p>
      {loading ? (
        <p className="is-size-7 has-text-grey mb-0">Cargando…</p>
      ) : err ? (
        <p className="notification is-danger is-light is-size-7 py-2 px-3 mb-0">{err}</p>
      ) : rows.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0">Todavía no hay envíos registrados.</p>
      ) : rowsFiltrados.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0">No hay coincidencias con la búsqueda.</p>
      ) : (
        <div className="table-container">
          <table className="table is-size-7 is-fullwidth mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Alumno</th>
                <th>Rutina</th>
                <th className="has-text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rowsFiltrados.map((r) => (
                <tr key={r.id}>
                  <td>{(r.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                  <td>{nombreAlumno(r.student_id)}</td>
                  <td>{r.title || '—'}</td>
                  <td className="has-text-right">
                    <button
                      type="button"
                      className="button is-small is-danger is-light"
                      disabled={revocandoId === r.id}
                      onClick={() => revocarEnvio(r)}
                    >
                      {revocandoId === r.id ? 'Quitando…' : 'Quitar al alumno'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="is-size-7 has-text-grey mt-4 mb-0">
        Para <strong>estadísticas por alumno</strong> (pesos, volumen, constancia) haría falta que esos registros se lean
        desde la nube con permiso de entrenador; hoy el alumno guarda entrenos en su cuenta. Si querés, el siguiente paso
        es exponer agregados seguros por alumno vinculado.
      </p>
    </div>
  )
}
