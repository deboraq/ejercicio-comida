/**
 * Enriquece referenciaComidas.js:
 * - aliases semánticos (frutilla→fresa, huevos→huevo, etc.)
 * - categoría "Salida / Social" (~45 platos para no romper la racha)
 * - recalcula grasas si faltan
 *
 * Uso: node scripts/enrichComidas.mjs
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

function mergeAliases(...lists) {
  const set = new Set()
  for (const list of lists) {
    for (const a of list || []) {
      const t = String(a).trim().toLowerCase()
      if (t) set.add(t)
    }
  }
  return [...set]
}

/** Alias por patrón en el nombre (se suman a los existentes). */
const ALIAS_POR_PATRON = [
  { test: (k) => k.includes('fresa'), add: ['frutilla', 'frutillas', 'fresas', 'strawberry'] },
  { test: (k) => k.includes('frutilla'), add: ['fresa', 'fresas', 'frutillas'] },
  { test: (k) => /^huevo cocido|^huevo duro/.test(k) || k.includes('huevo cocido'), add: ['huevos', 'huevo duro', 'huevo hervido', 'hard boiled egg'] },
  { test: (k) => k.includes('huevo revuelto') || k.includes('huevos revueltos'), add: ['huevos', 'revuelto', 'scrambled'] },
  { test: (k) => k.includes('clara de huevo'), add: ['clara', 'claras', 'egg white', 'huevos'] },
  { test: (k) => k.includes('huevo frito') || k.includes('huevo pochado'), add: ['huevos', 'fried egg'] },
  { test: (k) => k === 'huevo revuelto 1 huevo' || k.startsWith('huevo '), add: ['huevos'] },
  { test: (k) => k.includes('palta') || k.includes('aguacate'), add: ['avocado', 'palta', 'aguacate'] },
  { test: (k) => k.includes('choclo') || (k.includes('maiz') && k.includes('taza')), add: ['maiz', 'maíz', 'choclo', 'corn'] },
  { test: (k) => k.includes('papa') || k.includes('patata'), add: ['papa', 'patata', 'potato'] },
  { test: (k) => k.includes('atun') || k.includes('atún'), add: ['atun', 'tuna', 'lata de atun'] },
  { test: (k) => k.includes('pechuga') || k.includes('pollo'), add: ['chicken', 'pollo'] },
  { test: (k) => k.includes('yogur') || k.includes('yogurt'), add: ['yogur', 'yogurt', 'yoghurt'] },
  { test: (k) => k.includes('platano') || k.includes('banana') || k.includes('fruta platano'), add: ['banana', 'plátano', 'banano'] },
  { test: (k) => k.includes('manzana'), add: ['apple'] },
  { test: (k) => k.includes('arroz'), add: ['rice'] },
  { test: (k) => k.includes('avena'), add: ['oatmeal', 'porridge'] },
  { test: (k) => k.includes('pan integral'), add: ['pan negro', 'whole wheat'] },
  { test: (k) => k.includes('queso'), add: ['cheese'] },
  { test: (k) => k.includes('jamon') || k.includes('jamón'), add: ['jamon', 'ham'] },
  { test: (k) => k.includes('cerveza'), add: ['pinta', 'birra', 'beer', 'chop'] },
  { test: (k) => k.includes('empanada'), add: ['empanadas', 'pastelito'] },
  { test: (k) => k.includes('hamburguesa') || k.includes('burger'), add: ['burger', 'hamburguesa', 'combo'] },
  { test: (k) => k.includes('pizza'), add: ['porcion pizza', 'slice'] },
  { test: (k) => k.includes('helado'), add: ['ice cream', 'cucurucho'] },
  { test: (k) => k.includes('cafe'), add: ['coffee', 'café'] },
  { test: (k) => k.includes('kale') || k.includes('col rizada'), add: ['kale', 'col rizada'] },
  { test: (k) => k.includes('espinaca'), add: ['spinach', 'espinacas'] },
  { test: (k) => k.includes('batata') || k.includes('camote'), add: ['camote', 'sweet potato'] },
  { test: (k) => k.includes('lenteja'), add: ['lentejas', 'lentils'] },
  { test: (k) => k.includes('garbanzo'), add: ['garbanzos', 'chickpeas'] },
  { test: (k) => k.includes('tofu'), add: ['soja', 'soy'] },
  { test: (k) => k.includes('salmon') || k.includes('salmón'), add: ['salmon', 'pescado'] },
  { test: (k) => k.includes('asado') && k.includes('carne'), add: ['parrilla', 'asado'] },
]

/** Platos de salida / social: estimación rápida para no romper la racha. */
const SALIDA_SOCIAL = [
  { nombre: 'Hamburguesa completa de bodega / fast food (1 unidad)', calorias: 650, proteinas: 28, carbohidratos: 52, porcion: '1 hamburguesa con pan, carne, queso y guarnición (~280 g)', aliases: ['hamburguesa', 'burger', 'combo hamburguesa', 'mcdonalds', 'fast food', 'bodega'] },
  { nombre: 'Hamburguesa doble con papas (combo)', calorias: 980, proteinas: 38, carbohidratos: 85, porcion: '1 combo: doble burger + papas medianas', aliases: ['combo burger', 'hamburguesa doble', 'menu completo'] },
  { nombre: 'Hamburguesa casera / gourmet (1 unidad)', calorias: 720, proteinas: 32, carbohidratos: 48, porcion: '1 unidad (~300 g)', aliases: ['burger gourmet', 'smash burger'] },
  { nombre: 'Papas fritas (porción mediana fast food)', calorias: 380, proteinas: 5, carbohidratos: 48, porcion: '1 porción mediana (~120 g)', aliases: ['papas fritas', 'french fries', 'fries', 'papitas'] },
  { nombre: 'Papas fritas (porción grande)', calorias: 520, proteinas: 7, carbohidratos: 66, porcion: '1 porción grande (~165 g)', aliases: ['papas grandes', 'large fries'] },
  { nombre: 'Hot dog / pancho completo (1 unidad)', calorias: 320, proteinas: 12, carbohidratos: 28, porcion: '1 pancho con pan y aderezos (~150 g)', aliases: ['pancho', 'hotdog', 'salchicha'] },
  { nombre: 'Choripán (1 unidad)', calorias: 450, proteinas: 18, carbohidratos: 35, porcion: '1 choripán (~220 g)', aliases: ['chori', 'choripan', 'parrilla'] },
  { nombre: 'Pizza muzzarella (1 porción / 2 porciones chicas)', calorias: 320, proteinas: 14, carbohidratos: 36, porcion: '1 porción grande o 2 triángulos (~150 g)', aliases: ['pizza muzza', 'pizza queso', 'salida pizza'] },
  { nombre: 'Pizza con toppings (1 porción restaurante)', calorias: 380, proteinas: 16, carbohidratos: 38, porcion: '1 porción (~170 g)', aliases: ['pizza napolitana', 'pizza especial'] },
  { nombre: 'Empanada de carne frita (1 unidad)', calorias: 310, proteinas: 11, carbohidratos: 27, porcion: '1 empanada frita (~95 g)', aliases: ['empanada frita', 'empanadas', 'salida empanada'] },
  { nombre: 'Empanada de carne al horno (1 unidad)', calorias: 250, proteinas: 11, carbohidratos: 26, porcion: '1 empanada al horno (~90 g)', aliases: ['empanada horno'] },
  { nombre: 'Milanesa con papas fritas (1 plato)', calorias: 780, proteinas: 35, carbohidratos: 55, porcion: '1 plato restaurante (~400 g)', aliases: ['mila con papas', 'milanesa napolitana con papas', 'almuerzo salida'] },
  { nombre: 'Milanesa napolitana (1 unidad con guarnición liviana)', calorias: 650, proteinas: 38, carbohidratos: 42, porcion: '1 milanesa napo (~350 g)', aliases: ['mila napo', 'napolitana'] },
  { nombre: 'Asado / parrilla (1 plato con ensalada)', calorias: 720, proteinas: 45, carbohidratos: 15, porcion: '1 plato carne + ensalada (~350 g)', aliases: ['asado', 'parrilla', 'bbq', 'carne asada'] },
  { nombre: 'Bife de chorizo con guarnición (1 plato)', calorias: 680, proteinas: 42, carbohidratos: 25, porcion: '1 plato (~350 g)', aliases: ['bife', 'chorizo steak'] },
  { nombre: 'Pollo al spiedo con papas (1/4 + papas)', calorias: 620, proteinas: 40, carbohidratos: 35, porcion: '1/4 pollo + papas (~350 g)', aliases: ['pollo spiedo', 'pollo asado salida'] },
  { nombre: 'Sushi (8 piezas / 1 roll)', calorias: 350, proteinas: 16, carbohidratos: 48, porcion: '8 piezas (~200 g)', aliases: ['sushi', 'rolls', 'maki', 'nippon'] },
  { nombre: 'Sushi (12 piezas / combo)', calorias: 520, proteinas: 24, carbohidratos: 70, porcion: '12 piezas (~300 g)', aliases: ['combo sushi', 'tabla sushi'] },
  { nombre: 'Ramen / fideos asiáticos (1 bowl)', calorias: 550, proteinas: 22, carbohidratos: 65, porcion: '1 bowl (~450 ml)', aliases: ['ramen', 'fideos chinos', 'pho'] },
  { nombre: 'Tacos (3 unidades calle / restaurante)', calorias: 480, proteinas: 24, carbohidratos: 42, porcion: '3 tacos (~300 g)', aliases: ['tacos', 'taco', 'mexican food'] },
  { nombre: 'Burrito grande (1 unidad)', calorias: 700, proteinas: 30, carbohidratos: 75, porcion: '1 burrito (~350 g)', aliases: ['burrito', 'wrap mexicano'] },
  { nombre: 'Shawarma / kebab en pan (1 unidad)', calorias: 580, proteinas: 28, carbohidratos: 50, porcion: '1 pan relleno (~300 g)', aliases: ['shawarma', 'kebab', 'döner', 'gyros'] },
  { nombre: 'Falafel en pan / pita (1 unidad)', calorias: 480, proteinas: 16, carbohidratos: 58, porcion: '1 pita con falafel (~280 g)', aliases: ['falafel', 'pita falafel'] },
  { nombre: 'Pasta al pesto / boloñesa (1 plato restaurante)', calorias: 720, proteinas: 24, carbohidratos: 85, porcion: '1 plato (~350 g)', aliases: ['pasta salida', 'spaghetti', 'boloñesa restaurante'] },
  { nombre: 'Risotto (1 plato)', calorias: 580, proteinas: 14, carbohidratos: 70, porcion: '1 plato (~300 g)', aliases: ['risotto'] },
  { nombre: 'Ensalada César con pollo (1 plato)', calorias: 520, proteinas: 32, carbohidratos: 22, porcion: '1 plato (~350 g)', aliases: ['cesar', 'caesar salad', 'ensalada restaurante'] },
  { nombre: 'Wok de verduras con arroz (1 plato)', calorias: 480, proteinas: 14, carbohidratos: 68, porcion: '1 plato (~400 g)', aliases: ['wok', 'stir fry'] },
  { nombre: 'Sándwich de milanesa (1 unidad)', calorias: 650, proteinas: 30, carbohidratos: 55, porcion: '1 sándwich completo (~320 g)', aliases: ['sandwich milanesa', 'sanguche mila'] },
  { nombre: 'Sándwich completo / lomito (1 unidad)', calorias: 720, proteinas: 35, carbohidratos: 50, porcion: '1 lomito (~350 g)', aliases: ['lomito', 'sandwich completo', 'sanguche'] },
  { nombre: 'Empanada + gaseosa (combo kiosco)', calorias: 410, proteinas: 11, carbohidratos: 52, porcion: '1 empanada + 1 vaso gaseosa 250 ml', aliases: ['combo empanada', 'kiosco'] },
  { nombre: 'Cerveza / pinta (500 ml)', calorias: 210, proteinas: 2, carbohidratos: 18, porcion: '1 pinta 500 ml', aliases: ['pinta', 'cerveza', 'birra', 'beer', 'chop'] },
  { nombre: 'Cerveza lata / botella (330 ml)', calorias: 140, proteinas: 1, carbohidratos: 12, porcion: '330 ml', aliases: ['lata cerveza', 'birra'] },
  { nombre: 'Fernet con Coca (1 vaso)', calorias: 220, proteinas: 0, carbohidratos: 35, porcion: '1 vaso ~250 ml', aliases: ['fernet', 'fernet cola', 'trago'] },
  { nombre: 'Cóctel / trago mixto (1 unidad)', calorias: 180, proteinas: 0, carbohidratos: 18, porcion: '1 vaso (~150 ml)', aliases: ['trago', 'cocktail', 'gin tonic', 'aperol'] },
  { nombre: 'Vino (2 copas / salida)', calorias: 250, proteinas: 0, carbohidratos: 8, porcion: '2 copas ~300 ml', aliases: ['vino salida', 'copas de vino'] },
  { nombre: 'Postre de restaurante (1 porción)', calorias: 420, proteinas: 6, carbohidratos: 55, porcion: '1 porción (~150 g)', aliases: ['postre salida', 'flan', 'tiramisu restaurante', 'brownie'] },
  { nombre: 'Helado cucurucho (1 unidad)', calorias: 280, proteinas: 4, carbohidratos: 38, porcion: '1 cucurucho 2 bochas (~150 g)', aliases: ['helado', 'cucurucho', 'bocha'] },
  { nombre: 'Café con medialunas (desayuno bar)', calorias: 380, proteinas: 8, carbohidratos: 48, porcion: '1 café con leche + 2 medialunas', aliases: ['medialunas', 'desayuno bar', 'cafeteria'] },
  { nombre: 'Brunch típico (1 plato)', calorias: 750, proteinas: 28, carbohidratos: 55, porcion: '1 plato brunch (~400 g)', aliases: ['brunch', 'desayuno brunch'] },
  { nombre: 'Comida china (1 plato arroz + proteína)', calorias: 680, proteinas: 26, carbohidratos: 80, porcion: '1 plato (~400 g)', aliases: ['comida china', 'arroz chino', 'chow mein'] },
  { nombre: 'Delivery pizza (1/4 pizza familiar)', calorias: 450, proteinas: 18, carbohidratos: 48, porcion: '2–3 porciones (~200 g)', aliases: ['delivery pizza', 'pizza delivery'] },
  { nombre: 'Nuggets de pollo (6 unidades + salsa)', calorias: 320, proteinas: 16, carbohidratos: 22, porcion: '6 nuggets (~120 g)', aliases: ['nuggets', 'chicken nuggets'] },
  { nombre: 'Wrap de pollo / Caesar (1 unidad)', calorias: 480, proteinas: 28, carbohidratos: 42, porcion: '1 wrap (~280 g)', aliases: ['wrap', 'wrap pollo'] },
  { nombre: 'Poké bowl (1 bowl)', calorias: 550, proteinas: 30, carbohidratos: 55, porcion: '1 bowl (~400 g)', aliases: ['poke', 'poké', 'bowl'] },
  { nombre: 'Nachos con queso / guacamole (1 porción compartir)', calorias: 480, proteinas: 12, carbohidratos: 45, porcion: '1 porción personal (~180 g)', aliases: ['nachos', 'queso nachos'] },
  { nombre: 'Alitas de pollo (6 unidades)', calorias: 420, proteinas: 28, carbohidratos: 12, porcion: '6 alitas (~200 g)', aliases: ['wings', 'alitas', 'buffalo'] },
]

function enrichAliases(item) {
  const k = keyNorm(item.nombre)
  let aliases = [...(item.aliases || [])]
  for (const rule of ALIAS_POR_PATRON) {
    if (rule.test(k)) aliases = mergeAliases(aliases, rule.add)
  }
  return aliases
}

let items = REFERENCIA_ALIMENTOS.map((raw) => {
  const calorias = raw.calorias
  const proteinas = raw.proteinas
  const carbohidratos = raw.carbohidratos
  const grasas =
    raw.grasas != null && Number.isFinite(Number(raw.grasas))
      ? round1(Number(raw.grasas))
      : calcGrasas(calorias, proteinas, carbohidratos)
  const aliases = enrichAliases(raw)
  const esAlcohol = /cerveza|pinta|vino|fernet|cóctel|coctel|trago|copa de vino/i.test(raw.nombre)
  const out = {
    categoria: raw.categoria,
    nombre: raw.nombre,
    calorias,
    proteinas,
    carbohidratos,
    grasas: esAlcohol ? 0 : grasas,
    porcion: raw.porcion,
  }
  if (aliases.length) out.aliases = aliases
  return out
})

// Evitar duplicar si ya existe categoría Salida
const yaSalida = new Set(
  items.filter((a) => a.categoria === 'Salida / Social').map((a) => keyNorm(a.nombre))
)

for (const raw of SALIDA_SOCIAL) {
  const k = keyNorm(raw.nombre)
  if (yaSalida.has(k)) continue
  // también evitar nombres casi iguales en otras categorías
  const exists = items.some((a) => keyNorm(a.nombre) === k)
  if (exists) continue
  const grasas = calcGrasas(raw.calorias, raw.proteinas, raw.carbohidratos)
  const esAlcohol = /cerveza|pinta|vino|fernet|cóctel|coctel|trago/i.test(raw.nombre)
  items.push({
    categoria: 'Salida / Social',
    nombre: raw.nombre,
    calorias: raw.calorias,
    proteinas: raw.proteinas,
    carbohidratos: raw.carbohidratos,
    grasas: esAlcohol ? 0 : grasas,
    porcion: raw.porcion,
    aliases: mergeAliases(raw.aliases, ['salida', 'social', 'restaurant', 'restaurante', 'delivery']),
  })
}

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
  'Salida / Social',
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
 * “Salida / Social”: estimaciones rápidas (hamburguesa, pinta, delivery) para no romper la racha.
 *
 * Campos:
 * - calorias, proteinas (g), carbohidratos (g), grasas (g)
 * - porcion: medida casera + equivalencia aprox. cuando aplica
 * - aliases: sinónimos para búsqueda (frutilla/fresa, huevos, palta/aguacate, etc.)
 *
 * Grasas estimadas por balance: G = max(0, (kcal − P×4 − C×4) / 9) cuando no hay valor de laboratorio.
 * Basado en tablas nutricionales estándar (aprox.).
 */

import { sinAcentos } from './calorias.js'

/** Expande términos de búsqueda (query → variantes). */
const QUERY_EXPAND = {
  frutilla: ['fresa', 'fresas', 'frutillas'],
  frutillas: ['fresa', 'fresas', 'frutilla'],
  fresa: ['frutilla', 'frutillas', 'fresas'],
  fresas: ['frutilla', 'frutillas', 'fresa'],
  huevos: ['huevo', 'clara', 'claras'],
  huevo: ['huevos'],
  birra: ['cerveza', 'pinta'],
  pinta: ['cerveza', 'birra'],
  burger: ['hamburguesa'],
  hamburguesa: ['burger'],
  papa: ['patata'],
  patata: ['papa'],
  palta: ['aguacate'],
  aguacate: ['palta'],
  maiz: ['choclo', 'maíz'],
  choclo: ['maiz', 'maíz'],
  camote: ['batata'],
  batata: ['camote'],
}

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

function expandirPalabras(palabras) {
  const out = new Set()
  for (const p of palabras) {
    out.add(p)
    if (p.length > 3 && p.endsWith('s')) out.add(p.slice(0, -1))
    const extras = QUERY_EXPAND[p]
    if (extras) extras.forEach((e) => out.add(sinAcentos(e)))
  }
  return [...out]
}

/** Buscar por nombre, categoría o aliases. Devuelve items con _idx. */
export function buscarAlimentos(texto) {
  if (!texto || texto.length < 1) return []
  const t = sinAcentos(texto.trim())
  const palabrasRaw = t.split(/\\s+/).filter(Boolean)
  const palabras = expandirPalabras(palabrasRaw)

  const puntuados = REFERENCIA_ALIMENTOS.map((a, idx) => {
    const haystack = textoBusqueda(a)
    const nombre = sinAcentos(a.nombre)
    const cat = sinAcentos(a.categoria)
    let score = 0
    if (nombre.includes(t) || cat.includes(t) || haystack.includes(t)) score += 100

    // Boost categoría Salida / Social en búsquedas de salida
    if (/salida|social|restaurant|delivery|fast food|bodega|pinta|birra/.test(t) && cat.includes('salida')) {
      score += 40
    }

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
const nSalida = items.filter((a) => a.categoria === 'Salida / Social').length
const nAlias = items.filter((a) => a.aliases?.length).length
console.log('OK', items.length, 'alimentos →', outFile)
console.log('Salida / Social:', nSalida, '| con aliases:', nAlias)
