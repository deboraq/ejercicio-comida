/** Convierte el formato viejo { fecha, vasos } al mapa por día { 'YYYY-MM-DD': vasos }. */
export function normalizarHidratacionPorDia(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  if (typeof value.vasos === 'number' && typeof value.fecha === 'string') {
    return value.fecha ? { [value.fecha]: Math.max(0, value.vasos) } : {}
  }
  const out = {}
  for (const [fecha, vasos] of Object.entries(value)) {
    if (fecha === 'fecha' || fecha === 'vasos') continue
    const n = Number(vasos)
    if (Number.isFinite(n) && n >= 0) out[fecha] = Math.min(10, Math.round(n))
  }
  return out
}

export function vasosHidratacionDia(map, fecha) {
  if (!fecha) return 0
  const n = normalizarHidratacionPorDia(map)[fecha]
  return Number.isFinite(n) ? n : 0
}

export function actualizarVasosHidratacion(map, fecha, vasos) {
  const base = normalizarHidratacionPorDia(map)
  const n = Math.max(0, Math.min(10, Math.round(vasos)))
  if (n === 0) {
    const { [fecha]: _omit, ...resto } = base
    return resto
  }
  return { ...base, [fecha]: n }
}
