import { inferirGrupoMuscular } from './rutinaEjercicioDia'
import {
  buildProfeCatalogoSeed,
  CATALOGO_SEED_VERSION,
  CATEGORIAS_BASE,
  CATEGORIAS_RESERVADAS,
} from '../data/profeCatalogoSeed'

export { CATEGORIAS_BASE, CATALOGO_SEED_VERSION }

export function newCatalogoEjercicioId() {
  return `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Solo nombre + notas + categoría opcional (ignora series/reps heredadas). */
export function catalogoItemNormalizado(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null
  return {
    id: raw.id,
    nombre: raw.nombre != null ? String(raw.nombre) : '',
    notas: raw.notas != null ? String(raw.notas) : '',
    categoria: raw.categoria != null ? String(raw.categoria).trim() : '',
  }
}

export function getCategoriaCatalogo(item) {
  const explicit = String(item?.categoria || '').trim()
  if (explicit) return explicit
  const g = inferirGrupoMuscular(item?.nombre)
  if (g === 'Bíceps' || g === 'Tríceps') return 'Brazos'
  if (g === 'Calentamiento') return 'Calentamiento'
  return g === 'Otro' ? 'Funcional' : g
}

export function normalizarNombreCategoria(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40)
}

export function categoriaEsValida(raw) {
  const n = normalizarNombreCategoria(raw)
  if (!n) return false
  if (CATEGORIAS_RESERVADAS.some((r) => r.toLowerCase() === n.toLowerCase())) return false
  return true
}

/** Lista completa de categorías para sidebar y selects. */
export function buildCategoriasModalList(customCategories = [], items = []) {
  const customOrdered = (customCategories || [])
    .map((c) => normalizarNombreCategoria(c))
    .filter((n) => n && categoriaEsValida(n))

  const seen = new Set(customOrdered.map((c) => c.toLowerCase()))
  const fromItems = []
  for (const item of items || []) {
    const n = getCategoriaCatalogo(item)
    if (!categoriaEsValida(n)) continue
    const key = n.toLowerCase()
    if (seen.has(key)) continue
    if (CATEGORIAS_BASE.some((b) => b.toLowerCase() === key)) continue
    seen.add(key)
    fromItems.push(n)
  }
  fromItems.sort((a, b) => a.localeCompare(b, 'es'))

  const baseRest = [...CATEGORIAS_BASE]
    .filter((b) => !seen.has(b.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'es'))

  const merged = [...customOrdered, ...baseRest, ...fromItems]

  return [
    { id: 'Favoritos', label: 'Favoritos' },
    { id: 'Todos', label: 'Todos' },
    ...merged.map((label) => ({ id: label, label })),
  ]
}

export function esCategoriaCustom(nombre, customCategories = []) {
  const n = normalizarNombreCategoria(nombre).toLowerCase()
  if (!n) return false
  if (CATEGORIAS_RESERVADAS.some((r) => r.toLowerCase() === n)) return false
  if (CATEGORIAS_BASE.some((b) => b.toLowerCase() === n)) return false
  return (customCategories || []).some((c) => String(c).toLowerCase() === n)
}

/** Categorías que el usuario puede borrar (no base ni reservadas). */
export function esCategoriaEliminable(nombre) {
  const n = normalizarNombreCategoria(nombre).toLowerCase()
  if (!n) return false
  if (CATEGORIAS_RESERVADAS.some((r) => r.toLowerCase() === n)) return false
  if (CATEGORIAS_BASE.some((b) => b.toLowerCase() === n)) return false
  return true
}

function itemCoincideCategoria(item, catName) {
  const target = normalizarNombreCategoria(catName).toLowerCase()
  if (!target) return false
  const explicit = String(item?.categoria || '').trim().toLowerCase()
  if (explicit) return explicit === target
  return getCategoriaCatalogo(item).toLowerCase() === target
}

export function eliminarEjercicioCatalogo(setItems, setFavoritos, id) {
  if (!id) return
  setItems?.((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x?.id !== id))
  setFavoritos?.((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x !== id))
}

export function eliminarCategoriaCustom(setCategorias, setItems, nombre) {
  const n = normalizarNombreCategoria(nombre)
  if (!n) return { ok: false, error: 'Categoría inválida.' }
  if (!esCategoriaEliminable(n)) {
    return { ok: false, error: 'Las categorías base no se pueden eliminar.' }
  }

  if (typeof setCategorias === 'function') {
    setCategorias((prev) =>
      (Array.isArray(prev) ? prev : []).filter((c) => String(c).toLowerCase() !== n.toLowerCase()),
    )
  }

  if (typeof setItems === 'function') {
    setItems((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) => {
        if (!itemCoincideCategoria(item, n)) return item
        return { ...item, categoria: 'Funcional' }
      }),
    )
  } else {
    return { ok: false, error: 'No se pudo actualizar el catálogo.' }
  }

  return { ok: true }
}

export function moverCategoriaCustom(setCategorias, nombre, delta) {
  const n = normalizarNombreCategoria(nombre).toLowerCase()
  setCategorias?.((prev) => {
    const arr = [...(Array.isArray(prev) ? prev : [])]
    const i = arr.findIndex((c) => String(c).toLowerCase() === n)
    if (i < 0) return prev
    const j = i + delta
    if (j < 0 || j >= arr.length) return prev
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    return arr
  })
}

export function reordenarCatalogoItems(setItems, idDesde, idHasta) {
  if (!idDesde || !idHasta || idDesde === idHasta) return
  setItems?.((prev) => {
    const arr = [...(Array.isArray(prev) ? prev : [])]
    const i = arr.findIndex((x) => x?.id === idDesde)
    const j = arr.findIndex((x) => x?.id === idHasta)
    if (i < 0 || j < 0) return prev
    const [row] = arr.splice(i, 1)
    arr.splice(j, 0, row)
    return arr
  })
}

export function applyProfeCatalogoSeedSync(setItems, setMeta) {
  const syncItems = (prev, seedVersion) => {
    const arr = Array.isArray(prev) ? prev : []
    const named = arr.filter((x) => String(x?.nombre || '').trim())
    const seed = buildProfeCatalogoSeed()
    const userItems = named.filter((x) => !String(x.id || '').startsWith('seed_'))

    if (named.length === 0) return seed
    if (seedVersion < CATALOGO_SEED_VERSION) return [...seed, ...userItems]

    const existingIds = new Set(named.map((x) => x.id))
    const toAdd = seed.filter((s) => !existingIds.has(s.id))
    if (toAdd.length === 0) return prev
    return [...named, ...toAdd]
  }

  if (!setMeta) {
    setItems((prev) => syncItems(prev, CATALOGO_SEED_VERSION))
    return
  }

  setMeta((meta) => {
    const ver = meta?.seedVersion ?? 0
    const shouldRefresh = ver < CATALOGO_SEED_VERSION
    setItems((prev) => syncItems(prev, ver))
    return shouldRefresh ? { ...(meta || {}), seedVersion: CATALOGO_SEED_VERSION } : meta
  })
}

/** @deprecated use applyProfeCatalogoSeedSync */
export function ensureProfeCatalogoSeed(setItems, setMeta) {
  applyProfeCatalogoSeedSync(setItems, setMeta)
}

export function contarCatalogoPorCategoria(items = [], favoritos = []) {
  const favSet = new Set(favoritos || [])
  const counts = { Todos: items.length, Favoritos: items.filter((i) => favSet.has(i.id)).length }
  for (const item of items) {
    const cat = getCategoriaCatalogo(item)
    counts[cat] = (counts[cat] || 0) + 1
  }
  return counts
}

export function filtrarCatalogo(items, { q = '', categoria = 'Todos', favoritos = [] } = {}) {
  const query = q.trim().toLowerCase()
  const favSet = new Set(favoritos || [])

  return items.filter((item) => {
    const cat = getCategoriaCatalogo(item)
    if (categoria === 'Favoritos') {
      if (!favSet.has(item.id)) return false
    } else if (categoria !== 'Todos' && cat !== categoria) {
      return false
    }
    if (!query) return true
    const nom = String(item.nombre || '').toLowerCase()
    const notas = String(item.notas || '').toLowerCase()
    const catLabel = cat.toLowerCase()
    return nom.includes(query) || notas.includes(query) || catLabel.includes(query)
  })
}

/** Sugerencias rápidas para el buscador inline (prioriza coincidencia al inicio del nombre). */
export function buscarSugerenciasCatalogo(items = [], q = '', { limit = 8 } = {}) {
  const query = String(q || '').trim().toLowerCase()
  if (!query) return []

  const scored = []
  for (const raw of Array.isArray(items) ? items : []) {
    const item = catalogoItemNormalizado(raw)
    if (!item || !String(item.nombre || '').trim()) continue
    const nom = String(item.nombre || '').toLowerCase()
    const notas = String(item.notas || '').toLowerCase()
    const cat = getCategoriaCatalogo(item).toLowerCase()
    let score = -1
    if (nom.startsWith(query)) score = 4
    else if (nom.includes(query)) score = 3
    else if (cat.startsWith(query)) score = 2
    else if (cat.includes(query) || notas.includes(query)) score = 1
    if (score < 0) continue
    scored.push({ item, score, nom })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.nom.localeCompare(b.nom, 'es', { sensitivity: 'base' })
  })

  return scored.slice(0, limit).map((x) => x.item)
}

export function resolverCategoriaNuevoEjercicio({ categoria = '', nuevaCategoria = '', nombre = '' }) {
  const catNueva = normalizarNombreCategoria(nuevaCategoria)
  if (catNueva) return { categoria: catNueva, esNueva: true }

  const catSel = normalizarNombreCategoria(categoria)
  if (catSel) return { categoria: catSel, esNueva: false }

  const inferida = getCategoriaCatalogo({ nombre: String(nombre || '').trim() })
  if (inferida && inferida !== 'Funcional') return { categoria: inferida, esNueva: false, inferida: true }

  return { categoria: inferida || 'Funcional', esNueva: false, inferida: true }
}

export function crearEjercicioCatalogo({ nombre, categoria, notas = '', nuevaCategoria = '' }) {
  const n = String(nombre || '').trim()
  if (!n) return null
  const resolved = resolverCategoriaNuevoEjercicio({ categoria, nuevaCategoria, nombre: n })
  return {
    id: newCatalogoEjercicioId(),
    nombre: n,
    categoria: resolved.categoria,
    notas: String(notas || '').trim(),
    _resolved: resolved,
  }
}

export function agregarCategoriaCustom(setCategorias, nombre) {
  const n = normalizarNombreCategoria(nombre)
  if (!categoriaEsValida(n)) return { ok: false, error: 'Nombre de categoría inválido.' }
  if (CATEGORIAS_BASE.some((c) => c.toLowerCase() === n.toLowerCase())) {
    return { ok: false, error: 'Esa categoría ya existe en la biblioteca base.' }
  }
  setCategorias((prev) => {
    const arr = Array.isArray(prev) ? prev : []
    if (arr.some((c) => c.toLowerCase() === n.toLowerCase())) return arr
    return [...arr, n]
  })
  return { ok: true, categoria: n }
}

export function toggleFavoritoCatalogo(setFavoritos, id) {
  if (!id) return
  setFavoritos((prev) => {
    const arr = Array.isArray(prev) ? prev : []
    if (arr.includes(id)) return arr.filter((x) => x !== id)
    return [...arr, id]
  })
}
