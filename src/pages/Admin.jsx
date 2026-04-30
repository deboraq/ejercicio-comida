import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMyProfile } from '../hooks/useMyProfile'
import { listProfilesForAdmin, adminUpdateUserRole, createAdminMessage } from '../lib/profeDb'

export default function Admin() {
  const { user, isConfigured } = useAuth()
  const { profile, loading: profileLoading } = useMyProfile()
  const [rows, setRows] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [teacherIdMsg, setTeacherIdMsg] = useState('')
  const [bodyMsg, setBodyMsg] = useState('')
  const [enviandoMsg, setEnviandoMsg] = useState(false)

  const esAdmin = profile?.role === 'admin'

  const load = useCallback(async () => {
    setListLoading(true)
    setErr('')
    const { data, error } = await listProfilesForAdmin()
    setListLoading(false)
    if (error) {
      setErr(error.message || 'No se pudo cargar la lista.')
      setRows([])
      return
    }
    setRows(data || [])
  }, [])

  useEffect(() => {
    if (esAdmin) load()
  }, [esAdmin, load])

  const guardarRol = async (userId, nuevoRol) => {
    setErr('')
    setMsg('')
    const { error } = await adminUpdateUserRole(userId, nuevoRol)
    if (error) {
      setErr(error.message || 'No se pudo guardar el rol.')
      return
    }
    setMsg('Rol actualizado.')
    await load()
  }

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

  const profes = rows.filter((r) => r.role === 'profe')

  useEffect(() => {
    if (profes.length > 0 && !teacherIdMsg) setTeacherIdMsg(profes[0].id)
  }, [profes, teacherIdMsg])

  if (!isConfigured) {
    return (
      <section className="section py-4">
        <div className="container" style={{ maxWidth: '720px' }}>
          <p className="is-size-7 has-text-grey">Configurá Supabase en el proyecto.</p>
          <Link to="/config" className="button is-link is-small mt-2">Configuración</Link>
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="section py-4">
        <div className="container" style={{ maxWidth: '720px' }}>
          <p className="is-size-7 has-text-grey mb-2">Iniciá sesión con una cuenta administradora.</p>
          <Link to="/login" className="button is-link is-small">Iniciar sesión</Link>
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
          <Link to="/" className="button is-light is-small">Volver al inicio</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="section py-4">
      <div className="container" style={{ maxWidth: '720px' }}>
        <header className="mb-4">
          <h1 className="title is-5 mb-2">Administración</h1>
          <p className="is-size-7 has-text-grey mb-0">
            Asigná el rol <strong>entrenador</strong> a las cuentas que correspondan y enviá avisos que verán en <strong>Profe</strong>.
          </p>
        </header>

        <div className="box mb-4 py-3">
          <h2 className="title is-6 mb-3">Mensaje a un entrenador</h2>
          <p className="is-size-7 has-text-grey mb-3">Solo podés enviar a usuarios que ya tengan rol <strong>profe</strong>.</p>
          {profes.length === 0 ? (
            <p className="is-size-7 has-text-grey mb-0">Todavía no hay entrenadores. Marcá primero un rol en la tabla de abajo.</p>
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
                  <textarea className="textarea is-small" rows={4} value={bodyMsg} onChange={(e) => setBodyMsg(e.target.value)} placeholder="Instrucciones, políticas, novedades…" />
                </div>
              </div>
              <button type="button" className="button is-link is-small" disabled={enviandoMsg} onClick={enviarMensaje}>
                {enviandoMsg ? 'Enviando…' : 'Enviar mensaje'}
              </button>
            </>
          )}
        </div>

        <div className="box mb-4 py-3">
          <h2 className="title is-6 mb-3">Usuarios y roles</h2>
          {listLoading ? (
            <p className="is-size-7 has-text-grey mb-0">Cargando…</p>
          ) : (
            <div className="table-container">
              <table className="table is-size-7 is-fullwidth">
                <thead>
                  <tr>
                    <th>Correo</th>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <FilaRol key={r.id} row={r} actualUserId={user.id} onGuardar={guardarRol} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {msg && <p className="notification is-success is-light is-size-7 py-2 px-3 mb-2">{msg}</p>}
        {err && <p className="notification is-danger is-light is-size-7 py-2 px-3 mb-0">{err}</p>}

        <p className="is-size-7 has-text-grey mt-4 mb-0">
          <Link to="/profe">Ir a Profe</Link>
          {' · '}
          <Link to="/config">Configuración</Link>
        </p>
      </div>
    </section>
  )
}

function FilaRol({ row, actualUserId, onGuardar }) {
  const [rol, setRol] = useState(row.role || 'alumno')
  useEffect(() => {
    setRol(row.role || 'alumno')
  }, [row.role])

  return (
    <tr>
      <td>{row.email || '—'}</td>
      <td>{(row.full_name || '').trim() || '—'}</td>
      <td>
        <div className="select is-small">
          <select value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="alumno">alumno</option>
            <option value="profe">profe</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </td>
      <td>
        <button
          type="button"
          className="button is-small is-link is-light"
          disabled={rol === row.role}
          onClick={() => {
            if (row.id === actualUserId && row.role === 'admin' && rol !== 'admin') {
              if (!window.confirm('¿Sacarte el rol admin a vos mismo? Perderás acceso a esta pantalla.')) return
            }
            onGuardar(row.id, rol)
          }}
        >
          Guardar
        </button>
      </td>
    </tr>
  )
}
