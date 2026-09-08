import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAppNotifications } from '../context/AppNotificationsContext'
import { useMyProfile } from '../hooks/useMyProfile'
import {
  findStudentIdByEmail,
  addTeacherStudent,
  listTeacherStudents,
  removeTeacherStudent,
  listAdminMessagesForTeacher,
  listTeachersWithStudentsForAdmin,
  fetchLinkedStudentsUserData,
  fetchLatestAssignmentsByStudent,
} from '../lib/profeDb'
import { fechaToISO } from '../utils/calorias'
import { buildAlumnoSnapshot, buildAlumnoIdentityMap, FILTRO_ALUMNO } from '../utils/profeAlumnosSnapshot'
import ProfeTitanium from '../components/profe/ProfeTitanium'
import '../components/profe/ProfeTitanium.css'
import ModuleGateCard from '../components/ModuleGateCard'

export default function Profe() {
  const { user, isConfigured } = useAuth()
  const { onToast, setAvisosAdmin, avisosAdmin } = useAppNotifications()
  const { profile, profileError, loading: profileLoading, refresh: refreshProfile } = useMyProfile()
  const [students, setStudents] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [emailAlumno, setEmailAlumno] = useState('')
  const [historialTick, setHistorialTick] = useState(0)
  const [adminVistaLoading, setAdminVistaLoading] = useState(false)
  const [adminVistaRows, setAdminVistaRows] = useState([])
  const [adminVistaErr, setAdminVistaErr] = useState(null)
  const [busquedaProfe, setBusquedaProfe] = useState('')
  const [filtroAlumno, setFiltroAlumno] = useState(FILTRO_ALUMNO.todos)
  const [userDataMap, setUserDataMap] = useState({})
  const [assignmentsMap, setAssignmentsMap] = useState({})
  const [userDataSyncWarn, setUserDataSyncWarn] = useState(false)

  const esProfe = profile?.role === 'profe'
  const esAdmin = profile?.role === 'admin'
  /** Admin puede usar el panel del entrenador con la misma cuenta. */
  const puedeEntrenar = esProfe || esAdmin
  const hoy = fechaToISO(new Date())

  const cargarAvisosAdmin = useCallback(async () => {
    if (!user?.id || !esProfe) {
      setAvisosAdmin([])
      return
    }
    const { data, error } = await listAdminMessagesForTeacher(user.id)
    if (!error && data) setAvisosAdmin(data)
    else setAvisosAdmin([])
  }, [user?.id, esProfe, setAvisosAdmin])

  const cargarAlumnos = useCallback(async () => {
    if (!user?.id || !puedeEntrenar) {
      setStudents([])
      return
    }
    setStudentsLoading(true)
    const { students: list, error } = await listTeacherStudents(user.id)
    if (error) {
      onToast({ err: error.message || 'No se pudieron cargar los alumnos.' })
      setStudents([])
    } else {
      setStudents(list)
    }
    setStudentsLoading(false)
  }, [user?.id, puedeEntrenar, onToast])

  useEffect(() => {
    cargarAvisosAdmin()
  }, [cargarAvisosAdmin])

  useEffect(() => {
    cargarAlumnos()
  }, [cargarAlumnos])

  useEffect(() => {
    if (!isConfigured || !user) return
    if (profileLoading) return
    if (profile?.role !== 'admin') {
      setAdminVistaRows([])
      setAdminVistaErr(null)
      setAdminVistaLoading(false)
      return
    }
    let cancel = false
    setAdminVistaLoading(true)
    setAdminVistaErr(null)
    listTeachersWithStudentsForAdmin().then(({ data, error }) => {
      if (cancel) return
      setAdminVistaLoading(false)
      if (error) {
        setAdminVistaErr(error.message || 'No se pudo cargar la supervisión.')
        setAdminVistaRows([])
      } else {
        setAdminVistaRows(data || [])
        setAdminVistaErr(null)
      }
    })
    return () => {
      cancel = true
    }
  }, [isConfigured, user?.id, profileLoading, profile?.role])

  useEffect(() => {
    if (!user?.id || !puedeEntrenar || !students.length) {
      setUserDataMap({})
      setAssignmentsMap({})
      setUserDataSyncWarn(false)
      return
    }
    let cancel = false
    ;(async () => {
      const ids = students.map((s) => s.studentId)
      const [{ data: ud, needsPolicy }, { map: am }] = await Promise.all([
        fetchLinkedStudentsUserData(ids),
        fetchLatestAssignmentsByStudent(user.id),
      ])
      if (cancel) return
      setUserDataMap(ud || {})
      setAssignmentsMap(am || {})
      setUserDataSyncWarn(Boolean(needsPolicy))
    })()
    return () => {
      cancel = true
    }
  }, [user?.id, puedeEntrenar, students, historialTick])

  useEffect(() => {
    if (!user?.id || !puedeEntrenar || !students.length) return
    const refrescar = () => {
      if (document.visibilityState === 'visible') setHistorialTick((n) => n + 1)
    }
    document.addEventListener('visibilitychange', refrescar)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') setHistorialTick((n) => n + 1)
    }, 20000)
    return () => {
      document.removeEventListener('visibilitychange', refrescar)
      window.clearInterval(interval)
    }
  }, [user?.id, puedeEntrenar, students.length])

  const qProfe = busquedaProfe.trim().toLowerCase()

  const adminVistaFiltrada = useMemo(() => {
    if (!qProfe) return adminVistaRows
    return adminVistaRows.filter(({ teacher, students: sts }) => {
      const nomT = (teacher.full_name || '').toLowerCase()
      const mailT = (teacher.email || '').toLowerCase()
      const idT = String(teacher.id || '').toLowerCase()
      if (nomT.includes(qProfe) || mailT.includes(qProfe) || idT.includes(qProfe)) return true
      return sts.some((s) => {
        const fn = (s.fullName || '').toLowerCase()
        const em = (s.email || '').toLowerCase()
        const sid = String(s.studentId || '').toLowerCase()
        return fn.includes(qProfe) || em.includes(qProfe) || sid.includes(qProfe)
      })
    })
  }, [adminVistaRows, qProfe])

  const identityMap = useMemo(() => buildAlumnoIdentityMap(students), [students])

  const alumnosEnriquecidos = useMemo(
    () =>
      students.map((s) => ({
        ...buildAlumnoSnapshot(s, userDataMap[s.studentId] || {}, assignmentsMap[s.studentId], hoy),
        identityIndex: identityMap.get(s.studentId) ?? 0,
      })),
    [students, userDataMap, assignmentsMap, hoy, identityMap],
  )

  const vincularAlumno = async () => {
    if (!user?.id || !puedeEntrenar) return
    const { studentId, error: e1 } = await findStudentIdByEmail(emailAlumno, {
      allowSelf: true,
      selfUserId: user.id,
    })
    if (e1) {
      onToast({ err: e1.message || 'No se pudo buscar el alumno.' })
      return
    }
    if (!studentId) {
      onToast({
        err: 'No encontramos una cuenta con ese correo. Verificá que esté bien escrito y que el alumno se haya registrado. Si ya lo hizo, pedile que entre una vez con su cuenta.',
      })
      return
    }
    const { error: e2 } = await addTeacherStudent(user.id, studentId)
    if (e2) {
      const msg = String(e2.message || '')
      if (msg.includes('duplicate') || e2.code === '23505') {
        onToast({ err: 'Ese alumno ya está en tu lista.' })
      } else if (msg.includes('teacher_students_check') || msg.includes('teacher_id <> student_id')) {
        onToast({
          err: 'Tu Supabase aún no permite vincular tu propia cuenta. Ejecutá el SQL «auto-vinculación admin» del punto 5 en SUPABASE.md.',
        })
      } else {
        onToast({ err: e2.message || 'No se pudo vincular.' })
      }
      return
    }
    setEmailAlumno('')
    onToast({ msg: 'Alumno vinculado. Ya podés armar rutinas y enviárselas.' })
    await cargarAlumnos()
    setHistorialTick((n) => n + 1)
  }

  const quitarAlumno = async (linkId) => {
    if (!window.confirm('¿Quitar este alumno de tu lista?')) return
    const { error } = await removeTeacherStudent(linkId)
    if (error) onToast({ err: error.message || 'No se pudo quitar.' })
    else {
      onToast({ msg: 'Alumno quitado de la lista.' })
      await cargarAlumnos()
    }
  }

  const bloqueSupervision = (
    <>
      {adminVistaErr && (
        <>
          <p className="module-alert module-alert--danger mb-3">{adminVistaErr}</p>
          <details className="mb-0">
            <summary className="is-size-7 has-text-grey" style={{ cursor: 'pointer' }}>
              Si es error de permisos en Supabase
            </summary>
            <p className="is-size-7 has-text-grey mt-2 mb-0">
              En el SQL Editor ejecutá la política <code>ts_select_admin</code> sobre <code>teacher_students</code>.
            </p>
          </details>
        </>
      )}
      {!adminVistaLoading && !adminVistaErr && adminVistaRows.length === 0 && (
        <p className="pf-muted mb-0">No hay cuentas con rol profe todavía.</p>
      )}
      {!adminVistaLoading &&
        !adminVistaErr &&
        adminVistaRows.length > 0 &&
        adminVistaFiltrada.length === 0 && (
          <p className="pf-muted mb-0">No hay coincidencias con la búsqueda.</p>
        )}
      {!adminVistaLoading &&
        !adminVistaErr &&
        adminVistaFiltrada.map(({ teacher, students: sts }) => {
          const nombre = (teacher.full_name || '').trim()
          const mail = (teacher.email || '').trim()
          const titulo = nombre || mail || teacher.id
          const mostrarMailDebajo = mail && mail !== nombre
          const nomT = (teacher.full_name || '').toLowerCase()
          const mailT = (teacher.email || '').toLowerCase()
          const idT = String(teacher.id || '').toLowerCase()
          const profeCoincide =
            !qProfe || nomT.includes(qProfe) || mailT.includes(qProfe) || idT.includes(qProfe)
          const alumnosMostrar =
            !qProfe || profeCoincide
              ? sts
              : sts.filter((s) => {
                  const fn = (s.fullName || '').toLowerCase()
                  const em = (s.email || '').toLowerCase()
                  const sid = String(s.studentId || '').toLowerCase()
                  return fn.includes(qProfe) || em.includes(qProfe) || sid.includes(qProfe)
                })
          return (
            <div key={teacher.id} className="pf-admin-block">
              <p className={`pf-admin-block-title ${mostrarMailDebajo ? 'mb-1' : 'mb-2'}`}>{titulo}</p>
              {mostrarMailDebajo ? <p className="pf-muted mb-2">{mail}</p> : null}
              {sts.length === 0 ? (
                <p className="pf-muted mb-0">Sin alumnos vinculados.</p>
              ) : alumnosMostrar.length === 0 ? (
                <p className="pf-muted mb-0">Sin alumnos que coincidan.</p>
              ) : (
                <ul className="pf-admin-alumnos mb-0">
                  {alumnosMostrar.map((s) => (
                    <li key={s.linkId}>
                      <strong>{(s.fullName || '').trim() || s.email}</strong>
                      {s.fullName ? <span className="pf-muted"> · {s.email}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
    </>
  )

  if (!isConfigured) {
    return (
      <ModuleGateCard
        icon="🧑‍🏫"
        iconTone="blue"
        title="Entrenador"
        subtitle="Configurá Supabase en el proyecto para usar cuentas y asignar rutinas en la nube."
      >
        <Link to="/config" className="button is-link is-small">
          Ir a configuración
        </Link>
      </ModuleGateCard>
    )
  }

  if (!user) {
    return (
      <ModuleGateCard
        icon="🧑‍🏫"
        iconTone="blue"
        title="Entrenador"
        subtitle="Iniciá sesión para gestionar alumnos y rutinas."
      >
        <Link to="/login" className="button is-link is-small">
          Iniciar sesión
        </Link>
      </ModuleGateCard>
    )
  }

  if (profileLoading && !profile) {
    return (
      <section className="section py-2 profe-page profe-titanium">
        <div className="container app-page-container profe-container">
          <p className="pf-muted mb-0">Cargando perfil…</p>
        </div>
      </section>
    )
  }

  if (!profile) {
    return (
      <section className="section py-2 profe-page profe-titanium">
        <div className="container app-page-container profe-container">
          <div className="pf-panel pf-empty-gate">
            <h2 className="pf-panel-title mb-2">No se pudo cargar tu perfil</h2>
            <p className="pf-muted mb-3">
              {profileError ||
                'Tu cuenta existe pero falta la fila en Supabase (tabla profiles). Cerrá sesión, volvé a entrar, o ejecutá el SQL de SUPABASE.md.'}
            </p>
            <button type="button" className="pf-btn-vincular" onClick={() => refreshProfile()}>
              Reintentar
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (!puedeEntrenar) {
    return (
      <section className="section py-2 profe-page profe-titanium">
        <div className="container app-page-container profe-container">
          <div className="pf-panel pf-empty-gate">
            <h2 className="pf-panel-title mb-2">Modo entrenador</h2>
            <p className="pf-muted mb-3">
              Tu rol actual es <strong>{profile.role || 'alumno'}</strong>. Pedí rol <strong>profe</strong> o{' '}
              <strong>admin</strong> en <Link to="/admin">Administración</Link>.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="section py-2 profe-page profe-titanium">
      <div className="container app-page-container profe-container">
        <ProfeTitanium
          profile={profile}
          user={user}
          students={students}
          studentsLoading={studentsLoading}
          alumnosEnriquecidos={alumnosEnriquecidos}
          userDataMap={userDataMap}
          adminMessages={avisosAdmin || []}
          busqueda={busquedaProfe}
          setBusqueda={setBusquedaProfe}
          filtro={filtroAlumno}
          setFiltro={setFiltroAlumno}
          emailAlumno={emailAlumno}
          setEmailAlumno={setEmailAlumno}
          vincularAlumno={vincularAlumno}
          quitarAlumno={quitarAlumno}
          onToast={onToast}
          historialTick={historialTick}
          setHistorialTick={setHistorialTick}
          esAdmin={esAdmin}
          userDataSyncWarn={userDataSyncWarn}
          onRefreshAlumnos={() => setHistorialTick((n) => n + 1)}
        />
      </div>
    </section>
  )
}
