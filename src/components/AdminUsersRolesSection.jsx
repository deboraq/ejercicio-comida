import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRoleNav } from '../context/RoleNavContext'
import { adminUpdateUserRole, adminUpdateUserNavModules, adminUpdateUserFullName } from '../lib/profeDb'
import {
  BLOCKABLE_NAV_KEYS,
  BLOCKABLE_LABELS,
  adminHiddenCheckboxSet,
  toNavStorageFromHiddenSet,
} from '../utils/navModules'

/**
 * @param {Array} rows — filas desde el padre (Admin)
 * @param {boolean} loading
 * @param {() => Promise<void>} onReload — refrescar lista en el padre
 */
export default function AdminUsersRolesSection({ rows = [], loading = false, onReload }) {
  const { user } = useAuth()
  const { roleNavMap } = useRoleNav()
  const [busqueda, setBusqueda] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const q = busqueda.trim().toLowerCase()
  const filas = !q
    ? rows
    : rows.filter((r) => {
        const mail = (r.email || '').toLowerCase()
        const nom = (r.full_name || '').toLowerCase()
        const id = String(r.id || '').toLowerCase()
        return mail.includes(q) || nom.includes(q) || id.includes(q)
      })

  const guardarRol = async (userId, nuevoRol) => {
    setErr('')
    setMsg('')
    const { error } = await adminUpdateUserRole(userId, nuevoRol)
    if (error) {
      setErr(error.message || 'No se pudo guardar el rol.')
      return
    }
    setMsg('Rol actualizado.')
    await onReload?.()
  }

  const guardarModulos = async (userId, hiddenSet, rol) => {
    setErr('')
    setMsg('')
    const { blocked_modules, nav_force_visible } = toNavStorageFromHiddenSet(rol, hiddenSet, roleNavMap)
    const { error } = await adminUpdateUserNavModules(userId, blocked_modules, nav_force_visible)
    if (error) {
      setErr(error.message || 'No se pudieron guardar los módulos.')
      return
    }
    setMsg('Menú del usuario actualizado.')
    await onReload?.()
  }

  const guardarNombre = async (userId, fullName) => {
    setErr('')
    setMsg('')
    const { error } = await adminUpdateUserFullName(userId, fullName)
    if (error) {
      setErr(error.message || 'No se pudo guardar el nombre.')
      return
    }
    setMsg('Nombre actualizado.')
    await onReload?.()
  }

  return (
    <div className="box mb-4 py-3">
      <div className="field mb-3">
        <label className="label is-size-7">Buscar usuario</label>
        <input
          className="input is-small"
          type="search"
          placeholder="Correo, nombre o ID…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          autoComplete="off"
        />
      </div>
      {loading ? (
        <p className="is-size-7 has-text-grey mb-0">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0">{q ? 'No hay coincidencias.' : 'No hay usuarios.'}</p>
      ) : (
        <div className="is-flex is-flex-direction-column" style={{ gap: '0.75rem' }}>
          {filas.map((r) => (
            <TarjetaUsuario
              key={r.id}
              row={r}
              actualUserId={user?.id}
              roleNavMap={roleNavMap}
              onGuardarRol={guardarRol}
              onGuardarModulos={guardarModulos}
              onGuardarNombre={guardarNombre}
            />
          ))}
        </div>
      )}
      {msg && <p className="notification is-success is-light is-size-7 py-2 px-3 mt-2 mb-0">{msg}</p>}
      {err && <p className="notification is-danger is-light is-size-7 py-2 px-3 mt-2 mb-0">{err}</p>}
    </div>
  )
}

function TarjetaUsuario({ row, actualUserId, roleNavMap, onGuardarRol, onGuardarModulos, onGuardarNombre }) {
  const [rol, setRol] = useState(row.role || 'alumno')
  const [nombre, setNombre] = useState(() => (row.full_name || '').trim())
  const [bloqueados, setBloqueados] = useState(() =>
    adminHiddenCheckboxSet(row.role || 'alumno', row.blocked_modules, row.nav_force_visible, roleNavMap)
  )

  useEffect(() => {
    const r = row.role || 'alumno'
    setRol(r)
    setNombre((row.full_name || '').trim())
    setBloqueados(adminHiddenCheckboxSet(r, row.blocked_modules, row.nav_force_visible, roleNavMap))
  }, [
    row.role,
    row.id,
    row.full_name,
    JSON.stringify(row.blocked_modules || []),
    JSON.stringify(row.nav_force_visible || []),
    JSON.stringify(roleNavMap),
  ])

  const nombreGuardado = (row.full_name || '').trim()
  const nombreCambio = nombre !== nombreGuardado

  const toggleMod = (key) => {
    setBloqueados((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  const bloqueCampo = (
    <>
      <input
        className="input is-small"
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Ej. Ana García"
        autoComplete="off"
      />
      <button
        type="button"
        className="button is-small is-link is-light is-fullwidth"
        disabled={!nombreCambio}
        onClick={() => onGuardarNombre(row.id, nombre)}
      >
        Guardar nombre
      </button>
    </>
  )

  const bloqueRol = (
    <>
      <div className="select is-small" style={{ width: '100%', display: 'block' }}>
        <select
          style={{ width: '100%' }}
          value={rol}
          onChange={(e) => {
            const v = e.target.value
            setRol(v)
            setBloqueados(adminHiddenCheckboxSet(v, row.blocked_modules, row.nav_force_visible, roleNavMap))
          }}
        >
          <option value="alumno">alumno</option>
          <option value="profe">profe</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <button
        type="button"
        className="button is-small is-link is-light is-fullwidth"
        disabled={rol === row.role}
        onClick={() => {
          if (row.id === actualUserId && row.role === 'admin' && rol !== 'admin') {
            if (!window.confirm('¿Sacarte el rol admin? Perderás acceso a esta sección.')) return
          }
          onGuardarRol(row.id, rol)
        }}
      >
        Guardar rol
      </button>
    </>
  )

  return (
    <article
      className="box py-3 px-3 mb-0"
      style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'rgba(0,0,0,0.15)' }}
    >
      <p className="is-size-7 has-text-weight-semibold mb-1">Correo</p>
      <p className="is-size-7 mb-3" style={{ wordBreak: 'break-all' }}>
        {row.email || '—'}
      </p>

      <div className="columns is-multiline is-variable is-2">
        <div className="column is-12-mobile is-6-tablet is-4-desktop">
          <p className="is-size-7 has-text-weight-semibold mb-2">Nombre y apellido</p>
          <div className="is-flex is-flex-direction-column" style={{ gap: '0.5rem' }}>
            {bloqueCampo}
          </div>
        </div>
        <div className="column is-12-mobile is-6-tablet is-4-desktop">
          <p className="is-size-7 has-text-weight-semibold mb-2">Rol</p>
          <div className="is-flex is-flex-direction-column" style={{ gap: '0.5rem' }}>
            {bloqueRol}
          </div>
        </div>
        <div className="column is-12-mobile is-12-tablet is-4-desktop">
          <p className="is-size-7 has-text-weight-semibold mb-2">Ocultar en el menú</p>
          <div className="is-flex is-flex-direction-column mb-2" style={{ gap: '0.15rem' }}>
            {BLOCKABLE_NAV_KEYS.map((key) => (
              <label
                key={key}
                className="checkbox is-size-7"
                style={{ display: 'block', padding: '0.2rem 0', lineHeight: 1.4 }}
              >
                <input
                  type="checkbox"
                  checked={bloqueados.has(key)}
                  onChange={() => toggleMod(key)}
                  disabled={rol === 'admin'}
                />
                {` Ocultar ${BLOCKABLE_LABELS[key] || key}`}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="button is-small is-link is-light is-fullwidth"
            disabled={rol === 'admin'}
            onClick={() => onGuardarModulos(row.id, bloqueados, rol)}
          >
            Guardar menú
          </button>
        </div>
      </div>
    </article>
  )
}
