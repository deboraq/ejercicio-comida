import { REFERENCIA_ALIMENTOS } from './referenciaComidas'

/** Favoritos sugeridos cuando el usuario aún no marcó ninguno. */
export const COMIDA_FAVORITOS_SUGERIDOS = [
  'Pechuga de pollo a la plancha (100 g)',
  'Huevo cocido (1 unidad)',
  'Fruta (plátano mediano)',
  'Batido de proteínas',
]

export function resolverAlimentoPorNombre(nombre) {
  if (!nombre) return null
  const exact = REFERENCIA_ALIMENTOS.find((a) => a.nombre === nombre)
  if (exact) return exact
  const low = String(nombre).toLowerCase()
  return REFERENCIA_ALIMENTOS.find((a) => {
    const n = a.nombre.toLowerCase()
    return low.includes(n) || n.includes(low)
  }) || null
}

export function resolverFavoritosComida(nombres = []) {
  const vistos = new Set()
  const out = []
  for (const nombre of nombres) {
    const item = resolverAlimentoPorNombre(nombre)
    if (!item || vistos.has(item.nombre)) continue
    vistos.add(item.nombre)
    out.push(item)
  }
  return out
}

export function esFavoritoComida(favoritos, nombre) {
  if (!nombre || !Array.isArray(favoritos)) return false
  return favoritos.includes(nombre)
}

export function toggleFavoritoComida(setFavoritos, nombre) {
  if (!nombre) return
  setFavoritos((prev) => {
    const arr = Array.isArray(prev) ? prev : []
    if (arr.includes(nombre)) return arr.filter((n) => n !== nombre)
    return [...arr, nombre]
  })
}

export function emojiComida(nombre = '') {
  const n = nombre.toLowerCase()
  if (/pollo|pechuga/.test(n)) return '🍗'
  if (/huevo|omelette|tortilla/.test(n)) return '🥚'
  if (/pescado|merluza|atún|atun/.test(n)) return '🐟'
  if (/carne|lomo|milanesa/.test(n)) return '🥩'
  if (/ensalada|hortaliza|verdura/.test(n)) return '🥗'
  if (/yogur|yogurt|queso|leche/.test(n)) return '🥛'
  if (/tostada|pan|galleta/.test(n)) return '🍞'
  if (/avena|cereal|arroz|quinua|quinoa|legumbre/.test(n)) return '🍚'
  if (/fruta|banana|plátano|manzana/.test(n)) return '🍎'
  if (/helado/.test(n)) return '🍦'
  if (/proteína|proteina|whey|batido/.test(n)) return '🥤'
  if (/palta|aguacate|aceite|almendra|nuez|fruto sec/.test(n)) return '🥑'
  return '🍽️'
}
