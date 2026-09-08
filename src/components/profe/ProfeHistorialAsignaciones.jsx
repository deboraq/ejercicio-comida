import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  listRoutineAssignmentsForTeacher,
  deleteRoutineAssignment,
  updateRoutineAssignment,
} from '../../lib/profeDb'
import { formatearFechaHoraLocal } from '../../utils/calorias'
import {
  filtrarEnvios,
  filtrarEnviosPorDias,
  contarEnvios,
  metricasEnvios,
  progresoEnvioCloud,
  FILTRO_ENVIO,
} from '../../utils/profeEnvios'
import { inicialesAlumno, avatarToneClass } from '../../utils/profeAlumnosSnapshot'

function IconRefresh({ className }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" />
      <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatearEnvioRelativo(createdAt) {
  if (!createdAt) return '—'
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return formatearFechaHoraLocal(createdAt)
  const hoy = new Date()
  const mismoDia =
    d.getFullYear() === hoy.getFullYear() &&
    d.getMonth() === hoy.getMonth() &&
    d.getDate() === hoy.getDate()
  if (mismoDia) {
    const pad = (n) => String(n).padStart(2, '0')
    return `Hoy, ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return formatearFechaHoraLocal(createdAt)
}

export default function ProfeHistorialAsignaciones({
  teacherId,
  students,
  userDataMap = {},
  busqueda = '',
  refreshTick = 0,
  onToast,
  onReenviado,
  onStatsChange,
  onForzarSync,
}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [revocandoId, setRevocandoId] = useState(null)
  const [reenviandoId, setReenviandoId] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState(FILTRO_ENVIO.todos)
  const [ventanaDias, setVentanaDias] = useState(30)

  const cargar = useCallback(async () => {
    if (!teacherId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    const { data, error } = await listRoutineAssignmentsForTeacher(teacherId)
    if (error) {
      setErr(error.message || 'No se pudo cargar el historial.')
      setRows([])
    } else {
      setRows(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }, [teacherId])

  useEffect(() => {
    cargar()
  }, [cargar, refreshTick])

  const alumnoDe = (studentId) => students.find((x) => x.studentId === studentId)

  const nombreAlumno = (studentId) => {
    const s = alumnoDe(studentId)
    return s ? s.fullName || s.email || studentId : studentId
  }

  const mailAlumno = (studentId) => alumnoDe(studentId)?.email || ''

  const metricas = useMemo(() => metricasEnvios(rows, userDataMap), [rows, userDataMap])

  useEffect(() => {
    onStatsChange?.(metricas)
  }, [metricas, onStatsChange])

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
    onReenviado?.()
  }

  const reenviar = async (r) => {
    if (!teacherId || !r.payload) {
      onToast?.({ err: 'No hay datos de la plantilla para reenviar.' })
      return
    }
    setReenviandoId(r.id)
    const payload = r.payload?.dias ? r.payload : { dias: r.payload?.dias || [] }
    const { data: updated, error } = await updateRoutineAssignment(r.id, {
      title: r.title || 'Rutina',
      payload,
    })
    setReenviandoId(null)
    if (error) {
      onToast?.({ err: error.message || 'No se pudo reenviar.' })
      return
    }
    if (updated) {
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...updated } : x)))
    } else {
      await cargar()
    }
    onToast?.({ msg: `Rutina «${r.title}» re-sincronizada con ${nombreAlumno(r.student_id)}.` })
    onReenviado?.()
  }

  const forzarResync = () => {
    onForzarSync?.()
    cargar()
    onToast?.({ msg: 'Historial y actividad de alumnos actualizados.' })
  }

  const q = (busqueda || '').trim().toLowerCase()
  const rowsFiltrados = useMemo(() => {
    let list = filtrarEnviosPorDias(rows, ventanaDias)
    list = filtrarEnvios(list, filtroEstado, userDataMap)
    if (!q) return list
    return list.filter((r) => {
      const t = (r.title || '').toLowerCase()
      const f = String(r.created_at || '').toLowerCase()
      const alum = nombreAlumno(r.student_id).toLowerCase()
      const mail = mailAlumno(r.student_id).toLowerCase()
      return t.includes(q) || f.includes(q) || alum.includes(q) || mail.includes(q)
    })
  }, [rows, q, students, filtroEstado, userDataMap, ventanaDias])

  const conteosVentana = useMemo(() => {
    const base = filtrarEnviosPorDias(rows, ventanaDias)
    return contarEnvios(base, userDataMap)
  }, [rows, userDataMap, ventanaDias])

  const chips = [
    { id: FILTRO_ENVIO.todos, label: `Todos (${conteosVentana.total})` },
    { id: FILTRO_ENVIO.visto, label: `Activos en app (${conteosVentana.visto + conteosVentana.activo})`, tone: 'green' },
    { id: FILTRO_ENVIO.completado, label: `Completados (${conteosVentana.completado})`, tone: 'green' },
    { id: FILTRO_ENVIO.pendiente, label: `Sin abrir (${conteosVentana.pendiente})`, tone: 'orange' },
  ]

  return (
    <div className="pf-envios-module">
      <header className="pf-envios-head">
        <div>
          <h2 className="pf-envios-title mb-1">Historial de Rutinas Asignadas &amp; Envíos Cloud</h2>
          <p className="pf-envios-sub mb-0">
            Seguimiento de apertura, progreso de sesiones y re-sincronización con la pestaña Rutina del alumno.
          </p>
        </div>
        <button type="button" className="pf-btn pf-btn--outline-blue pf-btn--sm" onClick={forzarResync}>
          <IconRefresh className="pf-btn-ico" />
          Forzar Resincronización
        </button>
      </header>

      <div className="pf-envios-filters">
        <label className="pf-envios-select-wrap">
          <span className="visually-hidden">Ventana de tiempo</span>
          <select value={ventanaDias} onChange={(e) => setVentanaDias(Number(e.target.value))}>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
            <option value={0}>Todo el historial</option>
          </select>
        </label>
        <label className="pf-envios-select-wrap">
          <span className="visually-hidden">Estado</span>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value={FILTRO_ENVIO.todos}>Todos los estados</option>
            <option value={FILTRO_ENVIO.activo}>En progreso</option>
            <option value={FILTRO_ENVIO.visto}>Visto en app</option>
            <option value={FILTRO_ENVIO.completado}>Completados</option>
            <option value={FILTRO_ENVIO.pendiente}>Sin abrir</option>
          </select>
        </label>
      </div>

      <div className="pf-chips pf-chips--envios">
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

      {loading ? (
        <p className="pf-muted">Cargando envíos…</p>
      ) : err ? (
        <p className="pf-alert pf-alert--danger mb-0">{err}</p>
      ) : rows.length === 0 ? (
        <div className="pf-empty-state">
          <p className="mb-2">Todavía no hay rutinas enviadas a la nube.</p>
          <p className="pf-muted mb-0">
            Usá <strong>Enviar Rutina a la Nube</strong> en el panel derecho o <strong>Enviar</strong> desde Plantillas.
          </p>
        </div>
      ) : rowsFiltrados.length === 0 ? (
        <p className="pf-muted mb-0">No hay envíos que coincidan con la búsqueda o el filtro.</p>
      ) : (
        <ul className="pf-envios-list mb-0">
          {rowsFiltrados.map((r) => {
            const alumno = alumnoDe(r.student_id)
            const prog = progresoEnvioCloud(r, userDataMap[r.student_id] || {})
            const st = prog.estado
            const ini = inicialesAlumno(alumno?.fullName, alumno?.email || r.student_id)
            return (
              <li key={r.id} className={`pf-envio-card pf-envio-card--rich pf-envio-card--${prog.barTone}`}>
                <div className="pf-envio-main">
                  <span className="pf-envio-avatar-wrap">
                    <span className={`pf-envio-avatar ${avatarToneClass(r.student_id)}`}>{ini}</span>
                    {st.id === 'progreso' || st.id === 'visto' ? (
                      <span className="pf-envio-live pf-envio-live--green" aria-hidden />
                    ) : null}
                  </span>
                  <div className="pf-envio-body">
                    <div className="pf-envio-title-row">
                      <strong className="pf-envio-alumno">{nombreAlumno(r.student_id)}</strong>
                      {mailAlumno(r.student_id) && !alumno?.fullName ? (
                        <span className="pf-envio-mail-inline">{mailAlumno(r.student_id)}</span>
                      ) : null}
                    </div>
                    <p className="pf-envio-rutina mb-1">{r.title || 'Rutina'}</p>
                    <p className="pf-envio-meta mb-1">
                      Enviado {formatearEnvioRelativo(r.created_at)}
                      {mailAlumno(r.student_id) && alumno?.fullName ? ` · ${mailAlumno(r.student_id)}` : ''}
                    </p>
                    <span className={`pf-badge pf-badge--${st.tone}`}>{st.label}</span>
                    <div className="pf-envio-progress-wrap">
                      <div className="pf-envio-progress-lbl">
                        <span>Progreso del ciclo</span>
                        <span>{prog.barLabel}</span>
                      </div>
                      <div className="pf-envio-progress" aria-hidden>
                        <span
                          className={`pf-envio-progress-fill pf-envio-progress-fill--${prog.barTone}`}
                          style={{ width: `${prog.pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pf-envio-actions">
                  <button
                    type="button"
                    className="pf-btn pf-btn--outline pf-btn--sm"
                    disabled={reenviandoId === r.id}
                    onClick={() => reenviar(r)}
                  >
                    {reenviandoId === r.id ? 'Sincronizando…' : 'Reenviar / Sincronizar'}
                  </button>
                  <button
                    type="button"
                    className="pf-btn pf-btn--primary pf-btn--sm"
                    onClick={() =>
                      onToast?.({
                        msg: `Reporte de ${nombreAlumno(r.student_id)}: ${prog.barLabel}. Detalle ampliado próximamente.`,
                      })
                    }
                  >
                    Ver Reporte
                  </button>
                  <button
                    type="button"
                    className="pf-btn pf-btn--ghost pf-btn--sm"
                    disabled={revocandoId === r.id}
                    onClick={() => revocarEnvio(r)}
                  >
                    {revocandoId === r.id ? 'Quitando…' : 'Quitar'}
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
