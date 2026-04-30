import { useState, useEffect } from 'react'
import { updateRoleNavHidden } from '../lib/profeDb'
import { BLOCKABLE_NAV_KEYS, BLOCKABLE_LABELS, normalizeRoleNavMap } from '../utils/navModules'
import { useRoleNav } from '../context/RoleNavContext'

function mensajeErrorRoleNav(m) {
  const t = String(m || '')
  if (
    t.includes('role_nav_hidden') ||
    t.includes('schema cache') ||
    /relation.*does not exist|no existe la relación/i.test(t)
  ) {
    return 'Falta crear la tabla en Supabase: abrí el SQL Editor de tu proyecto, pegá y ejecutá el bloque «Menú por rol» (tabla public.role_nav_hidden) del archivo SUPABASE.md en el repositorio. Luego recargá esta página.'
  }
  return t || 'No se pudo guardar. Revisá Supabase y SUPABASE.md.'
}

const ROLES_META = [
  { id: 'alumno', label: 'Alumno', help: 'Cuentas que usan rutina, ejercicios, comida, etc.' },
  { id: 'profe', label: 'Entrenador', help: 'Por defecto suelen trabajar solo desde Profe.' },
  {
    id: 'admin',
    label: 'Administrador',
    help: 'En la app las cuentas admin siempre ven todas las pestañas; acá podés guardar valores igualmente.',
  },
]

export default function AdminRoleMenuSection() {
  const { roleNavMap, refresh } = useRoleNav()
  const [draft, setDraft] = useState(() => normalizeRoleNavMap(roleNavMap))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    setDraft(normalizeRoleNavMap(roleNavMap))
  }, [roleNavMap])

  const toggle = (role, key) => {
    setDraft((prev) => {
      const n = normalizeRoleNavMap(prev)
      const set = new Set(n[role] || [])
      if (set.has(key)) set.delete(key)
      else set.add(key)
      n[role] = [...set]
      return n
    })
  }

  const guardar = async () => {
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      for (const r of ['alumno', 'profe', 'admin']) {
        const { error } = await updateRoleNavHidden(r, draft[r])
        if (error) throw error
      }
      setMsg('Menú por rol guardado.')
      await refresh()
    } catch (e) {
      setErr(mensajeErrorRoleNav(e?.message))
    }
    setSaving(false)
  }

  return (
    <div className="box mb-4 py-3">
      <h2 className="title is-6 mb-2">Menú por rol</h2>
      <p className="is-size-7 has-text-grey mb-3">
        Elegí qué pestañas del menú inferior están <strong>ocultas</strong> para cada rol. En <strong>Usuarios y roles</strong> podés
        sumar ocultaciones <strong>extra por cuenta</strong> (se unen con las del rol). Si al guardar ves error de tabla
        inexistente, ejecutá primero el SQL «Menú por rol» en Supabase (<code>SUPABASE.md</code> del proyecto).
      </p>
      <div className="columns is-multiline">
        {ROLES_META.map(({ id, label, help }) => (
          <div key={id} className="column is-12-tablet is-4-desktop">
            <p className="is-size-7 has-text-weight-semibold mb-1">{label}</p>
            <p className="is-size-7 has-text-grey mb-2">{help}</p>
            <div className="is-flex is-flex-direction-column" style={{ gap: '0.25rem' }}>
              {BLOCKABLE_NAV_KEYS.map((key) => (
                <label key={key} className="checkbox is-size-7">
                  <input type="checkbox" checked={(draft[id] || []).includes(key)} onChange={() => toggle(id, key)} />
                  {` Ocultar ${BLOCKABLE_LABELS[key] || key}`}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="button is-link is-small" disabled={saving} onClick={guardar}>
        {saving ? 'Guardando…' : 'Guardar menús por rol'}
      </button>
      {msg && <p className="notification is-success is-light is-size-7 py-2 px-3 mt-2 mb-0">{msg}</p>}
      {err && <p className="notification is-danger is-light is-size-7 py-2 px-3 mt-2 mb-0">{err}</p>}
    </div>
  )
}
