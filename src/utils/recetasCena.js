import { REFERENCIA_ALIMENTOS } from './referenciaComidas.js'

const CATEGORIAS_CENA = new Set([
  'Proteínas',
  'Comidas saludables',
  'Verduras',
  'Almuerzo',
  'Platos típicos',
  'Tartas (1 porción)',
  'Pastas',
  'Carbohidratos',
  'Milanesas y rebozados',
])

const EXCLUIR_CATEGORIAS = new Set([
  'Desayuno / Lácteos',
  'Snacks / Bebidas',
  'Harinas',
  'Empanadas (1 unidad)',
  'Pizza (1 triángulo)',
])

const FALLBACK_NOMBRES = [
  'Atún en lata al natural (1 lata)',
  'Pechuga de pollo a la plancha (100 g)',
  'Ensalada verde con pollo (1 plato)',
  'Huevo cocido (1 unidad)',
  'Salmón al horno (100 g)',
  'Ensalada verde (1 plato)',
]

function puntajeCena(item, { proteinasRestantes, caloriasRestantes }) {
  let score = 0
  const nombre = item.nombre.toLowerCase()

  if (CATEGORIAS_CENA.has(item.categoria)) score += 12
  if (EXCLUIR_CATEGORIAS.has(item.categoria)) score -= 30

  const pro = Number(item.proteinas) || 0
  const kcal = Number(item.calorias) || 0

  if (proteinasRestantes >= 15 && pro >= 18) score += 28
  else if (proteinasRestantes >= 8 && pro >= 10) score += 18
  else if (pro >= 6) score += 8

  if (caloriasRestantes > 0) {
    if (kcal <= caloriasRestantes + 80) score += 10
    if (kcal > caloriasRestantes + 350) score -= 18
  }

  if (/pollo|pechuga|atun|atún|pescado|salmon|salmón|huevo|carne|milanesa/.test(nombre)) score += 14
  if (/ensalada|verdura|brócoli|brocoli|espinaca|acelga|vegetal/.test(nombre)) score += 10
  if (/tarta|sopa|pasta|arroz|quinoa|pescado/.test(nombre)) score += 6
  if (/medialuna|croissant|galleta|alfajor|chocolate|helado|cerveza|pizza|hamburguesa/.test(nombre)) score -= 25

  return score
}

/**
 * Sugerencias de platos para cena según proteína y calorías restantes del día.
 */
export function getRecetasSugeridasCena({ proteinasRestantes = 0, caloriasRestantes = 9999, limite = 6 } = {}) {
  const proRest = Math.max(0, Number(proteinasRestantes) || 0)
  const kcalRest = Math.max(0, Number(caloriasRestantes) || 9999)

  const ranked = REFERENCIA_ALIMENTOS.map((item, idx) => ({
    ...item,
    _idx: idx,
    _score: puntajeCena(item, { proteinasRestantes: proRest, caloriasRestantes: kcalRest }),
  }))
    .filter((item) => item._score > 0)
    .sort((a, b) => b._score - a._score || b.proteinas - a.proteinas)

  const out = []
  const seen = new Set()

  for (const item of ranked) {
    const key = item.nombre.toLowerCase().slice(0, 28)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length >= limite) break
  }

  if (out.length < limite) {
    for (const nombre of FALLBACK_NOMBRES) {
      if (out.length >= limite) break
      const item = REFERENCIA_ALIMENTOS.find((a) => a.nombre === nombre)
      if (!item) continue
      const key = item.nombre.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ ...item, _idx: REFERENCIA_ALIMENTOS.indexOf(item), _score: 1 })
    }
  }

  return out
}
