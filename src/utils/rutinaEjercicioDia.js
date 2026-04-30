/**
 * Cada ítem de día puede ser string (legacy) u objeto { nombre, series?, repeticiones? }.
 * Los registros y la UI de alumno usan el nombre (string) como clave lógica.
 */
export function nombreDeEjercicioDiaItem(ex) {
  if (ex == null) return ''
  if (typeof ex === 'string') return ex.trim()
  if (typeof ex === 'object' && ex.nombre != null) return String(ex.nombre).trim()
  return String(ex).trim()
}

export function itemEjercicioDiaNormalizado(ex) {
  const nombre = nombreDeEjercicioDiaItem(ex)
  if (!nombre) return null
  if (typeof ex === 'string') {
    return { nombre, series: '', repeticiones: '' }
  }
  return {
    nombre,
    series: ex.series != null ? String(ex.series) : '',
    repeticiones: ex.repeticiones != null ? String(ex.repeticiones) : '',
  }
}

export function etiquetaPlanEjercicio(ex) {
  const it = itemEjercicioDiaNormalizado(ex)
  if (!it) return '—'
  const s = it.series?.trim()
  const r = it.repeticiones?.trim()
  if (s && r) return `${it.nombre} · ${s}×${r}`
  if (s) return `${it.nombre} · ${s} series`
  if (r) return `${it.nombre} · ${r} reps`
  return it.nombre
}

export function nombresEjerciciosDia(dia) {
  return (dia?.ejercicios || []).map(nombreDeEjercicioDiaItem).filter(Boolean)
}

/** Para JSON mínimo y payload en Supabase */
export function ejercicioDiaAJson(e) {
  const it = itemEjercicioDiaNormalizado(e)
  if (!it) return null
  const o = { nombre: it.nombre }
  if (it.series.trim()) o.series = it.series.trim()
  if (it.repeticiones.trim()) o.repeticiones = it.repeticiones.trim()
  if (Object.keys(o).length === 1) return o.nombre
  return o
}
