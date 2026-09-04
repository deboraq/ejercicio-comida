/**
 * Normaliza referenciaComidas.js:
 * - agrega grasas (g) = max(0, (kcal - P*4 - C*4) / 9)
 * - deduplica sinónimos con aliases
 * - estandariza porciones problemáticas
 *
 * Uso: node scripts/normalizeComidas.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { REFERENCIA_ALIMENTOS } from '../src/utils/referenciaComidas.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outFile = path.join(__dirname, '../src/utils/referenciaComidas.js')

function round1(n) {
  return Math.round(n * 10) / 10
}

function calcGrasas(cal, pro, car) {
  const g = (Number(cal) - Number(pro) * 4 - Number(car) * 4) / 9
  if (!Number.isFinite(g) || g < 0) return 0
  return round1(g)
}

function keyNorm(nombre) {
  return String(nombre)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Fixes puntuales de nombre/porción (clave = keyNorm del nombre actual). */
const FIXES = {
  [keyNorm('Batata asada (1 unidad de referencia)')]: {
    nombre: 'Batata asada (1/2 unidad)',
    porcion: '1/2 unidad asada (~100 g)',
  },
  [keyNorm('Batata hervida (1 unidad de referencia)')]: {
    nombre: 'Batata hervida (1/2 unidad)',
    porcion: '1/2 unidad hervida (~90 g)',
  },
  [keyNorm('Aguacate (1 unidad de referencia)')]: {
    nombre: 'Media palta / medio aguacate',
    porcion: '1/2 unidad (~70 g)',
    aliases: ['aguacate', 'palta', 'media palta', 'medio aguacate', '1/2 palta'],
  },
  [keyNorm('Palta (1 unidad de referencia)')]: {
    nombre: 'Media palta / medio aguacate',
    porcion: '1/2 unidad (~70 g)',
    aliases: ['aguacate', 'palta', 'media palta', 'medio aguacate'],
  },
  [keyNorm('Media palta / medio aguacate')]: {
    porcion: '1/2 unidad (~70 g)',
    aliases: ['aguacate', 'palta', 'media palta', 'medio aguacate', '1/2 palta'],
  },
  [keyNorm('Palta entera / aguacate entero')]: {
    porcion: '1 unidad (~140 g)',
    aliases: ['palta entera', 'aguacate entero', '1 palta'],
  },
  [keyNorm('Cuarto de palta')]: {
    porcion: '1/4 unidad (~35 g)',
    aliases: ['cuarto de aguacate', '1/4 palta', '1/4 aguacate'],
  },
  [keyNorm('Aguacate (1/4 unidad)')]: {
    nombre: 'Cuarto de palta',
    porcion: '1/4 unidad (~35 g)',
    aliases: ['cuarto de aguacate', '1/4 palta'],
  },
  [keyNorm('Papa al horno (1 mediana)')]: {
    porcion: '1 papa mediana con piel (~170 g)',
  },
  [keyNorm('Papa hervida (1 mediana)')]: {
    porcion: '1 papa mediana (~150 g)',
    aliases: ['patata cocida', 'papa cocida'],
  },
  [keyNorm('Patata cocida (1 mediana)')]: {
    nombre: 'Papa / patata cocida (1 mediana)',
    porcion: '1 papa mediana (~150 g)',
    aliases: ['patata cocida', 'papa hervida', 'patata'],
  },
  [keyNorm('Patata asada con piel (1 mediana)')]: {
    nombre: 'Papa / patata asada con piel (1 mediana)',
    porcion: '1 unidad (~160 g)',
    aliases: ['patata asada', 'papa al horno'],
  },
  [keyNorm('Choclo / maíz en grano (1 taza)')]: {
    nombre: 'Choclo / maíz (1 taza)',
    porcion: '1 taza granos (~165 g)',
    aliases: ['maiz', 'choclo', 'maíz en grano', 'choclo en grano'],
  },
  [keyNorm('Maíz (1 taza)')]: {
    nombre: 'Choclo / maíz (1 taza)',
    porcion: '1 taza granos (~165 g)',
    aliases: ['maiz', 'choclo'],
  },
  [keyNorm('Col rizada / kale (1 taza)')]: {
    nombre: 'Kale / col rizada (1 taza cruda)',
    porcion: '1 taza cruda (~20 g)',
    aliases: ['kale', 'col rizada', 'col rizada cruda'],
  },
  [keyNorm('Kale / col rizada cruda (1 taza)')]: {
    nombre: 'Kale / col rizada (1 taza cruda)',
    porcion: '1 taza cruda (~20 g)',
    aliases: ['kale', 'col rizada'],
  },
  [keyNorm('Kale / col rizada (1 taza cruda)')]: {
    porcion: '1 taza cruda (~20 g)',
    aliases: ['kale', 'col rizada', 'col rizada cruda'],
  },
  [keyNorm('Espinaca cruda (1 taza)')]: {
    // unificar a valores coherentes (~1 taza cruda)
    calorias: 7,
    proteinas: 1,
    carbohidratos: 1,
    porcion: '1 taza cruda (~30 g)',
    aliases: ['espinacas crudas', 'espina'],
  },
  [keyNorm('Granada (1 unidad de referencia)')]: {
    nombre: 'Granada (1/2 unidad)',
    porcion: '1/2 unidad (~85 g)',
  },
  [keyNorm('Pomelo (1 unidad de referencia)')]: {
    nombre: 'Pomelo (1/2 unidad)',
    porcion: '1/2 unidad (~120 g)',
  },
}

/** Claves canónicas para fusionar filas equivalentes (mismo alimento, distinto nombre). */
function canonicalGroup(item) {
  const k = keyNorm(item.nombre)
  if (k.includes('choclo') || (k.includes('maiz') && k.includes('1 taza') && item.categoria === 'Verduras')) {
    if (item.calorias === 130 && item.proteinas === 4) return 'verduras:choclo-taza'
  }
  if ((k.includes('kale') || k.includes('col rizada')) && k.includes('1 taza')) {
    return 'kale-taza' // merge across Verduras / Comidas saludables
  }
  if (k.includes('espinaca cruda') && k.includes('1 taza')) {
    return 'espinaca-cruda-taza' // merge across categories → keep Verduras
  }
  if (
    (k.includes('media palta') || k.includes('medio aguacate') || k === keyNorm('Aguacate (1 unidad de referencia)') || k === keyNorm('Palta (1 unidad de referencia)')) &&
    item.calorias === 120
  ) {
    return 'palta-media'
  }
  if (k.includes('cuarto de palta') || k === keyNorm('Aguacate (1/4 unidad)')) {
    return 'palta-cuarto'
  }
  if (k.includes('palta entera') || k.includes('aguacate entero')) {
    return 'palta-entera'
  }
  if (k.includes('papa hervida') || k.includes('patata cocida')) {
    if (item.calorias === 130) return 'papa-cocida-mediana'
  }
  return null
}

function preferKeep(a, b) {
  // Preferir categoría canónica (no duplicar en Comidas saludables / Snacks)
  const score = (x) => {
    let s = 0
    if (x.categoria === 'Verduras') s += 10
    if (x.categoria === 'Frutas') s += 10
    if (x.categoria === 'Proteínas') s += 8
    if (x.categoria === 'Carbohidratos') s += 8
    if (x.categoria === 'Desayuno / Lácteos') s += 7
    if (x.categoria === 'Snacks / Bebidas') s += 2
    if (x.categoria === 'Comidas saludables') s -= 5
    if (/palta|choclo|papa \//i.test(x.nombre)) s += 2
    if (Array.isArray(x.aliases) && x.aliases.length) s += 1
    if (!/referencia/i.test(x.nombre)) s += 1
    if (x.porcion && /~\d+\s*g|ml/.test(x.porcion)) s += 1
    if (x.porcion && String(x.porcion).length > 12) s += 0.5
    return s
  }
  return score(a) >= score(b) ? a : b
}

function mergeAliases(...lists) {
  const set = new Set()
  for (const list of lists) {
    for (const a of list || []) {
      const t = String(a).trim()
      if (t) set.add(t)
    }
  }
  return [...set]
}

// 1) Apply fixes
let items = REFERENCIA_ALIMENTOS.map((raw) => {
  const fix = FIXES[keyNorm(raw.nombre)] || {}
  const calorias = fix.calorias ?? raw.calorias
  const proteinas = fix.proteinas ?? raw.proteinas
  const carbohidratos = fix.carbohidratos ?? raw.carbohidratos
  const nombre = fix.nombre ?? raw.nombre
  const porcion = fix.porcion ?? raw.porcion
  const aliases = mergeAliases(raw.aliases, fix.aliases)
  const grasas =
    raw.grasas != null && Number.isFinite(Number(raw.grasas))
      ? round1(Number(raw.grasas))
      : calcGrasas(calorias, proteinas, carbohidratos)
  const out = {
    categoria: raw.categoria,
    nombre,
    calorias,
    proteinas,
    carbohidratos,
    grasas,
    porcion,
  }
  if (aliases.length) out.aliases = aliases
  return out
})

// 2) Dedup by canonical group
const groups = new Map()
const ungrouped = []
for (const it of items) {
  const g = canonicalGroup(it)
  if (!g) {
    ungrouped.push(it)
    continue
  }
  if (!groups.has(g)) groups.set(g, it)
  else {
    const prev = groups.get(g)
    const kept = preferKeep(prev, it)
    const other = kept === prev ? it : prev
    kept.aliases = mergeAliases(
      kept.aliases,
      other.aliases,
      [other.nombre],
      // palabras útiles del nombre descartado
    )
    // Prefer Verduras for espinaca/kale/choclo
    if (g.startsWith('espinaca') || g.includes('choclo') || g.includes('kale')) {
      if (other.categoria === 'Verduras') kept.categoria = 'Verduras'
      if (kept.categoria !== 'Verduras' && prev.categoria === 'Verduras') kept.categoria = 'Verduras'
    }
    groups.set(g, kept)
  }
}

items = [...ungrouped, ...groups.values()]

// 3) Dedup exacto por nombre normalizado (p. ej. Kale en Verduras + Comidas saludables)
const byName = new Map()
for (const it of items) {
  const k = keyNorm(it.nombre)
  if (!byName.has(k)) {
    byName.set(k, it)
    continue
  }
  const prev = byName.get(k)
  const kept = preferKeep(prev, it)
  const other = kept === prev ? it : prev
  kept.aliases = mergeAliases(kept.aliases, other.aliases)
  // Si difieren macros levemente, conservar los de la categoría canónica (kept)
  byName.set(k, kept)
}
items = [...byName.values()]

// Prefer category order roughly as before
const catOrder = [
  'Desayuno / Lácteos',
  'Lácteos y quesos',
  'Proteínas',
  'Milanesas y rebozados',
  'Fiambres',
  'Carbohidratos',
  'Pastas',
  'Almuerzo',
  'Verduras',
  'Frutas',
  'Platos típicos',
  'Comidas saludables',
  'Tartas (1 porción)',
  'Empanadas (1 unidad)',
  'Pizza (1 triángulo)',
  'Panificados',
  'Harinas',
  'Snacks / Bebidas',
]
items.sort((a, b) => {
  const ia = catOrder.indexOf(a.categoria)
  const ib = catOrder.indexOf(b.categoria)
  const ca = ia === -1 ? 999 : ia
  const cb = ib === -1 ? 999 : ib
  if (ca !== cb) return ca - cb
  return a.nombre.localeCompare(b.nombre, 'es')
})

function serializeItem(a) {
  const parts = [
    `categoria: ${JSON.stringify(a.categoria)}`,
    `nombre: ${JSON.stringify(a.nombre)}`,
    `calorias: ${a.calorias}`,
    `proteinas: ${a.proteinas}`,
    `carbohidratos: ${a.carbohidratos}`,
    `grasas: ${a.grasas}`,
    `porcion: ${JSON.stringify(a.porcion)}`,
  ]
  if (a.aliases?.length) parts.push(`aliases: ${JSON.stringify(a.aliases)}`)
  return `  { ${parts.join(', ')} },`
}

const header = `/**
 * Referencia de alimentos: cada fila = **una sola unidad contable** (1 taco, 1 pieza de sushi, 1 loncha,
 * 1 triángulo de pizza, 1 empanada, 1 taza si la medida es la unidad, etc.). No se agrupan 2 o 3 ítems
 * en una fila: si comés varios, usá **Cant.** al añadir desde la búsqueda.
 * Carnes y pescados en bloque “Proteínas” / saludables: base **100 g** (Cant. 1,5 ≈ 150 g).
 *
 * Campos:
 * - calorias, proteinas (g), carbohidratos (g), grasas (g)
 * - porcion: medida casera + equivalencia aprox. cuando aplica
 * - aliases: sinónimos para búsqueda (palta/aguacate, choclo/maíz, etc.)
 *
 * Grasas estimadas por balance: G = max(0, (kcal − P×4 − C×4) / 9) cuando no hay valor de laboratorio.
 * Basado en tablas nutricionales estándar (aprox.).
 */

import { sinAcentos } from './calorias.js'

export const REFERENCIA_ALIMENTOS = [
`

const footer = `
]

/** Agrupa por categoría para un selector */
export function getCategoriasUnicas() {
  const cats = [...new Set(REFERENCIA_ALIMENTOS.map((a) => a.categoria))]
  return cats
}

function textoBusqueda(a) {
  const alias = (a.aliases || []).join(' ')
  return sinAcentos(\`\${a.nombre} \${a.categoria} \${alias}\`)
}

/** Buscar por nombre, categoría o aliases. Devuelve items con _idx. */
export function buscarAlimentos(texto) {
  if (!texto || texto.length < 1) return []
  const t = sinAcentos(texto.trim())
  const palabras = t.split(/\\s+/).filter(Boolean)

  const puntuados = REFERENCIA_ALIMENTOS.map((a, idx) => {
    const haystack = textoBusqueda(a)
    const nombre = sinAcentos(a.nombre)
    const cat = sinAcentos(a.categoria)
    let score = 0
    if (nombre.includes(t) || cat.includes(t) || haystack.includes(t)) score += 100

    const significativas = palabras.filter((p) => p.length >= 3)
    if (significativas.length >= 2) {
      const matched = significativas.filter((p) => haystack.includes(p)).length
      if (matched === 0) return null
      score += matched * 12
      if (matched === significativas.length) score += 40
      else if (matched < significativas.length - 1) score -= 15
    } else {
      for (const p of palabras) {
        if (p.length < 2) continue
        if (nombre.includes(p)) score += 10
        else if (haystack.includes(p)) score += 6
        else if (cat.includes(p)) score += 4
      }
    }

    if (palabras.includes('media') || palabras.includes('medio')) {
      if (/media|medio|1\\/2/.test(nombre) || /media|medio/.test(haystack)) score += 25
    }
    return score > 0 ? { ...a, _idx: idx, _score: score } : null
  }).filter(Boolean)

  return puntuados
    .sort((a, b) => b._score - a._score || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, 120)
}
`

let body = ''
let lastCat = null
for (const a of items) {
  if (a.categoria !== lastCat) {
    body += `\n  // ${a.categoria}\n`
    lastCat = a.categoria
  }
  body += serializeItem(a) + '\n'
}

fs.writeFileSync(outFile, header + body + footer, 'utf8')
console.log('OK', items.length, 'alimentos →', outFile)
console.log('Antes:', REFERENCIA_ALIMENTOS.length, 'Después:', items.length, 'Quitados:', REFERENCIA_ALIMENTOS.length - items.length)
