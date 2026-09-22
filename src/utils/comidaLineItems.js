import { nuevoIdRegistro } from './ids.js'

export function numeroFlexible(valor) {
  if (valor == null || valor === '') return null
  const n = Number(String(valor).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function numeroFlexibleO(valor, fallback = 0) {
  const n = numeroFlexible(valor)
  return n == null ? fallback : n
}

export function redondear1(n) {
  return Math.round(n * 10) / 10
}

export function normalizarCantidad(valor, fallback = 1) {
  const n = numeroFlexible(valor)
  if (n == null || n <= 0) return fallback
  return Math.max(0.25, Math.min(99, Math.round(n * 100) / 100))
}

function textoPorcionDesdeRef(porcionRef, n) {
  const t = porcionRef || 'porción'
  if (n === 1) return t
  return `${n} × (${t})`
}

function grasasDesdeReferencia(itemRef) {
  if (itemRef.grasas != null && Number.isFinite(Number(itemRef.grasas))) {
    return Number(itemRef.grasas)
  }
  return Math.max(
    0,
    Math.round(((itemRef.calorias - itemRef.proteinas * 4 - itemRef.carbohidratos * 4) / 9) * 10) / 10,
  )
}

export function buildItemDesdeReferencia(itemRef, cantidad) {
  const n = normalizarCantidad(cantidad, 1)
  const gra = grasasDesdeReferencia(itemRef)
  const base = { cal: itemRef.calorias, pro: itemRef.proteinas, car: itemRef.carbohidratos, gra }
  const porcionRef = itemRef.porcion || 'porción'
  return {
    id: nuevoIdRegistro(),
    descripcion: itemRef.nombre,
    cantidad: n,
    _cantidadPrev: n,
    calorias: String(Math.round(base.cal * n)),
    proteinas: String(redondear1(base.pro * n)),
    carbohidratos: String(redondear1(base.car * n)),
    grasas: String(redondear1(base.gra * n)),
    porciones: textoPorcionDesdeRef(porcionRef, n),
    _macrosPorUnidad: base,
    _porcionRef: porcionRef,
    _categoria: itemRef.categoria || undefined,
    _refNombre: itemRef.nombre,
  }
}

export function manualFormValido(form) {
  if (!form?.descripcion?.trim()) return false
  const cal = numeroFlexible(form.calorias)
  return cal != null && cal >= 0
}

export function buildItemDesdeManual(form, cantidad) {
  const n = normalizarCantidad(cantidad, 1)
  const calUnit = numeroFlexible(form.calorias) ?? 0
  const proUnit = numeroFlexible(form.proteinas) ?? 0
  const carUnit = numeroFlexible(form.carbohidratos) ?? 0
  const graRaw = numeroFlexible(form.grasas)
  const graUnit = graRaw != null
    ? graRaw
    : Math.max(0, redondear1((calUnit - proUnit * 4 - carUnit * 4) / 9))
  const porcionTxt = form.porciones?.trim()
  return {
    id: nuevoIdRegistro(),
    descripcion: form.descripcion.trim(),
    cantidad: n,
    _cantidadPrev: n,
    calorias: String(Math.round(calUnit * n)),
    proteinas: String(redondear1(proUnit * n)),
    carbohidratos: String(redondear1(carUnit * n)),
    grasas: String(redondear1(graUnit * n)),
    porciones: porcionTxt || (n === 1 ? '1 porción' : `${n} porciones`),
    _macrosPorUnidad: { cal: calUnit, pro: proUnit, car: carUnit, gra: graUnit },
    _categoria: 'Personalizado',
  }
}

/** Formato persistido en plan propio (sin campos internos _). */
export function itemPlanDesdeLinea(it) {
  return {
    descripcion: String(it.descripcion || '').trim(),
    calorias: numeroFlexibleO(it.calorias),
    proteinas: numeroFlexibleO(it.proteinas),
    carbohidratos: numeroFlexibleO(it.carbohidratos),
    grasas: numeroFlexibleO(it.grasas),
    porciones: it.porciones?.trim() || undefined,
    refNombre: it._refNombre || undefined,
  }
}

export function lineaDesdeItemPlan(stored) {
  if (!stored?.descripcion) return null
  const cal = Number(stored.calorias) || 0
  const pro = Number(stored.proteinas) || 0
  const car = Number(stored.carbohidratos) || 0
  const gra = Number(stored.grasas) || 0
  const n = 1
  return {
    id: nuevoIdRegistro(),
    descripcion: stored.descripcion,
    cantidad: n,
    _cantidadPrev: n,
    calorias: String(Math.round(cal)),
    proteinas: String(redondear1(pro)),
    carbohidratos: String(redondear1(car)),
    grasas: String(redondear1(gra)),
    porciones: stored.porciones || '1 porción',
    _macrosPorUnidad: { cal, pro, car, gra },
    _refNombre: stored.refNombre,
    _categoria: stored.refNombre ? undefined : 'Personalizado',
  }
}
