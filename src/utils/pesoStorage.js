import { fechaSoloDia, fechaToISO } from './calorias'

function parsePesoKg(value) {
  const n = parseFloat(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0 || n > 400) return null
  return Math.round(n * 10) / 10
}

/** Normaliza entradas de pesoHistorial (incluye formatos viejos). */
export function normalizarPesoHistorial(value) {
  if (value == null) return []

  let raw = value
  if (!Array.isArray(raw)) {
    if (typeof raw === 'object' && raw.pesoKg != null) {
      raw = [raw]
    } else {
      return []
    }
  }

  const porFecha = new Map()

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const pesoKg = parsePesoKg(item.pesoKg ?? item.peso ?? item.kg)
    if (pesoKg == null) continue

    const fecha = fechaSoloDia(item.fecha) || fechaToISO(new Date())
    const prev = porFecha.get(fecha)
    const entry = {
      id: item.id || prev?.id || crypto.randomUUID(),
      fecha,
      pesoKg,
      notas: String(item.notas || prev?.notas || '').trim(),
    }
    porFecha.set(fecha, entry)
  }

  return [...porFecha.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export function crearEntradaPeso(pesoKg, fecha = fechaToISO(new Date()), notas = '') {
  const kg = parsePesoKg(pesoKg)
  if (kg == null) return null
  return {
    id: crypto.randomUUID(),
    fecha: fechaSoloDia(fecha) || fechaToISO(new Date()),
    pesoKg: kg,
    notas: String(notas || '').trim(),
  }
}

/** Si no hay historial pero config tiene peso, crea una entrada inicial. */
export function sembrarPesoDesdeConfig(historial, config) {
  const lista = normalizarPesoHistorial(historial)
  if (lista.length > 0) return lista

  const kg = parsePesoKg(config?.pesoKg)
  if (kg == null) return lista

  const entrada = crearEntradaPeso(kg)
  return entrada ? [entrada] : lista
}
