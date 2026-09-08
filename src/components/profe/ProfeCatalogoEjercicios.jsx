import { useMemo, useEffect } from 'react'
import { useStorage } from '../../hooks/useStorage'
import { applyProfeCatalogoSeedSync, catalogoItemNormalizado } from '../../utils/profeCatalogo'

function nuevoEj() {
  return { id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, nombre: '', notas: '' }
}

export default function ProfeCatalogoEjercicios({ busqueda = '' }) {
  const [items, setItems] = useStorage('profeCatalogoEjercicios', [])
  const [, setCatalogoMeta] = useStorage('profeCatalogoMeta', { seedVersion: 0 })

  useEffect(() => {
    applyProfeCatalogoSeedSync(setItems, setCatalogoMeta)
  }, [setItems, setCatalogoMeta])

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

  const puedeReordenar = !q

  const reordenarItems = (idDesde, idHasta) => {
    if (!idDesde || !idHasta || idDesde === idHasta) return
    setItems((prev) => {
      const arr = [...(Array.isArray(prev) ? prev : [])]
      const i = arr.findIndex((x) => x && x.id === idDesde)
      const j = arr.findIndex((x) => x && x.id === idHasta)
      if (i < 0 || j < 0) return prev
      const [row] = arr.splice(i, 1)
      arr.splice(j, 0, row)
      return arr
    })
  }

  return (
    <div className="pf-panel pf-catalogo-module mb-0">
      <header className="pf-catalogo-head">
        <div>
          <h2 className="pf-section-title mb-1">Catálogo de ejercicios</h2>
          <p className="pf-muted mb-0">
            Biblioteca de nombres para armar plantillas. Las notas técnicas son solo para vos; series y repeticiones se
            definen al montar cada día. Con búsqueda vacía podés reordenar arrastrando ⋮⋮.
          </p>
        </div>
        <button type="button" className="pf-btn pf-btn--primary pf-btn--sm" onClick={agregar}>
          + Agregar ejercicio
        </button>
      </header>

      {lista.length > 0 ? (
        <p className="pf-catalogo-count mb-3">
          {listaFiltrada.length === lista.length ? (
            <>
              <span className="pf-badge pf-badge--muted">{lista.length}</span>
              {lista.length === 1 ? ' ejercicio en el catálogo' : ' ejercicios en el catálogo'}
            </>
          ) : (
            <>
              Mostrando <strong>{listaFiltrada.length}</strong> de {lista.length} (filtro activo)
            </>
          )}
        </p>
      ) : null}

      {lista.length === 0 ? (
        <div className="pf-empty-state">
          <p className="mb-2">Cargando biblioteca inicial…</p>
          <p className="pf-muted mb-3">Si no aparece nada, tocá el botón para crear ejercicios manualmente.</p>
          <button type="button" className="pf-btn pf-btn--primary pf-btn--sm" onClick={agregar}>
            Crear el primero
          </button>
        </div>
      ) : listaFiltrada.length === 0 ? (
        <p className="pf-muted mb-0 has-text-centered py-4">No hay coincidencias con la búsqueda.</p>
      ) : (
        <ul className="pf-catalogo-list mb-0">
          {listaFiltrada.map((ex, index) => {
            const nombreParaAria = String(ex.nombre || '').trim()
            const ariaEliminar = nombreParaAria
              ? `Eliminar «${nombreParaAria}» del catálogo`
              : `Eliminar ejercicio ${index + 1} del catálogo`
            const payloadDrag = JSON.stringify({ id: ex.id })
            return (
              <li
                key={ex.id}
                className="pf-catalogo-row"
                style={{ touchAction: puedeReordenar ? 'none' : undefined }}
                onDragOver={
                  puedeReordenar
                    ? (e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                      }
                    : undefined
                }
                onDrop={
                  puedeReordenar
                    ? (e) => {
                        e.preventDefault()
                        let data
                        try {
                          data = JSON.parse(e.dataTransfer.getData('application/x-profe-cat') || '{}')
                        } catch {
                          return
                        }
                        if (data.id) reordenarItems(data.id, ex.id)
                      }
                    : undefined
                }
              >
                <div className="pf-catalogo-row-inner">
                  {puedeReordenar ? (
                    <span
                      className="pf-catalogo-drag"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-profe-cat', payloadDrag)
                        e.dataTransfer.setData('text/plain', payloadDrag)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      title="Arrastrá para reordenar"
                      aria-hidden
                    >
                      ⠿
                    </span>
                  ) : null}
                  <span className="pf-catalogo-num" aria-hidden>
                    {index + 1}
                  </span>
                  <label className="pf-field pf-field--inline mb-0">
                    <span>Nombre</span>
                    <input
                      id={`ex-nombre-${ex.id}`}
                      value={ex.nombre}
                      onChange={(e) => patch(ex.id, 'nombre', e.target.value)}
                      placeholder="Ej. Press banca"
                      autoComplete="off"
                    />
                  </label>
                  <label className="pf-field pf-field--inline mb-0">
                    <span>Notas (solo vos)</span>
                    <input
                      id={`ex-notas-${ex.id}`}
                      value={ex.notas || ''}
                      onChange={(e) => patch(ex.id, 'notas', e.target.value)}
                      placeholder="Técnica, series sugeridas, link…"
                      autoComplete="off"
                    />
                  </label>
                  <button
                    type="button"
                    className="pf-catalogo-del"
                    title="Quitar del catálogo"
                    aria-label={ariaEliminar}
                    onClick={() => eliminar(ex.id)}
                  >
                    ×
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
