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

const cardEjercicio = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'linear-gradient(165deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
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
    <div className="box py-4 px-4" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
      <div className="mb-4">
        <h2 className="title is-6 mb-2">Catálogo de ejercicios</h2>
        <p className="is-size-7 has-text-grey mb-0" style={{ maxWidth: '42rem', lineHeight: 1.5 }}>
          Nombres generales que armás acá; después los elegís al montar cada día de una plantilla. Las notas son solo
          para vos. Series y repeticiones las definís en <strong>Rutinas</strong> al armar el día.
        </p>
      </div>

      <div
        className="is-flex is-flex-wrap-wrap is-justify-content-space-between is-align-items-center mb-4"
        style={{ gap: '0.75rem' }}
      >
        {lista.length > 0 ? (
          <p className="is-size-7 has-text-grey mb-0">
            {listaFiltrada.length === lista.length ? (
              <>
                <span className="tag is-dark is-rounded mr-2">{lista.length}</span>
                {lista.length === 1 ? 'ejercicio en el catálogo' : 'ejercicios en el catálogo'}
              </>
            ) : (
              <>
                Mostrando <strong>{listaFiltrada.length}</strong> de {lista.length} (filtro activo)
              </>
            )}
          </p>
        ) : (
          <span />
        )}
        <button type="button" className="button is-link is-small" onClick={agregar}>
          + Agregar ejercicio
        </button>
      </div>

      {lista.length === 0 ? (
        <div
          className="py-5 px-4 has-text-centered"
          style={{
            borderRadius: 12,
            border: '1px dashed rgba(255,255,255,0.15)',
            background: 'rgba(0,0,0,0.15)',
          }}
        >
          <p className="is-size-6 has-text-grey mb-2">Todavía no hay ejercicios</p>
          <p className="is-size-7 has-text-grey mb-3">Creá al menos uno para poder armar rutinas.</p>
          <button type="button" className="button is-link is-small" onClick={agregar}>
            Crear el primero
          </button>
        </div>
      ) : listaFiltrada.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0 has-text-centered py-4">No hay coincidencias con la búsqueda.</p>
      ) : (
        <ul className="mb-0" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {listaFiltrada.map((ex, index) => {
            const nombreParaAria = String(ex.nombre || '').trim()
            const ariaEliminar = nombreParaAria
              ? `Eliminar «${nombreParaAria}» del catálogo`
              : `Eliminar ejercicio ${index + 1} del catálogo`
            return (
              <li key={ex.id} style={{ ...cardEjercicio, position: 'relative', padding: '1rem 2.75rem 1rem 1.125rem' }}>
                <button
                  type="button"
                  className="button is-small is-danger is-light"
                  title="Eliminar del catálogo"
                  aria-label={ariaEliminar}
                  onClick={() => eliminar(ex.id)}
                  style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    zIndex: 1,
                    borderRadius: 8,
                    minWidth: '2.25rem',
                  }}
                >
                  ×
                </button>

                <div className="columns is-variable is-2 is-multiline mb-0" style={{ rowGap: '0.75rem' }}>
                  <div className="column is-12-mobile is-6-tablet">
                    <div className="field mb-0">
                      <label
                        className="label is-size-7 mb-1 is-flex is-align-items-center"
                        htmlFor={`ex-nombre-${ex.id}`}
                        style={{ gap: '0.5rem' }}
                      >
                        <span
                          className="is-flex is-align-items-center is-justify-content-center has-text-weight-bold is-size-7"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 8,
                            flexShrink: 0,
                            background: 'rgba(72, 95, 199, 0.35)',
                            color: 'rgba(255,255,255,0.95)',
                          }}
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        Nombre
                      </label>
                      <input
                        id={`ex-nombre-${ex.id}`}
                        className="input is-small"
                        value={ex.nombre}
                        onChange={(e) => patch(ex.id, 'nombre', e.target.value)}
                        placeholder="Ej. Press banca"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="column is-12-mobile is-6-tablet">
                    <div className="field mb-0">
                      <label className="label is-size-7 mb-1" htmlFor={`ex-notas-${ex.id}`}>
                        Notas <span className="has-text-grey">(opcional, solo vos)</span>
                      </label>
                      <input
                        id={`ex-notas-${ex.id}`}
                        className="input is-small"
                        value={ex.notas || ''}
                        onChange={(e) => patch(ex.id, 'notas', e.target.value)}
                        placeholder="Técnica, series sugeridas, link…"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
