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
        <div className="table-container">
          <table className="table is-size-7 is-fullwidth">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Nombre y apellido</th>
                <th>Rol</th>
                <th>Ocultar en el menú</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => (
                <FilaUsuario
                  key={r.id}
                  row={r}
                  actualUserId={user?.id}
                  roleNavMap={roleNavMap}
                  onGuardarRol={guardarRol}
                  onGuardarModulos={guardarModulos}
                  onGuardarNombre={guardarNombre}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {msg && <p className="notification is-success is-light is-size-7 py-2 px-3 mt-2 mb-0">{msg}</p>}
      {err && <p className="notification is-danger is-light is-size-7 py-2 px-3 mt-2 mb-0">{err}</p>}
    </div>
  )
}

function FilaUsuario({ row, actualUserId, roleNavMap, onGuardarRol, onGuardarModulos, onGuardarNombre }) {
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

  const stackStyle = { display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '16rem' }

  return (
    <tr>
      <td style={{ verticalAlign: 'top', wordBreak: 'break-all' }}>{row.email || '—'}</td>
      <td style={{ verticalAlign: 'top' }}>
        <div style={stackStyle}>
          <input
            className="input is-small"
            style={{ width: '100%' }}
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
        </div>
      </td>
      <td style={{ verticalAlign: 'top' }}>
        <div style={stackStyle}>
          <div className="select is-small" style={{ width: '100%', display: 'block' }}>
            <select
              style={{ width: '100%', maxWidth: '100%' }}
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
        </div>
      </td>
      <td style={{ verticalAlign: 'top' }}>
        <div className="is-flex is-flex-direction-column" style={{ gap: '0.35rem', maxWidth: '18rem' }}>
          {BLOCKABLE_NAV_KEYS.map((key) => (
            <label key={key} className="checkbox is-size-7">
              <input
                type="checkbox"
                checked={bloqueados.has(key)}
                onChange={() => toggleMod(key)}
                disabled={rol === 'admin'}
              />
              {` Ocultar ${BLOCKABLE_LABELS[key] || key}`}
            </label>
          ))}
          <button
            type="button"
            className="button is-small is-light is-fullwidth"
            disabled={rol === 'admin'}
            onClick={() => onGuardarModulos(row.id, bloqueados, rol)}
          >
            Guardar menú
          </button>
        </div>
      </td>
    </tr>
  )
}
