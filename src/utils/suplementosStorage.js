import { fechaSoloDia } from './calorias'

/** Un registro por día, con `id` = fecha para merge en la nube. */
export function normalizarSuplementosPorDia(raw) {
  const list = Array.isArray(raw) ? raw : []
  const byFecha = new Map()

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const fecha = fechaSoloDia(entry.fecha ?? entry.id)
    if (!fecha) continue
    const items = Array.isArray(entry.items)
      ? entry.items.filter((x) => x != null && String(x).length > 0)
      : []
    const prev = byFecha.get(fecha)
    if (!prev) {
      byFecha.set(fecha, { id: fecha, fecha, items: [...new Set(items)] })
    } else {
      byFecha.set(fecha, {
        id: fecha,
        fecha,
        items: [...new Set([...prev.items, ...items])],
      })
    }
  }

  return [...byFecha.values()].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
}
