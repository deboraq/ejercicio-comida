import { useEffect, useState, useMemo } from 'react'
import { listRoutineAssignmentsForTeacher, deleteRoutineAssignment, createRoutineAssignment } from '../../lib/profeDb'
import { exportarRutinaAJson } from '../../utils/rutinaShare'
import { formatearFechaHoraLocal } from '../../utils/calorias'
import { estadoEnvioCloud, filtrarEnvios, FILTRO_ENVIO } from '../../utils/profeEnvios'
import { avatarToneClass } from '../../utils/profeAlumnosSnapshot'

export default function ProfeHistorialAsignaciones({
  teacherId,
  students,
  userDataMap = {},
  busqueda = '',
  onToast,
  onReenviado,
}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [revocandoId, setRevocandoId] = useState(null)
  const [reenviandoId, setReenviandoId] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState(FILTRO_ENVIO.todos)

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
  }, [teacherId, onReenviado])

  const alumnoDe = (studentId) => students.find((x) => x.studentId === studentId)

  const nombreAlumno = (studentId) => {
    const s = alumnoDe(studentId)
    return s ? s.fullName || s.email || studentId : studentId
  }

  const mailAlumno = (studentId) => alumnoDe(studentId)?.email || ''

  const revocarEnvio = async (r) => {
    if (!window.confirm('¿Quitar esta rutina al alumno? Deja de verla en Rutina → Asignadas.')) return
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

  const reenviar = async (r) => {
    if (!teacherId || !r.payload) {
      onToast?.({ err: 'No hay datos de la plantilla para reenviar.' })
      return
    }
    setReenviandoId(r.id)
    const payload = r.payload?.dias ? r.payload : { dias: r.payload?.dias || [] }
    const { error } = await createRoutineAssignment(
      teacherId,
      r.student_id,
      r.title || 'Rutina',
      payload,
    )
    setReenviandoId(null)
    if (error) {
      onToast?.({ err: error.message || 'No se pudo reenviar.' })
      return
    }
    onToast?.({ msg: `Rutina «${r.title}» reenviada a ${nombreAlumno(r.student_id)}.` })
    onReenviado?.()
  }

  const q = (busqueda || '').trim().toLowerCase()
  const rowsFiltrados = useMemo(() => {
    let list = rows
    list = filtrarEnvios(list, filtroEstado, userDataMap)
    if (!q) return list
    return list.filter((r) => {
      const t = (r.title || '').toLowerCase()
      const f = String(r.created_at || '').toLowerCase()
      const alum = nombreAlumno(r.student_id).toLowerCase()
      const mail = mailAlumno(r.student_id).toLowerCase()
      return t.includes(q) || f.includes(q) || alum.includes(q) || mail.includes(q)
    })
  }, [rows, q, students, filtroEstado, userDataMap])

  const chips = [
    { id: FILTRO_ENVIO.todos, label: 'Todos' },
    { id: FILTRO_ENVIO.visto, label: 'Visto en app', tone: 'green' },
    { id: FILTRO_ENVIO.activo, label: 'En progreso', tone: 'blue' },
    { id: FILTRO_ENVIO.pendiente, label: 'Pendiente', tone: 'muted' },
  ]

  return (
    <div className="pf-envios-module">
      <div className="pf-info-banner pf-info-banner--compact">
        <span className="pf-info-ico" aria-hidden>i</span>
        <p className="mb-0">
          Historial cloud de rutinas publicadas. El estado se infiere de la app del alumno (asignadas abiertas y cargas
          registradas).
        </p>
      </div>

      <div className="pf-envios-toolbar">
        <div className="pf-chips">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`pf-chip${filtroEstado === c.id ? ' is-active' : ''}${c.tone ? ` pf-chip--${c.tone}` : ''}`}
              onClick={() => setFiltroEstado(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="pf-muted">Cargando envíos…</p>
      ) : err ? (
        <p className="pf-alert pf-alert--danger mb-0">{err}</p>
      ) : rows.length === 0 ? (
        <div className="pf-empty-state">
          <p className="mb-2">Todavía no hay rutinas enviadas a la nube.</p>
          <p className="pf-muted mb-0">
            Usá <strong>Enviar Rutina a la Nube</strong> en la pestaña Alumnos o <strong>Enviar</strong> desde
            Plantillas.
          </p>
        </div>
      ) : rowsFiltrados.length === 0 ? (
        <p className="pf-muted mb-0">No hay envíos que coincidan con la búsqueda o el filtro.</p>
      ) : (
        <ul className="pf-envios-list mb-0">
          {rowsFiltrados.map((r) => {
            const st = estadoEnvioCloud(r, userDataMap[r.student_id] || {})
            const ini = (nombreAlumno(r.student_id) || '?').slice(0, 2).toUpperCase()
            return (
              <li key={r.id} className="pf-envio-card">
                <div className="pf-envio-main">
                  <span className={`pf-envio-avatar ${avatarToneClass(r.student_id)}`}>{ini}</span>
                  <div className="pf-envio-body">
                    <div className="pf-envio-title-row">
                      <strong className="pf-envio-alumno">{nombreAlumno(r.student_id)}</strong>
                      <span className={`pf-badge pf-badge--${st.tone}`}>{st.label}</span>
                    </div>
                    <p className="pf-envio-rutina mb-1">{r.title || 'Rutina'}</p>
                    <p className="pf-envio-meta mb-0">
                      Enviado {formatearFechaHoraLocal(r.created_at)}
                      {mailAlumno(r.student_id) ? ` · ${mailAlumno(r.student_id)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="pf-envio-actions">
                  <button
                    type="button"
                    className="pf-btn pf-btn--outline-blue pf-btn--sm"
                    disabled={reenviandoId === r.id}
                    onClick={() => reenviar(r)}
                  >
                    {reenviandoId === r.id ? 'Reenviando…' : 'Reenviar / Sincronizar'}
                  </button>
                  <button
                    type="button"
                    className="pf-btn pf-btn--outline pf-btn--sm"
                    disabled={revocandoId === r.id}
                    onClick={() => revocarEnvio(r)}
                  >
                    {revocandoId === r.id ? 'Quitando…' : 'Quitar al alumno'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
