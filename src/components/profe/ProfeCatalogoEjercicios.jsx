import { useMemo, useEffect } from 'react'
import { useStorage } from '../../hooks/useStorage'

function nuevoEj() {
  return { id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, nombre: '', notas: '' }
}

/** Solo nombre + notas en UI y al guardar (ignora series/reps heredadas de versiones viejas). */
function catalogoItemNormalizado(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null
  return {
    id: raw.id,
    nombre: raw.nombre != null ? String(raw.nombre) : '',
    notas: raw.notas != null ? String(raw.notas) : '',
  }
}

export default function ProfeCatalogoEjercicios({ busqueda = '' }) {
  const [items, setItems] = useStorage('profeCatalogoEjercicios', [])

  useEffect(() => {
    setItems((prev) => {
      if (!Array.isArray(prev)) return prev
      let changed = false
      const next = prev.map((x) => {
        if (!x || typeof x !== 'object') return x
        if (x.series != null || x.repeticiones != null) changed = true
        const n = catalogoItemNormalizado(x)
        return n || x
      })
      return changed ? next : prev
    })
  }, [setItems])

  const lista = useMemo(
    () => (Array.isArray(items) ? items : []).map((x) => catalogoItemNormalizado(x)).filter(Boolean),
    [items]
  )
  const q = (busqueda || '').trim().toLowerCase()
  const listaFiltrada = useMemo(() => {
    if (!q) return lista
    return lista.filter((ex) => {
      const nom = String(ex.nombre || '').toLowerCase()
      const notas = String(ex.notas || '').toLowerCase()
      return nom.includes(q) || notas.includes(q)
    })
  }, [lista, q])

  const agregar = () => setItems((prev) => [...(Array.isArray(prev) ? prev : []), nuevoEj()])

  const eliminar = (id) => {
    if (!window.confirm('¿Eliminar este ejercicio del catálogo?')) return
    setItems((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== id) : []))
  }

  const patch = (id, field, value) => {
    if (field !== 'nombre' && field !== 'notas') return
    setItems((prev) =>
      (Array.isArray(prev) ? prev : []).map((x) => {
        if (x.id !== id) return x
        const cur = catalogoItemNormalizado(x) || { id: x.id, nombre: '', notas: '' }
        return { ...cur, [field]: value }
      })
    )
  }

  return (
    <div className="box py-3">
      <h2 className="title is-6 mb-2">Catálogo de ejercicios</h2>
      <p className="is-size-7 has-text-grey mb-3">
        Nombres generales que armás acá; después los elegís al montar cada día de una plantilla. Las notas son solo
        para vos. Series y repeticiones las definís en <strong>Rutinas</strong> al armar el día.
      </p>
      <button type="button" className="button is-link is-small mb-3" onClick={agregar}>
        Agregar ejercicio
      </button>
      {lista.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0">Todavía no hay ejercicios. Agregá al menos uno para armar rutinas.</p>
      ) : listaFiltrada.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0">No hay coincidencias con la búsqueda.</p>
      ) : (
        <ul className="mb-0" style={{ listStyle: 'none', padding: 0 }}>
          {listaFiltrada.map((ex) => (
            <li
              key={ex.id}
              className="py-2 subtle-divider-b"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="is-flex is-align-items-stretch" style={{ gap: '0.5rem' }}>
                <div className="is-flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="field mb-2">
                    <label className="label is-size-7 mb-1">Nombre</label>
                    <input
                      className="input is-small"
                      value={ex.nombre}
                      onChange={(e) => patch(ex.id, 'nombre', e.target.value)}
                      placeholder="Ej: Press banca"
                    />
                  </div>
                  <div className="field mb-0">
                    <label className="label is-size-7 mb-1">Notas (solo vos; opcional)</label>
                    <input
                      className="input is-small"
                      value={ex.notas || ''}
                      onChange={(e) => patch(ex.id, 'notas', e.target.value)}
                      placeholder="Series, técnica, link…"
                    />
                  </div>
                </div>
                <div className="is-flex is-align-items-center" style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    className="button is-small is-danger is-light"
                    title="Eliminar del catálogo"
                    aria-label="Eliminar ejercicio"
                    onClick={() => eliminar(ex.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
