import { useState, useEffect, useCallback } from 'react'
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

const TABS_PROFE = [
  { id: 'alumnos', label: 'Alumnos' },
  { id: 'ejercicios', label: 'Ejercicios' },
  { id: 'rutinas', label: 'Rutinas' },
  { id: 'historial', label: 'Historial' },
]

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
  const [tab, setTab] = useState('alumnos')
  const [historialTick, setHistorialTick] = useState(0)
  const [adminVistaLoading, setAdminVistaLoading] = useState(false)
  const [adminVistaRows, setAdminVistaRows] = useState([])
  const [adminVistaErr, setAdminVistaErr] = useState(null)

  const esProfe = profile?.role === 'profe'

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

  return (
    <section className="section py-4">
      <div className="container" style={{ maxWidth: '640px' }}>
        <header className="mb-4">
          <h1 className="title is-5 mb-2">Entrenador</h1>
          <p className="is-size-7 has-text-grey mb-0">
            Desde acá vinculás alumnos, armás tu catálogo de ejercicios, plantillas de rutina y envíos. El alumno sigue
            usando <strong>Rutina</strong> en su cuenta para ver asignadas y registrar entrenos.
          </p>
        </header>

        {profileLoading ? (
          <p className="is-size-7 has-text-grey">Cargando perfil…</p>
        ) : (
          <>
            {profile?.role === 'admin' && (
              <div className="box mb-4 py-3">
                <h2 className="title is-6 mb-2">Supervisión de entrenadores</h2>
                <p className="is-size-7 has-text-grey mb-3">
                  Cuentas con rol <strong>profe</strong> y alumnos que vincularon por correo. Para asignar roles o menús
                  usá <Link to="/admin">Administración</Link>. Si ves error de permisos, ejecutá en Supabase la política{' '}
                  <code>ts_select_admin</code> del archivo <code>SUPABASE.md</code>.
                </p>
                {adminVistaLoading && <p className="is-size-7 has-text-grey mb-0">Cargando…</p>}
                {adminVistaErr && (
                  <p className="notification is-danger is-light is-size-7 py-2 px-3 mb-0">{adminVistaErr}</p>
                )}
                {!adminVistaLoading && !adminVistaErr && adminVistaRows.length === 0 && (
                  <p className="is-size-7 has-text-grey mb-0">Todavía no hay entrenadores con rol profe.</p>
                )}
                {!adminVistaLoading &&
                  !adminVistaErr &&
                  adminVistaRows.map(({ teacher, students }) => (
                    <div
                      key={teacher.id}
                      className="mb-3 pb-3"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <p className="is-size-7 has-text-weight-semibold mb-1">
                        {(teacher.full_name || '').trim() || teacher.email || teacher.id}
                      </p>
                      <p className="is-size-7 has-text-grey mb-2">{teacher.email || '—'}</p>
                      {students.length === 0 ? (
                        <p className="is-size-7 has-text-grey mb-0">Sin alumnos vinculados.</p>
                      ) : (
                        <ul className="mb-0 pl-4" style={{ listStyle: 'disc' }}>
                          {students.map((s) => (
                            <li key={s.linkId} className="is-size-7 mb-1">
                              <strong>{(s.fullName || '').trim() || s.email}</strong>
                              {s.fullName ? <span className="has-text-grey"> · {s.email}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            )}

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

            {!esProfe && (
              <div className="box mb-4 py-3">
                <h2 className="title is-6 mb-2">Modo entrenador</h2>
                <p className="is-size-7 has-text-grey mb-0">
                  El rol <strong>entrenador</strong> lo asigna un administrador en <Link to="/admin">Administración</Link>.
                  Cuando te lo habiliten, vas a ver acá las pestañas para alumnos, ejercicios y rutinas.
                </p>
              </div>
            )}

            {esProfe && (
              <>
                <div className="buttons mb-4 are-small is-flex-wrap-wrap" style={{ gap: '0.35rem' }}>
                  {TABS_PROFE.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`button ${tab === t.id ? 'is-link' : 'is-light'}`}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {tab === 'alumnos' && (
                  <div className="box mb-4 py-3">
                    <h2 className="title is-6 mb-2">Alumnos</h2>
                    <p className="is-size-7 has-text-grey mb-3">Correo con el que el alumno se registró en la app.</p>
                    <div className="field has-addons mb-3">
                      <div className="control is-expanded">
                        <input
                          className="input is-small"
                          type="email"
                          placeholder="alumno@correo.com"
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
                    ) : (
                      <ul className="mb-0" style={{ listStyle: 'none', padding: 0 }}>
                        {students.map((s) => (
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

                {tab === 'ejercicios' && <ProfeCatalogoEjercicios />}

                {tab === 'rutinas' && (
                  <ProfeRutinasWorkshop
                    students={students}
                    teacherId={user.id}
                    onToast={onToast}
                    onEnviado={() => setHistorialTick((n) => n + 1)}
                  />
                )}

                {tab === 'historial' && (
                  <ProfeHistorialAsignaciones key={historialTick} teacherId={user.id} students={students} />
                )}
              </>
            )}

            {msg && <p className="notification is-success is-light is-size-7 py-2 px-3 mb-3">{msg}</p>}
            {err && <p className="notification is-danger is-light is-size-7 py-2 px-3 mb-0">{err}</p>}
          </>
        )}
      </div>
    </section>
  )
}
