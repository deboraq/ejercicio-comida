import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAppNotifications } from '../context/AppNotificationsContext'
import {
  fetchMyProfile,
  findStudentIdByEmail,
  addTeacherStudent,
  listTeacherStudents,
  removeTeacherStudent,
  listAdminMessagesForTeacher,
  listTeachersWithStudentsForAdmin,
} from '../lib/profeDb'
import ProfeCatalogoEjercicios from '../components/profe/ProfeCatalogoEjercicios'
import ProfeRutinasWorkshop from '../components/profe/ProfeRutinasWorkshop'
import ProfeHistorialAsignaciones from '../components/profe/ProfeHistorialAsignaciones'
import PageHeader from '../components/PageHeader'
import ModuleShell, { ModuleSectionIntro } from '../components/ModuleShell'
import ModuleGateCard from '../components/ModuleGateCard'

function navItemsForProfile(profile) {
  if (!profile) return []
  const items = []
  if (profile.role === 'admin') {
    items.push({ id: 'supervision', label: 'Supervisión', desc: 'Entrenadores (rol profe) y alumnos vinculados.' })
  }
  if (profile.role === 'profe') {
    items.push(
      { id: 'alumnos', label: 'Alumnos', desc: 'Vincular con el correo con el que se registró cada alumno.' },
      { id: 'ejercicios', label: 'Ejercicios', desc: 'Catálogo para armar rutinas.' },
      { id: 'rutinas', label: 'Rutinas', desc: 'Plantillas y envío a la cuenta del alumno.' },
      { id: 'historial', label: 'Historial', desc: 'Rutinas ya enviadas.' },
    )
  }
  return items
}

export default function Profe() {
  const { user, isConfigured } = useAuth()
  const { onToast, setAvisosAdmin } = useAppNotifications()
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [students, setStudents] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [emailAlumno, setEmailAlumno] = useState('')
  const [panel, setPanel] = useState(null)
  const [historialTick, setHistorialTick] = useState(0)
  const [adminVistaLoading, setAdminVistaLoading] = useState(false)
  const [adminVistaRows, setAdminVistaRows] = useState([])
  const [adminVistaErr, setAdminVistaErr] = useState(null)
  const [busquedaProfe, setBusquedaProfe] = useState('')

  const esProfe = profile?.role === 'profe'
  const esAdmin = profile?.role === 'admin'

  const cargarPerfil = useCallback(async () => {
    if (!user?.id) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    const { data, error } = await fetchMyProfile(user.id)
    if (error) setProfile(null)
    else setProfile(data)
    setProfileLoading(false)
  }, [user?.id])

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
    if (!user?.id || !esProfe) {
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
  }, [user?.id, esProfe, onToast])

  useEffect(() => {
    cargarPerfil()
  }, [cargarPerfil])

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

  const navItems = useMemo(() => navItemsForProfile(profile), [profile?.role])

  useLayoutEffect(() => {
    if (profileLoading) return
    const ids = navItems.map((i) => i.id)
    if (!ids.length) {
      setPanel(null)
      return
    }
    setPanel((cur) => (cur && ids.includes(cur) ? cur : ids[0]))
  }, [profileLoading, navItems])

  const panelActivo = panel != null ? navItems.find((i) => i.id === panel) : null
  const mostrarCabeceraPanel = panel === 'supervision' || panel === 'alumnos'

  useEffect(() => {
    setBusquedaProfe('')
  }, [panel])

  const qProfe = busquedaProfe.trim().toLowerCase()

  const adminVistaFiltrada = useMemo(() => {
    if (!qProfe) return adminVistaRows
    return adminVistaRows.filter(({ teacher, students }) => {
      const nomT = (teacher.full_name || '').toLowerCase()
      const mailT = (teacher.email || '').toLowerCase()
      const idT = String(teacher.id || '').toLowerCase()
      if (nomT.includes(qProfe) || mailT.includes(qProfe) || idT.includes(qProfe)) return true
      return students.some((s) => {
        const fn = (s.fullName || '').toLowerCase()
        const em = (s.email || '').toLowerCase()
        const sid = String(s.studentId || '').toLowerCase()
        return fn.includes(qProfe) || em.includes(qProfe) || sid.includes(qProfe)
      })
    })
  }, [adminVistaRows, qProfe])

  const studentsFiltrados = useMemo(() => {
    if (!qProfe) return students
    return students.filter((s) => {
      const fn = (s.fullName || '').toLowerCase()
      const em = (s.email || '').toLowerCase()
      return fn.includes(qProfe) || em.includes(qProfe)
    })
  }, [students, qProfe])

  const placeholderBusqueda =
    panel === 'supervision'
      ? 'Nombre, correo o alumno…'
      : panel === 'alumnos'
        ? 'Nombre o correo del alumno…'
        : panel === 'ejercicios'
          ? 'Nombre o notas del ejercicio…'
          : panel === 'rutinas'
            ? 'Nombre de plantilla o alumno…'
            : panel === 'historial'
              ? 'Alumno, rutina o fecha…'
              : 'Buscar…'

  const mostrarBuscadorProfe =
    panel === 'supervision' || (esProfe && ['alumnos', 'ejercicios', 'rutinas', 'historial'].includes(panel || ''))

  const vincularAlumno = async () => {
    if (!user?.id || !esProfe) return
    const { studentId, error: e1 } = await findStudentIdByEmail(emailAlumno)
    if (e1) {
      onToast({ err: e1.message || 'No se pudo buscar el alumno.' })
      return
    }
    if (!studentId) {
      onToast({
        err: 'No encontramos una cuenta con ese correo. El alumno tiene que registrarse antes.',
      })
      return
    }
    const { error: e2 } = await addTeacherStudent(user.id, studentId)
    if (e2) {
      if (String(e2.message || '').includes('duplicate') || e2.code === '23505') {
        onToast({ err: 'Ese alumno ya está en tu lista.' })
      } else {
        onToast({ err: e2.message || 'No se pudo vincular.' })
      }
      return
    }
    setEmailAlumno('')
    onToast({ msg: 'Alumno vinculado. Ya podés armar rutinas y enviárselas.' })
    await cargarAlumnos()
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

  const bloqueSupervision = (
    <>
      {adminVistaLoading && <p className="is-size-7 has-text-grey mb-3">Cargando…</p>}
      {adminVistaErr && (
        <>
          <p className="module-alert module-alert--danger mb-3">{adminVistaErr}</p>
          <details className="mb-0">
            <summary className="is-size-7 has-text-grey" style={{ cursor: 'pointer' }}>
              Si es error de permisos en Supabase
            </summary>
            <p className="is-size-7 has-text-grey mt-2 mb-0">
              En el SQL Editor ejecutá la política <code>ts_select_admin</code> sobre <code>teacher_students</code> (bloque
              en <code>SUPABASE.md</code> del repo).
            </p>
          </details>
        </>
      )}
      {!adminVistaLoading && !adminVistaErr && adminVistaRows.length === 0 && (
        <p className="is-size-7 has-text-grey mb-0">No hay cuentas con rol profe todavía.</p>
      )}
      {!adminVistaLoading &&
        !adminVistaErr &&
        adminVistaRows.length > 0 &&
        adminVistaFiltrada.length === 0 && (
          <p className="is-size-7 has-text-grey mb-0">No hay coincidencias con la búsqueda.</p>
        )}
      {!adminVistaLoading &&
        !adminVistaErr &&
        adminVistaFiltrada.map(({ teacher, students }) => {
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
              ? students
              : students.filter((s) => {
                  const fn = (s.fullName || '').toLowerCase()
                  const em = (s.email || '').toLowerCase()
                  const sid = String(s.studentId || '').toLowerCase()
                  return fn.includes(qProfe) || em.includes(qProfe) || sid.includes(qProfe)
                })
          return (
            <div key={teacher.id} className="module-list-block">
              <p className={`module-list-block-title ${mostrarMailDebajo ? 'mb-1' : 'mb-2'}`}>{titulo}</p>
              {mostrarMailDebajo ? <p className="module-list-block-sub mb-2">{mail}</p> : null}
              {students.length === 0 ? (
                <p className="is-size-7 has-text-grey mb-0">Sin alumnos vinculados.</p>
              ) : alumnosMostrar.length === 0 ? (
                <p className="is-size-7 has-text-grey mb-0">Sin alumnos que coincidan.</p>
              ) : (
                <ul className="mb-0 pl-4" style={{ listStyle: 'disc' }}>
                  {alumnosMostrar.map((s) => (
                    <li key={s.linkId} className="is-size-7 mb-1">
                      <strong>{(s.fullName || '').trim() || s.email}</strong>
                      {s.fullName ? <span className="has-text-grey"> · {s.email}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
    </>
  )

  return (
    <section className="section py-4 profe-page">
      <div className="container app-page-container">
        <PageHeader
          icon="🧑‍🏫"
          iconTone="blue"
          title="Entrenador"
          subtitle="El alumno ve lo que envías en la pestaña Rutina de su cuenta."
          metrics={
            esProfe
              ? [`${students.length} alumnos`, `${navItems.length} secciones`]
              : undefined
          }
        />

        {profileLoading ? (
          <p className="is-size-7 has-text-grey mb-0">Cargando perfil…</p>
        ) : navItems.length === 0 ? (
          <div className="box module-gate-card module-gate-card--inline">
            <h2 className="module-shell-section-title mb-2">Modo entrenador</h2>
            <p className="module-shell-section-desc mb-3">
              {esAdmin ? (
                <>
                  Con rol <strong>admin</strong> podés usar <Link to="/admin">Administración</Link>. Para alumnos,
                  ejercicios y rutinas desde acá necesitás también rol <strong>profe</strong> en tu cuenta.
                </>
              ) : (
                <>
                  Pedí rol <strong>profe</strong> a quien administre la app (<Link to="/admin">Administración</Link>).
                </>
              )}
            </p>
          </div>
        ) : (
          <ModuleShell
            sections={navItems.map((i) => ({ id: i.id, label: i.label }))}
            activeId={panel}
            onSelect={setPanel}
            sidebarLabel="Menú"
          >
            {mostrarCabeceraPanel && panelActivo && (
              <ModuleSectionIntro title={panelActivo.label} desc={panelActivo.desc} />
            )}

            {mostrarBuscadorProfe && (
              <div className="module-search mb-3">
                <span className="module-search-icon" aria-hidden>🔍</span>
                <input
                  id="profe-busqueda"
                  type="search"
                  value={busquedaProfe}
                  onChange={(e) => setBusquedaProfe(e.target.value)}
                  placeholder={placeholderBusqueda}
                  autoComplete="off"
                />
              </div>
            )}

            {esAdmin && !esProfe && panel === 'supervision' && (
              <p className="module-alert module-alert--info mb-3">
                Roles y menú de cuentas: <Link to="/admin">Administración</Link>. Para usar Alumnos / Ejercicios /
                Rutinas con esta misma cuenta, sumá rol <strong>profe</strong> ahí.
              </p>
            )}

            {panel === 'supervision' && (
              <div className="box module-panel-card mb-0">
                {bloqueSupervision}
              </div>
            )}

            {panel === 'alumnos' && esProfe && (
              <div className="box module-panel-card mb-0">
                <div className="field has-addons mb-4">
                  <div className="control is-expanded">
                    <input
                      className="input"
                      type="email"
                      placeholder="Correo del alumno (cuenta registrada)"
                      value={emailAlumno}
                      onChange={(e) => setEmailAlumno(e.target.value)}
                    />
                  </div>
                  <div className="control">
                    <button type="button" className="button is-link" onClick={vincularAlumno}>
                      Vincular
                    </button>
                  </div>
                </div>
                {studentsLoading ? (
                  <p className="module-empty-text mb-0">Cargando lista…</p>
                ) : students.length === 0 ? (
                  <p className="module-empty-text mb-0">Todavía no tenés alumnos vinculados.</p>
                ) : studentsFiltrados.length === 0 ? (
                  <p className="module-empty-text mb-0">No hay coincidencias con la búsqueda.</p>
                ) : (
                  <ul className="module-list-rows mb-0">
                    {studentsFiltrados.map((s) => (
                      <li key={s.linkId} className="module-list-row">
                        <span className="module-list-row-text">
                          <strong>{s.fullName || s.email}</strong>
                          {s.fullName ? <span className="has-text-grey"> · {s.email}</span> : null}
                        </span>
                        <button type="button" className="button is-small is-light" onClick={() => quitarAlumno(s.linkId)}>
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {panel === 'ejercicios' && esProfe && <ProfeCatalogoEjercicios busqueda={busquedaProfe} />}

            {panel === 'rutinas' && esProfe && (
              <ProfeRutinasWorkshop
                students={students}
                teacherId={user.id}
                busqueda={busquedaProfe}
                onToast={onToast}
                onEnviado={() => setHistorialTick((n) => n + 1)}
              />
            )}

            {panel === 'historial' && esProfe && (
              <ProfeHistorialAsignaciones
                key={historialTick}
                teacherId={user.id}
                students={students}
                busqueda={busquedaProfe}
                onToast={onToast}
              />
            )}
          </ModuleShell>
        )}
      </div>
    </section>
  )
}
