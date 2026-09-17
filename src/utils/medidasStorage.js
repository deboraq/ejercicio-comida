import { fechaSoloDia, fechaToISO } from './calorias'
import { CAMPOS_MEDIDAS, parseCm } from './medidas'

function camposDeItem(item) {
  const out = {}
  for (const { key } of CAMPOS_MEDIDAS) {
    const cm = parseCm(item?.[key])
    if (cm != null) out[key] = cm
  }
  return out
}

/** Normaliza medidasHistorial (ids, fechas, dedupe por día). */
export function normalizarMedidasHistorial(value) {
  if (value == null) return []

  let raw = value
  if (!Array.isArray(raw)) {
    if (typeof raw === 'object') {
      raw = [raw]
    } else {
      return []
    }
  }

  const porFecha = new Map()

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const nuevos = camposDeItem(item)
    if (Object.keys(nuevos).length === 0) continue

    const fecha = fechaSoloDia(item.fecha) || fechaToISO(new Date())
    const prev = porFecha.get(fecha)
    const merged = prev ? { ...camposDeItem(prev), ...nuevos } : nuevos

    porFecha.set(fecha, {
      id: item.id || prev?.id || crypto.randomUUID(),
      fecha,
      notas: String(item.notas || prev?.notas || '').trim(),
      ...merged,
    })
  }

  return [...porFecha.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))
}
