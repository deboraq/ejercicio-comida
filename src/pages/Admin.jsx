import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMyProfile } from '../hooks/useMyProfile'
import { createAdminMessage, listProfilesForAdmin } from '../lib/profeDb'
import AdminUsersRolesSection from '../components/AdminUsersRolesSection'
import AdminRoleMenuSection from '../components/AdminRoleMenuSection'

const SECCIONES = [
  {
    id: 'mensajes',
    titulo: 'Mensajes a entrenadores',
    desc: 'Avisos que verán en la pestaña Profe.',
  },
  {
    id: 'menu-rol',
    titulo: 'Menú por rol',
    desc: 'Qué pestañas oculta cada rol en el menú inferior.',
  },
  {
    id: 'usuarios',
    titulo: 'Usuarios y roles',
    desc: 'Roles, búsqueda y menú personalizado por cuenta.',
  },
]

export default function Admin() {
  const { user, isConfigured } = useAuth()
  const { profile, loading: profileLoading } = useMyProfile()
  const [adminRows, setAdminRows] = useState([])
  const [adminRowsLoading, setAdminRowsLoading] = useState(false)
  const [seccion, setSeccion] = useState('mensajes')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [teacherIdMsg, setTeacherIdMsg] = useState('')
  const [bodyMsg, setBodyMsg] = useState('')
  const [enviandoMsg, setEnviandoMsg] = useState(false)

  const esAdmin = profile?.role === 'admin'

  const refreshAdminRows = useCallback(async () => {
    setAdminRowsLoading(true)
    const { data, error } = await listProfilesForAdmin()
    setAdminRowsLoading(false)
    if (!error) setAdminRows(data || [])
  }, [])

  useEffect(() => {
    if (esAdmin && user && isConfigured) refreshAdminRows()
  }, [esAdmin, user, isConfigured, refreshAdminRows])

  const enviarMensaje = async () => {
    if (!teacherIdMsg || !bodyMsg.trim()) {
      setErr('Elegí un entrenador y escribí el mensaje.')
      return
    }
    setEnviandoMsg(true)
    setErr('')
    setMsg('')
    const { error } = await createAdminMessage(teacherIdMsg, bodyMsg)
    setEnviandoMsg(false)
    if (error) {
      setErr(error.message || 'No se pudo enviar el mensaje.')
      return
    }
    setMsg('Mensaje enviado. El entrenador lo verá en Profe.')
    setBodyMsg('')
  }

  const profes = adminRows.filter((r) => r.role === 'profe')

  useEffect(() => {
    if (profes.length > 0 && !teacherIdMsg) setTeacherIdMsg(profes[0].id)
  }, [profes, teacherIdMsg])

  if (!isConfigured) {
    return (
      <section className="section py-4">
        <div className="container" style={{ maxWidth: '720px' }}>
          <p className="is-size-7 has-text-grey">Configurá Supabase en el proyecto.</p>
          <Link to="/config" className="button is-link is-small mt-2">
            Configuración
          </Link>
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="section py-4">
        <div className="container" style={{ maxWidth: '720px' }}>
          <p className="is-size-7 has-text-grey mb-2">Iniciá sesión con una cuenta administradora.</p>
          <Link to="/login" className="button is-link is-small">
            Iniciar sesión
          </Link>
        </div>
      </section>
    )
  }

  if (profileLoading) {
    return (
      <section className="section py-4">
        <div className="container" style={{ maxWidth: '720px' }}>
          <p className="is-size-7 has-text-grey">Cargando…</p>
        </div>
      </section>
    )
  }

  if (!esAdmin) {
    return (
      <section className="section py-4">
        <div className="container" style={{ maxWidth: '720px' }}>
          <h1 className="title is-5 mb-2">Administración</h1>
          <p className="is-size-7 has-text-grey mb-3">
            Esta cuenta no tiene rol administrador. El primer admin se define en Supabase (SQL en <code>SUPABASE.md</code>, sección 6).
          </p>
          <Link to="/" className="button is-light is-small">
            Volver al inicio
          </Link>
        </div>
      </section>
    )
  }

  const bloqueMensajes = (
    <div className="box mb-4 py-3">
      <h2 className="title is-6 mb-3">Mensaje a un entrenador</h2>
      <p className="is-size-7 has-text-grey mb-3">Solo podés enviar a usuarios que ya tengan rol <strong>profe</strong>.</p>
      {profes.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0">Todavía no hay entrenadores. Asigná el rol en Usuarios y roles.</p>
      ) : (
        <>
          <div className="field mb-3">
            <label className="label is-size-7">Entrenador</label>
            <div className="control">
              <div className="select is-small is-fullwidth">
                <select value={teacherIdMsg} onChange={(e) => setTeacherIdMsg(e.target.value)}>
                  <option value="">Elegí…</option>
                  {profes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.full_name || '').trim() || p.email || p.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="field mb-3">
            <label className="label is-size-7">Mensaje</label>
            <div className="control">
              <textarea
                className="textarea is-small"
                rows={4}
                value={bodyMsg}
                onChange={(e) => setBodyMsg(e.target.value)}
                placeholder="Instrucciones, políticas, novedades…"
              />
            </div>
          </div>
          <button type="button" className="button is-link is-small" disabled={enviandoMsg} onClick={enviarMensaje}>
            {enviandoMsg ? 'Enviando…' : 'Enviar mensaje'}
          </button>
        </>
      )}
    </div>
  )

  const seccionActiva = SECCIONES.find((s) => s.id === seccion) || SECCIONES[0]

  const cambiarSeccion = (id) => {
    setSeccion(id)
    setErr('')
    setMsg('')
  }

  return (
    <section className="section py-4">
      <div className="container" style={{ maxWidth: '1120px' }}>
        <header className="mb-4">
          <h1 className="title is-5 mb-2">Administración</h1>
          <p className="is-size-7 has-text-grey mb-0">
            Elegí una sección en el menú de la izquierda; el contenido se muestra a la derecha.
          </p>
        </header>

        <div className="columns is-variable is-2 is-multiline">
          <div className="column is-12-mobile is-3-tablet">
            <nav
              className="box py-3 px-3 mb-0"
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                background: 'rgba(0,0,0,0.2)',
              }}
              aria-label="Secciones de administración"
            >
              <p className="menu-label mb-2 has-text-grey-light">Secciones</p>
              <ul className="is-flex is-flex-direction-column" style={{ gap: '0.35rem', listStyle: 'none', margin: 0, padding: 0 }}>
                {SECCIONES.map((s) => {
                  const activa = seccion === s.id
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={`button is-small is-fullwidth has-text-left ${activa ? 'is-link' : 'is-light'}`}
                        onClick={() => cambiarSeccion(s.id)}
                        aria-current={activa ? 'page' : undefined}
                      >
                        <span className="is-block">{s.titulo}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="is-size-7 has-text-grey mt-3 mb-0">
                <Link to="/profe">Ir a Profe</Link>
                <br />
                <Link to="/config">Configuración</Link>
              </p>
            </nav>
          </div>

          <div className="column">
            <div className="mb-3">
              <h2 className="title is-6 mb-1">{seccionActiva.titulo}</h2>
              <p className="is-size-7 has-text-grey mb-0">{seccionActiva.desc}</p>
            </div>

            {msg && <p className="notification is-success is-light is-size-7 py-2 px-3 mb-2">{msg}</p>}
            {err && <p className="notification is-danger is-light is-size-7 py-2 px-3 mb-2">{err}</p>}

            {seccion === 'mensajes' && bloqueMensajes}
            {seccion === 'menu-rol' && <AdminRoleMenuSection />}
            {seccion === 'usuarios' && (
              <AdminUsersRolesSection rows={adminRows} loading={adminRowsLoading} onReload={refreshAdminRows} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
