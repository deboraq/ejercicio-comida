import { useEffect, useState } from 'react'
import { listRoutineAssignmentsForTeacher } from '../../lib/profeDb'

export default function ProfeHistorialAsignaciones({ teacherId, students }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

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
      ) : (
        <div className="table-container">
          <table className="table is-size-7 is-fullwidth mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Alumno</th>
                <th>Rutina</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{(r.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                  <td>{nombreAlumno(r.student_id)}</td>
                  <td>{r.title || '—'}</td>
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
