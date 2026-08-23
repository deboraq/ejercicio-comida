import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMyProfile } from '../hooks/useMyProfile'
import { createAdminMessage, listProfilesForAdmin } from '../lib/profeDb'
import AdminUsersRolesSection from '../components/AdminUsersRolesSection'
import AdminRoleMenuSection from '../components/AdminRoleMenuSection'
import PageHeader from '../components/PageHeader'
import ModuleShell, { ModuleAlerts, ModuleSectionIntro } from '../components/ModuleShell'
import ModuleGateCard from '../components/ModuleGateCard'

const SECCIONES = [
  {
    id: 'mensajes',
    label: 'Mensajes a entrenadores',
    titulo: 'Mensajes a entrenadores',
    desc: 'Avisos que verán en la pestaña Profe.',
  },
  {
    id: 'menu-rol',
    label: 'Menú por rol',
    titulo: 'Menú por rol',
    desc: 'Qué pestañas oculta cada rol en el menú lateral.',
  },
  {
    id: 'usuarios',
    label: 'Usuarios y roles',
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
      <ModuleGateCard
        icon="🛡️"
        iconTone="blue"
        title="Administración"
        subtitle="Configurá Supabase en el proyecto para gestionar usuarios y roles."
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
        icon="🛡️"
        iconTone="blue"
        title="Administración"
        subtitle="Iniciá sesión con una cuenta administradora."
      >
        <Link to="/login" className="button is-link is-small">
          Iniciar sesión
        </Link>
      </ModuleGateCard>
    )
  }

  if (profileLoading) {
    return (
      <section className="section py-4 admin-page">
        <div className="container app-page-container">
          <p className="is-size-7 has-text-grey mb-0">Cargando…</p>
        </div>
      </section>
    )
  }

  if (!esAdmin) {
    return (
      <ModuleGateCard
        icon="🛡️"
        iconTone="blue"
        title="Administración"
        subtitle="Esta cuenta no tiene rol administrador. El primer admin se define en Supabase (SQL en SUPABASE.md, sección 6)."
      >
        <Link to="/" className="button is-light is-small">
          Volver al inicio
        </Link>
      </ModuleGateCard>
    )
  }

  const seccionActiva = SECCIONES.find((s) => s.id === seccion) || SECCIONES[0]

  const cambiarSeccion = (id) => {
    setSeccion(id)
    setErr('')
    setMsg('')
  }

  const bloqueMensajes = (
    <div className="box module-panel-card mb-0">
      <p className="module-panel-hint mb-4">
        Solo podés enviar a usuarios que ya tengan rol <strong>profe</strong>.
      </p>
      {profes.length === 0 ? (
        <p className="module-empty-text mb-0">Todavía no hay entrenadores. Asigná el rol en Usuarios y roles.</p>
      ) : (
        <>
          <div className="field mb-3">
            <label className="ej-form-label" htmlFor="admin-teacher">Entrenador</label>
            <div className="select is-fullwidth">
              <select id="admin-teacher" value={teacherIdMsg} onChange={(e) => setTeacherIdMsg(e.target.value)}>
                <option value="">Elegí…</option>
                {profes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.full_name || '').trim() || p.email || p.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field mb-4">
            <label className="ej-form-label" htmlFor="admin-msg-body">Mensaje</label>
            <textarea
              id="admin-msg-body"
              className="textarea"
              rows={4}
              value={bodyMsg}
              onChange={(e) => setBodyMsg(e.target.value)}
              placeholder="Instrucciones, políticas, novedades…"
            />
          </div>
          <button type="button" className="button is-link" disabled={enviandoMsg} onClick={enviarMensaje}>
            {enviandoMsg ? 'Enviando…' : 'Enviar mensaje'}
          </button>
        </>
      )}
    </div>
  )

  return (
    <section className="section py-4 admin-page">
      <div className="container app-page-container">
        <PageHeader
          icon="🛡️"
          iconTone="blue"
          title="Administración"
          subtitle="Gestioná mensajes, menú por rol y cuentas de usuario."
          metrics={[`${adminRows.length} cuentas`, `${profes.length} entrenadores`]}
        />

        <ModuleShell
          sections={SECCIONES}
          activeId={seccion}
          onSelect={cambiarSeccion}
          sidebarLabel="Secciones"
        >
          <ModuleSectionIntro title={seccionActiva.titulo} desc={seccionActiva.desc} />
          <ModuleAlerts msg={msg} err={err} />

          {seccion === 'mensajes' && bloqueMensajes}
          {seccion === 'menu-rol' && <AdminRoleMenuSection />}
          {seccion === 'usuarios' && (
            <AdminUsersRolesSection rows={adminRows} loading={adminRowsLoading} onReload={refreshAdminRows} />
          )}
        </ModuleShell>
      </div>
    </section>
  )
}
