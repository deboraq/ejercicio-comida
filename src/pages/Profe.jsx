import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [avisosAdmin, setAvisosAdmin] = useState([])
  const [students, setStudents] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [emailAlumno, setEmailAlumno] = useState('')
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [panel, setPanel] = useState(null)
  const [historialTick, setHistorialTick] = useState(0)
  const [adminVistaLoading, setAdminVistaLoading] = useState(false)
  const [adminVistaRows, setAdminVistaRows] = useState([])
  const [adminVistaErr, setAdminVistaErr] = useState(null)
  const [busquedaProfe, setBusquedaProfe] = useState('')

  const esProfe = profile?.role === 'profe'
  const esAdmin = profile?.role === 'admin'

  const onToast = useCallback(({ msg: m, err: e }) => {
    if (m) {
      setMsg(m)
      setErr(null)
    }
    if (e) {
      setErr(e)
      setMsg(null)
    }
  }, [])

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
  }, [user?.id, esProfe])

  const cargarAlumnos = useCallback(async () => {
    if (!user?.id || !esProfe) {
      setStudents([])
      return
    }
    setStudentsLoading(true)
    const { students: list, error } = await listTeacherStudents(user.id)
    if (error) {
      setErr(error.message || 'No se pudieron cargar los alumnos.')
      setStudents([])
    } else {
      setStudents(list)
      setErr(null)
    }
    setStudentsLoading(false)
  }, [user?.id, esProfe])

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
    setErr(null)
    setMsg(null)
    const { studentId, error: e1 } = await findStudentIdByEmail(emailAlumno)
    if (e1) {
      setErr(e1.message || 'No se pudo buscar el alumno.')
      return
    }
    if (!studentId) {
      setErr('No encontramos una cuenta con ese correo. El alumno tiene que registrarse antes.')
      return
    }
    const { error: e2 } = await addTeacherStudent(user.id, studentId)
    if (e2) {
      if (String(e2.message || '').includes('duplicate') || e2.code === '23505') {
        setErr('Ese alumno ya está en tu lista.')
      } else {
        setErr(e2.message || 'No se pudo vincular.')
      }
      return
    }
    setEmailAlumno('')
    setMsg('Alumno vinculado. Ya podés armar rutinas y enviárselas.')
    await cargarAlumnos()
  }

  const quitarAlumno = async (linkId) => {
    if (!window.confirm('¿Quitar este alumno de tu lista?')) return
    setErr(null)
    const { error } = await removeTeacherStudent(linkId)
    if (error) setErr(error.message || 'No se pudo quitar.')
    else {
      setMsg('Alumno quitado de la lista.')
      await cargarAlumnos()
    }
  }

  if (!isConfigured) {
    return (
      <section className="section py-4">
        <div className="container" style={{ maxWidth: '560px' }}>
          <h1 className="title is-5">Entrenador</h1>
          <p className="is-size-7 has-text-grey">
            Configurá Supabase en el proyecto para usar cuentas y asignar rutinas en la nube.
          </p>
          <Link to="/config" className="button is-link is-small mt-3">
            Ir a configuración
          </Link>
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="section py-4">
        <div className="container" style={{ maxWidth: '560px' }}>
          <h1 className="title is-5">Entrenador</h1>
          <p className="is-size-7 has-text-grey mb-3">Iniciá sesión para gestionar alumnos y rutinas.</p>
          <Link to="/login" className="button is-link is-small">
            Iniciar sesión
          </Link>
        </div>
      </section>
    )
  }

  const bloqueSupervision = (
    <>
      {adminVistaLoading && <p className="is-size-7 has-text-grey mb-3">Cargando…</p>}
      {adminVistaErr && (
        <>
          <p className="notification is-danger is-light is-size-7 py-2 px-3 mb-3">{adminVistaErr}</p>
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
            <div
              key={teacher.id}
              className="mb-3 pb-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className={`is-size-7 has-text-weight-semibold ${mostrarMailDebajo ? 'mb-1' : 'mb-2'}`}>{titulo}</p>
              {mostrarMailDebajo ? <p className="is-size-7 has-text-grey mb-2">{mail}</p> : null}
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
    <section className="section py-4">
      <div className="container" style={{ maxWidth: '1120px' }}>
        <header className="mb-4">
          <h1 className="title is-5 mb-2">Entrenador</h1>
          <p className="is-size-7 has-text-grey mb-0">
            El alumno ve lo que envías en la pestaña <strong>Rutina</strong> de su cuenta.
          </p>
        </header>

        {profileLoading ? (
          <p className="is-size-7 has-text-grey">Cargando perfil…</p>
        ) : navItems.length === 0 ? (
          <div className="box py-4 px-4" style={{ maxWidth: '520px' }}>
            <h2 className="title is-6 mb-2">Modo entrenador</h2>
            <p className="is-size-7 has-text-grey mb-3">
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
          <>
            {esProfe && avisosAdmin.length > 0 && (
              <div className="notification is-info is-light py-3 px-3 mb-4">
                <h2 className="title is-6 mb-2">Avisos del administrador</h2>
                <ul className="mb-0 pl-4" style={{ listStyle: 'disc' }}>
                  {avisosAdmin.map((a) => (
                    <li key={a.id} className="mb-3">
                      <p className="is-size-7 mb-1" style={{ whiteSpace: 'pre-wrap' }}>
                        {a.body}
                      </p>
                      <span className="is-size-7 has-text-grey">{(a.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="columns is-variable is-2 is-multiline">
              <div className="column is-12-mobile is-3-tablet">
                <nav
                  className="box py-3 px-3 mb-0"
                  style={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    background: 'rgba(0,0,0,0.2)',
                  }}
                  aria-label="Secciones entrenador"
                >
                  <p className="menu-label mb-2 has-text-grey-light">Menú</p>
                  <ul
                    className="is-flex is-flex-direction-column"
                    style={{ gap: '0.35rem', listStyle: 'none', margin: 0, padding: 0 }}
                  >
                    {navItems.map((item) => {
                      const activa = panel === item.id
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={`button is-small is-fullwidth has-text-left ${activa ? 'is-link' : 'is-light'}`}
                            onClick={() => setPanel(item.id)}
                            aria-current={activa ? 'page' : undefined}
                          >
                            <span className="is-block">{item.label}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </nav>
              </div>

              <div className="column">
                {mostrarCabeceraPanel && panelActivo && (
                  <div className="mb-3">
                    <h2 className="title is-6 mb-1">{panelActivo.label}</h2>
                    <p className="is-size-7 has-text-grey mb-0">{panelActivo.desc}</p>
                  </div>
                )}

                {mostrarBuscadorProfe && (
                  <div className="field mb-3">
                    <label className="label is-size-7" htmlFor="profe-busqueda">
                      Buscar
                    </label>
                    <input
                      id="profe-busqueda"
                      className="input is-small"
                      type="search"
                      value={busquedaProfe}
                      onChange={(e) => setBusquedaProfe(e.target.value)}
                      placeholder={placeholderBusqueda}
                      autoComplete="off"
                    />
                  </div>
                )}

                {esAdmin && !esProfe && panel === 'supervision' && (
                  <p className="notification is-info is-light is-size-7 py-2 px-3 mb-3">
                    Roles y menú de cuentas: <Link to="/admin">Administración</Link>. Para usar Alumnos / Ejercicios /
                    Rutinas con esta misma cuenta, sumá rol <strong>profe</strong> ahí.
                  </p>
                )}

                {panel === 'supervision' && (
                  <div className="box mb-4 py-3">
                    {bloqueSupervision}
                  </div>
                )}

                {panel === 'alumnos' && esProfe && (
                  <div className="box mb-4 py-3">
                    <div className="field has-addons mb-3">
                      <div className="control is-expanded">
                        <input
                          className="input is-small"
                          type="email"
                          placeholder="Correo del alumno (cuenta registrada)"
                          value={emailAlumno}
                          onChange={(e) => setEmailAlumno(e.target.value)}
                        />
                      </div>
                      <div className="control">
                        <button type="button" className="button is-link is-small" onClick={vincularAlumno}>
                          Vincular
                        </button>
                      </div>
                    </div>
                    {studentsLoading ? (
                      <p className="is-size-7 has-text-grey mb-0">Cargando lista…</p>
                    ) : students.length === 0 ? (
                      <p className="is-size-7 has-text-grey mb-0">Todavía no tenés alumnos vinculados.</p>
                    ) : studentsFiltrados.length === 0 ? (
                      <p className="is-size-7 has-text-grey mb-0">No hay coincidencias con la búsqueda.</p>
                    ) : (
                      <ul className="mb-0" style={{ listStyle: 'none', padding: 0 }}>
                        {studentsFiltrados.map((s) => (
                          <li
                            key={s.linkId}
                            className="is-flex is-justify-content-space-between is-align-items-center py-2 subtle-divider-b"
                            style={{ gap: '0.5rem' }}
                          >
                            <span className="is-size-7">
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
                  />
                )}

                {msg && <p className="notification is-success is-light is-size-7 py-2 px-3 mb-3">{msg}</p>}
                {err && <p className="notification is-danger is-light is-size-7 py-2 px-3 mb-0">{err}</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
