import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRoleNav } from '../context/RoleNavContext'
import { listProfilesForAdmin, adminUpdateUserRole, adminUpdateBlockedModules } from '../lib/profeDb'
import { BLOCKABLE_NAV_KEYS, BLOCKABLE_LABELS, roleHiddenKeys } from '../utils/navModules'

/** Usuarios, roles y módulos ocultos extra por cuenta (solo admin). */
export default function AdminUsersRolesSection({ onRowsLoaded }) {
  const { user } = useAuth()
  const { roleNavMap } = useRoleNav()
  const [rows, setRows] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setListLoading(true)
    setErr('')
    const { data, error } = await listProfilesForAdmin()
    setListLoading(false)
    if (error) {
      setErr(error.message || 'No se pudo cargar la lista.')
      setRows([])
      onRowsLoaded?.([])
      return
    }
    const list = data || []
    setRows(list)
    onRowsLoaded?.(list)
  }, [onRowsLoaded])

  useEffect(() => {
    load()
  }, [load])

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

  const guardarModulos = async (userId, bloqueadosExtras) => {
    setErr('')
    setMsg('')
    const { error } = await adminUpdateBlockedModules(userId, bloqueadosExtras)
    if (error) {
      setErr(error.message || 'No se pudieron guardar los módulos.')
      return
    }
    setMsg('Módulos actualizados.')
    await load()
  }

  return (
    <div className="box mb-4 py-3">
      <h2 className="title is-6 mb-2">Usuarios y roles</h2>
      <p className="is-size-7 has-text-grey mb-3">
        Asigná rol <strong>alumno</strong>, <strong>profe</strong> o <strong>admin</strong>. Las casillas ocultan pestañas{' '}
        <strong>además</strong> de lo definido en <strong>Menú por rol</strong>. Los administradores en la app siempre ven
        todas las pestañas.
      </p>
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
                <th>Ocultar en el menú (extra)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <FilaUsuario
                  key={r.id}
                  row={r}
                  actualUserId={user?.id}
                  roleNavMap={roleNavMap}
                  onGuardarRol={guardarRol}
                  onGuardarModulos={guardarModulos}
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

function unionRoleAndUserExtras(role, extras, roleNavMap) {
  return new Set(
    [...roleHiddenKeys(role, roleNavMap), ...(Array.isArray(extras) ? extras : [])].filter(Boolean)
  )
}

function extrasOnlyFromSelection(rol, bloqueadosSet, roleNavMap) {
  const roleKeys = new Set(roleHiddenKeys(rol, roleNavMap))
  return [...bloqueadosSet].filter((k) => !roleKeys.has(k))
}

function FilaUsuario({ row, actualUserId, roleNavMap, onGuardarRol, onGuardarModulos }) {
  const [rol, setRol] = useState(row.role || 'alumno')
  const [bloqueados, setBloqueados] = useState(() => unionRoleAndUserExtras(row.role || 'alumno', row.blocked_modules, roleNavMap))

  useEffect(() => {
    const r = row.role || 'alumno'
    setRol(r)
    setBloqueados(unionRoleAndUserExtras(r, row.blocked_modules, roleNavMap))
  }, [row.role, row.id, JSON.stringify(row.blocked_modules || []), JSON.stringify(roleNavMap)])

  const toggleMod = (key) => {
    setBloqueados((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  const bloqueadosExtrasParaGuardar = () => extrasOnlyFromSelection(rol, bloqueados, roleNavMap)

  const modBloqueadoPorRol = (key) => rol !== 'admin' && roleHiddenKeys(rol, roleNavMap).includes(key)

  return (
    <tr>
      <td>{row.email || '—'}</td>
      <td className="has-text-grey">{(row.full_name || '').trim() || '—'}</td>
      <td>
        <div className="select is-small">
          <select
            value={rol}
            onChange={(e) => {
              const v = e.target.value
              setRol(v)
              setBloqueados(unionRoleAndUserExtras(v, row.blocked_modules, roleNavMap))
            }}
          >
            <option value="alumno">alumno</option>
            <option value="profe">profe</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <button
          type="button"
          className="button is-small is-link is-light mt-1"
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
      </td>
      <td>
        <div className="is-flex is-flex-direction-column" style={{ gap: '0.25rem' }}>
          {BLOCKABLE_NAV_KEYS.map((key) => (
            <label
              key={key}
              className="checkbox is-size-7"
              title={
                modBloqueadoPorRol(key)
                  ? 'Definido por «Menú por rol»; cambialo ahí o desmarcá extras solo para esta cuenta.'
                  : undefined
              }
            >
              <input
                type="checkbox"
                checked={bloqueados.has(key)}
                onChange={() => toggleMod(key)}
                disabled={rol === 'admin' || modBloqueadoPorRol(key)}
              />
              {` ${BLOCKABLE_LABELS[key] || key}`}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="button is-small is-light mt-1"
          disabled={rol === 'admin'}
          onClick={() => onGuardarModulos(row.id, bloqueadosExtrasParaGuardar())}
        >
          Guardar menú
        </button>
      </td>
    </tr>
  )
}
