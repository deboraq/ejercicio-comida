import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useStorage } from '../hooks/useStorage'
import { exportarRutinaAJson } from '../utils/rutinaShare'
import {
  fetchMyProfile,
  findStudentIdByEmail,
  addTeacherStudent,
  listTeacherStudents,
  removeTeacherStudent,
  createRoutineAssignment,
  listAdminMessagesForTeacher,
} from '../lib/profeDb'

export default function Profe() {
  const { user, isConfigured } = useAuth()
  const [rutinas] = useStorage('rutinas', [])
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [avisosAdmin, setAvisosAdmin] = useState([])
  const [students, setStudents] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [emailAlumno, setEmailAlumno] = useState('')
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [studentIdParaRutina, setStudentIdParaRutina] = useState('')
  const [rutinaIdElegida, setRutinaIdElegida] = useState('')
  const [enviandoRutina, setEnviandoRutina] = useState(false)

  const esProfe = profile?.role === 'profe'

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
    if (students.length && !studentIdParaRutina) {
      setStudentIdParaRutina(students[0].studentId)
    }
  }, [students, studentIdParaRutina])

  const listaRutinas = Array.isArray(rutinas) ? rutinas : []
  useEffect(() => {
    if (listaRutinas.length && !rutinaIdElegida) {
      setRutinaIdElegida(listaRutinas[0].id)
    }
  }, [listaRutinas, rutinaIdElegida])

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
    setMsg('Alumno vinculado. Ya podés asignarle rutinas.')
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

  const enviarRutina = async () => {
    if (!user?.id || !esProfe || !studentIdParaRutina) return
    const rut = listaRutinas.find((r) => r.id === rutinaIdElegida)
    if (!rut) {
      setErr('Elegí una rutina de tus plantillas (crealas en Rutina → Mis rutinas).')
      return
    }
    setEnviandoRutina(true)
    setErr(null)
    setMsg(null)
    try {
      const obj = JSON.parse(exportarRutinaAJson(rut))
      const dias = Array.isArray(obj.dias) ? obj.dias : []
      const { error } = await createRoutineAssignment(user.id, studentIdParaRutina, rut.nombre || 'Rutina', { dias })
      if (error) {
        setErr(error.message || 'No se pudo enviar la rutina.')
      } else {
        setMsg(`Rutina «${rut.nombre}» enviada. El alumno la verá en Rutina → Asignadas al sincronizar.`)
      }
    } catch (e) {
      setErr(e?.message || 'Error al preparar la rutina.')
    }
    setEnviandoRutina(false)
  }

  if (!isConfigured) {
    return (
      <section className="section py-4">
        <div className="container" style={{ maxWidth: '560px' }}>
          <h1 className="title is-5">Entrenador</h1>
          <p className="is-size-7 has-text-grey">
            Configurá Supabase en el proyecto para usar cuentas y asignar rutinas en la nube.
          </p>
          <Link to="/config" className="button is-link is-small mt-3">Ir a configuración</Link>
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
          <Link to="/login" className="button is-link is-small">Iniciar sesión</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="section py-4">
      <div className="container" style={{ maxWidth: '560px' }}>
        <header className="mb-4">
          <h1 className="title is-5 mb-2">Entrenador</h1>
          <p className="is-size-7 has-text-grey mb-0">
            Vinculá alumnos por correo (tienen que tener cuenta), asigná rutinas desde tus plantillas y ellos las verán en <strong>Rutina → Asignadas</strong>.
          </p>
        </header>

        {profileLoading ? (
          <p className="is-size-7 has-text-grey">Cargando perfil…</p>
        ) : (
          <>
            {profile?.role === 'admin' && (
              <p className="is-size-7 mb-3">
                <Link to="/admin">Ir a administración</Link>
              </p>
            )}

            {esProfe && avisosAdmin.length > 0 && (
              <div className="notification is-info is-light py-3 px-3 mb-4">
                <h2 className="title is-6 mb-2">Avisos del administrador</h2>
                <ul className="mb-0 pl-4" style={{ listStyle: 'disc' }}>
                  {avisosAdmin.map((a) => (
                    <li key={a.id} className="mb-3">
                      <p className="is-size-7 mb-1" style={{ whiteSpace: 'pre-wrap' }}>{a.body}</p>
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
                  El rol <strong>entrenador</strong> lo asigna un <strong>administrador</strong> de la plataforma (no podés activarlo vos). Cuando te lo habiliten, vas a ver acá alumnos y rutinas.
                  {' '}Si administrás la app, usá <Link to="/admin">Admin</Link> (requiere rol admin en tu cuenta).
                </p>
              </div>
            )}

            {esProfe && (
              <>
                <div className="box mb-4 py-3">
                  <h2 className="title is-6 mb-2">Alumnos</h2>
                  <p className="is-size-7 has-text-grey mb-3">
                    Correo con el que el alumno se registró en la app.
                  </p>
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
                        <li key={s.linkId} className="is-flex is-justify-content-space-between is-align-items-center py-2 subtle-divider-b" style={{ gap: '0.5rem' }}>
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

                <div className="box mb-4 py-3">
                  <h2 className="title is-6 mb-2">Enviar rutina</h2>
                  <p className="is-size-7 has-text-grey mb-3">
                    Se usa una copia de tus plantillas de <Link to="/rutina">Rutina → Mis rutinas</Link>. El alumno puede clonarla a sus rutinas para registrar pesos.
                  </p>
                  {students.length === 0 ? (
                    <p className="is-size-7 has-text-grey mb-0">Primero vinculá al menos un alumno.</p>
                  ) : listaRutinas.length === 0 ? (
                    <p className="is-size-7 has-text-grey mb-0">Creá al menos una rutina en la pestaña Rutina.</p>
                  ) : (
                    <>
                      <div className="field mb-3">
                        <label className="label is-size-7">Alumno</label>
                        <div className="control">
                          <div className="select is-small is-fullwidth">
                            <select value={studentIdParaRutina} onChange={(e) => setStudentIdParaRutina(e.target.value)}>
                              {students.map((s) => (
                                <option key={s.linkId} value={s.studentId}>
                                  {s.fullName || s.email}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="field mb-3">
                        <label className="label is-size-7">Rutina (plantilla)</label>
                        <div className="control">
                          <div className="select is-small is-fullwidth">
                            <select value={rutinaIdElegida} onChange={(e) => setRutinaIdElegida(e.target.value)}>
                              {listaRutinas.map((r) => (
                                <option key={r.id} value={r.id}>{r.nombre || 'Sin nombre'}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="button is-link is-small is-fullwidth"
                        disabled={enviandoRutina}
                        onClick={enviarRutina}
                      >
                        {enviandoRutina ? 'Enviando…' : 'Enviar rutina al alumno'}
                      </button>
                    </>
                  )}
                </div>
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
