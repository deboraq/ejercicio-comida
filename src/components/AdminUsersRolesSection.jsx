import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { listProfilesForAdmin, adminUpdateUserRole, adminUpdateBlockedModules } from '../lib/profeDb'
import { BLOCKABLE_NAV_KEYS, BLOCKABLE_LABELS, COACH_DEFAULT_HIDDEN_NAV } from '../utils/navModules'

/** Usuarios, roles y módulos ocultos (solo cuenta admin). */
export default function AdminUsersRolesSection({ onRowsLoaded }) {
  const { user } = useAuth()
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

  const guardarModulos = async (userId, bloqueados) => {
    setErr('')
    setMsg('')
    const { error } = await adminUpdateBlockedModules(userId, bloqueados)
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
        Asigná rol <strong>alumno</strong>, <strong>profe</strong> o <strong>admin</strong>. Podés ocultar pestañas del menú por usuario; los administradores siempre ven todo. Los entrenadores no ven{' '}
        <strong>Ejercicios</strong> ni <strong>Comida</strong> por defecto (enfoque en <strong>Profe</strong> y alumnos).
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
                <th>Ocultar en el menú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <FilaUsuario
                  key={r.id}
                  row={r}
                  actualUserId={user?.id}
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

function mergeProfeDefaults(role, modules) {
  const s = new Set(Array.isArray(modules) ? modules : [])
  if (role === 'profe') COACH_DEFAULT_HIDDEN_NAV.forEach((k) => s.add(k))
  return s
}

function FilaUsuario({ row, actualUserId, onGuardarRol, onGuardarModulos }) {
  const [rol, setRol] = useState(row.role || 'alumno')
  const [bloqueados, setBloqueados] = useState(() => mergeProfeDefaults(row.role || 'alumno', row.blocked_modules))

  useEffect(() => {
    const r = row.role || 'alumno'
    setRol(r)
    setBloqueados(mergeProfeDefaults(r, row.blocked_modules))
  }, [row.role, row.id, JSON.stringify(row.blocked_modules || [])])

  const toggleMod = (key) => {
    setBloqueados((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  const bloqueadosArr = () => {
    const arr = [...bloqueados]
    if (rol === 'profe') return [...new Set([...arr, ...COACH_DEFAULT_HIDDEN_NAV])]
    return arr
  }

  const modBloqueadoCoach = (key) => rol === 'profe' && COACH_DEFAULT_HIDDEN_NAV.includes(key)

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
              setBloqueados(mergeProfeDefaults(v, row.blocked_modules))
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
            <label key={key} className="checkbox is-size-7" title={modBloqueadoCoach(key) ? 'Oculto por defecto para entrenadores' : undefined}>
              <input
                type="checkbox"
                checked={bloqueados.has(key) || modBloqueadoCoach(key)}
                onChange={() => toggleMod(key)}
                disabled={rol === 'admin' || modBloqueadoCoach(key)}
              />
              {` ${BLOCKABLE_LABELS[key] || key}`}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="button is-small is-light mt-1"
          disabled={rol === 'admin'}
          onClick={() => onGuardarModulos(row.id, bloqueadosArr())}
        >
          Guardar menú
        </button>
      </td>
    </tr>
  )
}
