import { itemPlanDesdeLinea, lineaDesdeItemPlan, numeroFlexibleO } from './comidaLineItems.js'

export function textoDesdeItems(items) {
  return (items || [])
    .filter((i) => i?.descripcion?.trim())
    .map((i) => {
      const p = i.porciones?.trim()
      return p ? `${i.descripcion} (${p})` : i.descripcion
    })
    .join(' + ')
}

export function totalesMacrosItems(items) {
  return (items || []).reduce(
    (acc, it) => ({
      kcal: acc.kcal + numeroFlexibleO(it.calorias),
      p: redondear(acc.p + numeroFlexibleO(it.proteinas)),
      h: redondear(acc.h + numeroFlexibleO(it.carbohidratos)),
      g: redondear(acc.g + numeroFlexibleO(it.grasas)),
    }),
    { kcal: 0, p: 0, h: 0, g: 0 },
  )
}

function redondear(n) {
  return Math.round(n * 10) / 10
}

/** @returns {{ texto: string, items: object[] }} */
export function parseOpcionPlan(val) {
  if (val == null || val === '') return { texto: '', items: [] }
  if (typeof val === 'string') {
    return { texto: val.trim(), items: [] }
  }
  if (typeof val === 'object') {
    const items = Array.isArray(val.items)
      ? val.items.map((i) => lineaDesdeItemPlan(i)).filter(Boolean)
      : []
    const texto = String(val.texto || '').trim() || textoDesdeItems(items)
    return { texto, items }
  }
  return { texto: '', items: [] }
}

export function opcionPlanParaGuardar(lineItems) {
  const items = (lineItems || [])
    .filter((it) => it?.descripcion?.trim())
    .map(itemPlanDesdeLinea)
  if (!items.length) return ''
  return {
    texto: textoDesdeItems(items),
    items,
  }
}

export function macrosOpcionPlan(opcionParsed, slotId, fallbackEstimado) {
  if (opcionParsed?.items?.length) {
    return totalesMacrosItems(opcionParsed.items)
  }
  return fallbackEstimado()
}
