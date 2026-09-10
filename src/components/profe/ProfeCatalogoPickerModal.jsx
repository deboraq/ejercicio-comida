import { useEffect, useMemo, useState } from 'react'
import {
  agregarCategoriaCustom,
  buildCategoriasModalList,
  CATEGORIAS_BASE,
  contarCatalogoPorCategoria,
  crearEjercicioCatalogo,
  eliminarCategoriaCustom,
  eliminarEjercicioCatalogo,
  esCategoriaCustom,
  esCategoriaEliminable,
  filtrarCatalogo,
  getCategoriaCatalogo,
  moverCategoriaCustom,
  reordenarCatalogoItems,
  toggleFavoritoCatalogo,
} from '../../utils/profeCatalogo'
import { grupoMuscularTone } from './profeCatalogoUi'

export default function ProfeCatalogoPickerModal({
  open,
  dayLabel = 'Día 1',
  dayTone = 0,
  items = [],
  setItems,
  favoritos = [],
  setFavoritos,
  categoriasCustom = [],
  setCategoriasCustom,
  initialQ = '',
  onClose,
  onApply,
  onToast,
}) {
  const [q, setQ] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [panelAgregar, setPanelAgregar] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoNotas, setNuevoNotas] = useState('')
  const [nuevoCat, setNuevoCat] = useState('')
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [modoNuevaCat, setModoNuevaCat] = useState(false)
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null)

  useEffect(() => {
    if (!open) return
    setQ(initialQ || '')
    setCategoria('Todos')
    setSelectedIds(new Set())
    setPanelAgregar(false)
    setNuevoNombre('')
    setNuevoNotas('')
    setNuevoCat('')
    setNuevaCategoria('')
    setModoNuevaCat(false)
    setConfirmDeleteCat(null)
  }, [open, initialQ])

  const categoriasLista = useMemo(
    () => buildCategoriasModalList(categoriasCustom, items),
    [categoriasCustom, items],
  )

  const opcionesSelectCat = useMemo(
    () => categoriasLista.filter((c) => c.id !== 'Todos' && c.id !== 'Favoritos'),
    [categoriasLista],
  )

  const categoriaPreview = useMemo(() => {
    if (modoNuevaCat && nuevaCategoria.trim()) return nuevaCategoria.trim()
    if (nuevoCat) return nuevoCat
    if (nuevoNombre.trim()) {
      const inf = getCategoriaCatalogo({ nombre: nuevoNombre.trim() })
      return inf !== 'Funcional' ? inf : 'Funcional'
    }
    return ''
  }, [modoNuevaCat, nuevaCategoria, nuevoCat, nuevoNombre])

  const counts = useMemo(
    () => contarCatalogoPorCategoria(items, favoritos),
    [items, favoritos],
  )

  const filtrados = useMemo(
    () => filtrarCatalogo(items, { q, categoria, favoritos }),
    [items, q, categoria, favoritos],
  )

  const agrupados = useMemo(() => {
    if (categoria !== 'Todos' || q.trim()) return null
    const map = new Map()
    for (const item of filtrados) {
      const cat = getCategoriaCatalogo(item)
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(item)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [filtrados, categoria, q])

  if (!open) return null

  const favSet = new Set(favoritos || [])

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const seleccionarVisibles = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const item of filtrados) next.add(item.id)
      return next
    })
  }

  const limpiarSeleccion = () => setSelectedIds(new Set())

  const resetClose = () => {
    setSelectedIds(new Set())
    setQ('')
    setCategoria('Todos')
    setPanelAgregar(false)
    onClose?.()
  }

  const handleApply = () => {
    const picked = items.filter((c) => selectedIds.has(c.id))
    if (picked.length) onApply?.(picked)
    resetClose()
  }

  const guardarNuevoEjercicio = () => {
    if (modoNuevaCat && !nuevaCategoria.trim()) {
      onToast?.({ err: 'Escribí el nombre de la nueva categoría o elegí una existente.' })
      return
    }
    const draft = crearEjercicioCatalogo({
      nombre: nuevoNombre,
      categoria: modoNuevaCat ? '' : nuevoCat,
      nuevaCategoria: modoNuevaCat ? nuevaCategoria : '',
      notas: nuevoNotas,
    })
    if (!draft) {
      onToast?.({ err: 'Escribí un nombre para el ejercicio.' })
      return
    }
    const { _resolved, ...ej } = draft
    if (_resolved?.esNueva) {
      const inBase = CATEGORIAS_BASE.some((c) => c.toLowerCase() === _resolved.categoria.toLowerCase())
      if (!inBase) {
        const res = agregarCategoriaCustom(setCategoriasCustom, _resolved.categoria)
        if (!res.ok) {
          onToast?.({ err: res.error || 'No se pudo crear la categoría.' })
          return
        }
      }
      setNuevoCat(_resolved.categoria)
      setModoNuevaCat(false)
      setNuevaCategoria('')
    }
    setItems?.((prev) => [...(Array.isArray(prev) ? prev : []), ej])
    setSelectedIds((prev) => new Set(prev).add(ej.id))
    setNuevoNombre('')
    setNuevoNotas('')
    onToast?.({
      msg: `«${ej.nombre}» guardado en ${ej.categoria}${_resolved?.inferida ? ' (auto por nombre)' : ''}.`,
    })
  }

  const borrarEjercicio = (item) => {
    const nom = String(item?.nombre || '').trim()
    if (!window.confirm(`¿Eliminar «${nom || 'ejercicio'}» del catálogo?`)) return
    eliminarEjercicioCatalogo(setItems, setFavoritos, item.id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(item.id)
      return next
    })
    onToast?.({ msg: 'Ejercicio eliminado del catálogo.' })
  }

  const borrarCategoria = (catId) => {
    if (!esCategoriaEliminable(catId)) {
      onToast?.({ err: 'Las categorías base no se pueden eliminar.' })
      return
    }
    setConfirmDeleteCat(catId)
  }

  const confirmarBorrarCategoria = () => {
    const catId = confirmDeleteCat
    if (!catId) return
    const res = eliminarCategoriaCustom(setCategoriasCustom, setItems, catId)
    setConfirmDeleteCat(null)
    if (!res.ok) {
      onToast?.({ err: res.error || 'No se pudo eliminar.' })
      return
    }
    if (categoria === catId) setCategoria('Todos')
    onToast?.({ msg: `Categoría «${catId}» eliminada.` })
  }

  const renderItem = (item) => {
    const cat = getCategoriaCatalogo(item)
    const on = selectedIds.has(item.id)
    const esFav = favSet.has(item.id)
    const payload = JSON.stringify({ id: item.id })
    return (
      <li
        key={item.id}
        className={`pf-cat-pick-row${on ? ' is-selected' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(e) => {
          e.preventDefault()
          let data
          try {
            data = JSON.parse(e.dataTransfer.getData('application/x-pf-cat-item') || '{}')
          } catch {
            return
          }
          if (data.id) reordenarCatalogoItems(setItems, data.id, item.id)
        }}
      >
        <span
          className="pf-cat-pick-drag"
          draggable
          title="Arrastrá para reordenar"
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-pf-cat-item', payload)
            e.dataTransfer.setData('text/plain', payload)
            e.dataTransfer.effectAllowed = 'move'
          }}
        >
          ::
        </span>
        <button type="button" className="pf-cat-pick-item" onClick={() => toggle(item.id)}>
          <span className={`pf-cat-pick-check${on ? ' is-on' : ''}`} aria-hidden>
            {on ? '✓' : ''}
          </span>
          <span className="pf-cat-pick-item-body">
            <span className="pf-cat-pick-item-name">{item.nombre}</span>
            {item.notas ? <span className="pf-cat-pick-item-note">{item.notas}</span> : null}
          </span>
          <span className={`pf-cat-pick-tag pf-ws-muscle--${grupoMuscularTone(cat)}`}>{cat}</span>
        </button>
        <button
          type="button"
          className={`pf-cat-pick-fav${esFav ? ' is-on' : ''}`}
          aria-label={esFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          onClick={() => toggleFavoritoCatalogo(setFavoritos, item.id)}
        >
          {esFav ? '★' : '☆'}
        </button>
        <button
          type="button"
          className="pf-cat-pick-del"
          aria-label={`Eliminar ${item.nombre}`}
          title="Eliminar del catálogo"
          onClick={() => borrarEjercicio(item)}
        >
          ×
        </button>
      </li>
    )
  }

  return (
    <div className={`modal is-active pf-cat-pick-modal pf-cat-pick-day-tone-${Number(dayTone) % 6}`}>
      <button type="button" className="modal-background" aria-label="Cerrar catálogo" onClick={resetClose} />
      <div className={`modal-card pf-cat-pick-card pf-cat-pick-day-tone-${Number(dayTone) % 6}`}>
        <header className="modal-card-head pf-cat-pick-head">
          <div>
            <p className="modal-card-title pf-cat-pick-title">Ver catálogo</p>
            <p className="pf-cat-pick-sub mb-0">
              Explorá, reordená (::), eliminá, marcá favoritos y sumá al <strong>{dayLabel}</strong>.
            </p>
          </div>
          <button type="button" className="delete" aria-label="Cerrar" onClick={resetClose} />
        </header>

        <section className="modal-card-body pf-cat-pick-body">
          <div className="pf-cat-pick-toolbar">
            <div className="pf-cat-pick-search-wrap">
              <span className="pf-ws-search-icon" aria-hidden>
                ⌕
              </span>
              <input
                type="search"
                className="pf-cat-pick-search"
                placeholder="Buscar por nombre, categoría o nota…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
            <div className="pf-cat-pick-toolbar-actions">
              <button
                type="button"
                className={`pf-btn pf-btn--sm${panelAgregar ? ' pf-btn--primary' : ' pf-btn--outline'}`}
                onClick={() => setPanelAgregar((v) => !v)}
              >
                <span className="pf-cat-tool-label pf-cat-tool-label--long">+ Agregar ejercicio</span>
                <span className="pf-cat-tool-label pf-cat-tool-label--short">+ Agregar</span>
              </button>
              <button type="button" className="pf-btn pf-btn--outline pf-btn--sm" onClick={seleccionarVisibles}>
                <span className="pf-cat-tool-label pf-cat-tool-label--long">Marcar visibles</span>
                <span className="pf-cat-tool-label pf-cat-tool-label--short">Marcar todos</span>
              </button>
              <button
                type="button"
                className="pf-btn pf-btn--outline pf-btn--sm"
                onClick={limpiarSeleccion}
                disabled={selectedIds.size === 0}
              >
                Limpiar
              </button>
            </div>
          </div>

          {panelAgregar ? (
            <div className="pf-cat-pick-add-panel">
              <div className="pf-cat-pick-add-grid">
                <label className="pf-cat-pick-field pf-cat-pick-field--half">
                  <span>Nombre</span>
                  <input
                    className="pf-cat-pick-control"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    placeholder="Ej. Press inclinado con mancuernas"
                  />
                </label>
                <label className="pf-cat-pick-field pf-cat-pick-field--half">
                  <span>Categoría</span>
                  {modoNuevaCat ? (
                    <input
                      className="pf-cat-pick-control"
                      value={nuevaCategoria}
                      onChange={(e) => setNuevaCategoria(e.target.value)}
                      placeholder="Nombre de la nueva categoría"
                    />
                  ) : (
                    <select className="pf-cat-pick-control" value={nuevoCat} onChange={(e) => setNuevoCat(e.target.value)}>
                      <option value="">Auto por nombre</option>
                      {opcionesSelectCat.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <p className="pf-cat-pick-auto-hint mb-0">
                  <strong>Auto por nombre</strong> deduce la categoría del título (ej. «Press banca» → Pecho). Si no
                  coincide, usa Funcional. Elegí una categoría manualmente o creá una nueva.
                  {!modoNuevaCat && !nuevoCat && nuevoNombre.trim() && categoriaPreview ? (
                    <> Vista previa: <strong>{categoriaPreview}</strong>.</>
                  ) : null}
                </p>
                <label className="pf-cat-pick-field pf-cat-pick-field--wide">
                  <span>Notas (opcional)</span>
                  <input
                    className="pf-cat-pick-control"
                    value={nuevoNotas}
                    onChange={(e) => setNuevoNotas(e.target.value)}
                    placeholder="Técnica, variantes, link…"
                  />
                </label>
              </div>
              <div className="pf-cat-pick-add-actions">
                <button type="button" className="pf-btn pf-btn--primary pf-btn--sm" onClick={guardarNuevoEjercicio}>
                  Guardar en catálogo
                </button>
                {!modoNuevaCat ? (
                  <button type="button" className="pf-btn pf-btn--outline pf-btn--sm" onClick={() => { setModoNuevaCat(true); setNuevoCat(''); setNuevaCategoria('') }}>
                    + Nueva categoría
                  </button>
                ) : (
                  <button type="button" className="pf-btn pf-btn--outline pf-btn--sm" onClick={() => { setModoNuevaCat(false); setNuevaCategoria('') }}>
                    Usar categoría existente
                  </button>
                )}
              </div>
            </div>
          ) : null}

          <div className="pf-cat-pick-layout">
            <nav className="pf-cat-pick-cats" aria-label="Categorías">
              {categoriasLista.map((cat) => {
                const n = counts[cat.id] ?? 0
                if (cat.id !== 'Todos' && cat.id !== 'Favoritos' && n === 0) return null
                const custom = esCategoriaCustom(cat.id, categoriasCustom)
                const eliminable = esCategoriaEliminable(cat.id)
                const customIdx = custom
                  ? categoriasCustom.findIndex((c) => String(c).toLowerCase() === cat.id.toLowerCase())
                  : -1
                return (
                  <div key={cat.id} className={`pf-cat-pick-cat-row${categoria === cat.id ? ' is-active-row' : ''}`}>
                    <button
                      type="button"
                      className={`pf-cat-pick-cat${categoria === cat.id ? ' is-active' : ''}${cat.id === 'Favoritos' ? ' pf-cat-pick-cat--fav' : ''}`}
                      onClick={() => setCategoria(cat.id)}
                    >
                      <span>{cat.id === 'Favoritos' ? '★ Favoritos' : cat.label}</span>
                      <span className="pf-cat-pick-cat-n">{n}</span>
                    </button>
                    {custom ? (
                      <div className="pf-cat-pick-cat-tools">
                        <button
                          type="button"
                          className="pf-cat-pick-cat-tool"
                          disabled={customIdx <= 0}
                          aria-label="Subir categoría"
                          onClick={() => moverCategoriaCustom(setCategoriasCustom, cat.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="pf-cat-pick-cat-tool"
                          disabled={customIdx < 0 || customIdx >= categoriasCustom.length - 1}
                          aria-label="Bajar categoría"
                          onClick={() => moverCategoriaCustom(setCategoriasCustom, cat.id, 1)}
                        >
                          ↓
                        </button>
                        {eliminable ? (
                          <button
                            type="button"
                            className="pf-cat-pick-cat-tool pf-cat-pick-cat-tool--del"
                            aria-label={`Eliminar categoría ${cat.label}`}
                            onClick={() => borrarCategoria(cat.id)}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    ) : eliminable ? (
                      <div className="pf-cat-pick-cat-tools">
                        <button
                          type="button"
                          className="pf-cat-pick-cat-tool pf-cat-pick-cat-tool--del"
                          aria-label={`Eliminar categoría ${cat.label}`}
                          onClick={() => borrarCategoria(cat.id)}
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </nav>

            <div className="pf-cat-pick-main">
              <div className="pf-cat-pick-main-head">
                <span>
                  {filtrados.length} ejercicio{filtrados.length === 1 ? '' : 's'}
                  {selectedIds.size > 0 ? ` · ${selectedIds.size} seleccionado${selectedIds.size === 1 ? '' : 's'}` : ''}
                </span>
                <span className="pf-cat-pick-main-hint">Arrastrá :: para reordenar · × para eliminar</span>
              </div>

              {filtrados.length === 0 ? (
                <p className="pf-cat-pick-empty mb-0">
                  {categoria === 'Favoritos'
                    ? 'Todavía no tenés favoritos. Tocá la estrella en un ejercicio.'
                    : 'No hay coincidencias. Probá otra categoría, buscá otro término o agregá uno nuevo.'}
                </p>
              ) : agrupados ? (
                agrupados.map(([cat, list]) => (
                  <section key={cat} className="pf-cat-pick-group">
                    <h4 className="pf-cat-pick-group-title">{cat}</h4>
                    <ul className="pf-cat-pick-list">{list.map(renderItem)}</ul>
                  </section>
                ))
              ) : (
                <ul className="pf-cat-pick-list">{filtrados.map(renderItem)}</ul>
              )}
            </div>
          </div>
        </section>

        <footer className="modal-card-foot pf-cat-pick-foot">
          <button type="button" className="button is-light" onClick={resetClose}>
            Cancelar
          </button>
          <button type="button" className="button is-link" onClick={handleApply} disabled={selectedIds.size === 0}>
            Sumar {selectedIds.size > 0 ? selectedIds.size : ''} al {dayLabel}
          </button>
        </footer>
      </div>

      {confirmDeleteCat ? (
        <div className="pf-cat-pick-confirm" role="dialog" aria-modal="true" aria-labelledby="pf-cat-pick-confirm-title">
          <button type="button" className="pf-cat-pick-confirm-back" aria-label="Cerrar" onClick={() => setConfirmDeleteCat(null)} />
          <div className="pf-cat-pick-confirm-card">
            <p id="pf-cat-pick-confirm-title" className="pf-cat-pick-confirm-title">
              ¿Eliminar la categoría «{confirmDeleteCat}»?
            </p>
            <p className="pf-cat-pick-confirm-text mb-0">Sus ejercicios pasan a Funcional.</p>
            <div className="pf-cat-pick-confirm-actions">
              <button type="button" className="pf-btn pf-btn--outline pf-btn--sm" onClick={() => setConfirmDeleteCat(null)}>
                Cancelar
              </button>
              <button type="button" className="pf-btn pf-btn--primary pf-btn--sm" onClick={confirmarBorrarCategoria}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
