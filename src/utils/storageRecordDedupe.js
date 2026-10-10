import { fechaSoloDia } from './calorias'
import { parsePlanRef, planRefSlotKey } from './planRegistroSync'

function stableStringify(obj) {
  try {
    return JSON.stringify(obj)
  } catch {
    return String(obj)
  }
}

/** Evita duplicados al fusionar nube + local (mismo registro, distinto id). */
export function registroSyncFingerprint(storageKey, item) {
  if (!item || typeof item !== 'object') return stableStringify(item)

  if (storageKey === 'ejercicios') {
    return [
      fechaSoloDia(item.fecha),
      String(item.nombre || '').trim().toLowerCase(),
      String(item.tipo || '').trim().toLowerCase(),
      String(item.duracionMin ?? item.minutos ?? ''),
      String(item.notas || '').trim(),
    ].join('|')
  }

  if (storageKey === 'comida') {
    if (item.planRef) {
      const slotKey = planRefSlotKey(item.planRef)
      if (slotKey) {
        return `plan-slot|${fechaSoloDia(item.fecha)}|${slotKey}`
      }
    }
    return [
      fechaSoloDia(item.fecha),
      String(item.nombre || item.descripcion || '').trim().toLowerCase(),
      String(item.calorias ?? ''),
      String(item.planRef || item.categoria || '').trim(),
      String(item.comida || item.momento || '').trim(),
    ].join('|')
  }

  if (storageKey === 'rutinaPesos') {
    return [
      fechaSoloDia(item.fecha),
      String(item.ejercicio || '').trim().toLowerCase(),
      String(item.rutinaId || ''),
      String(item.diaRutinaId || item.diaId || item.dia || ''),
      String(item.serieNum ?? item.serie ?? ''),
      String(item.repeticiones ?? item.reps ?? ''),
      String(item.pesoKg ?? item.peso ?? ''),
    ].join('|')
  }

  if (item.id != null) return String(item.id)
  return stableStringify(item)
}

export function dedupeRegistrosSync(storageKey, arr) {
  if (!Array.isArray(arr)) return arr
  const byId = new Map()
  const byFp = new Map()
  const out = []

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    if (item.id != null) {
      const id = String(item.id)
      if (byId.has(id)) continue
      byId.set(id, item)
      byFp.set(registroSyncFingerprint(storageKey, item), item)
      out.push(item)
      continue
    }
    const fp = registroSyncFingerprint(storageKey, item)
    if (byFp.has(fp)) continue
    byFp.set(fp, item)
    out.push(item)
  }

  return out
}
