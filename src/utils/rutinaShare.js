import { ejercicioDiaAJson } from './rutinaEjercicioDia'

/** JSON mínimo para compartir / importar (sin ids de rutina; se regeneran al importar). */
export function exportarRutinaAJson(rutina) {
  if (!rutina) return ''
  return JSON.stringify({
    nombre: rutina.nombre || 'Rutina',
    dias: (rutina.dias || []).map((d) => {
      const ej = (d.ejercicios || []).map((e) => ejercicioDiaAJson(e)).filter((x) => x != null && (typeof x === 'string' ? x : x.nombre))
      return {
        nombre: d.nombre || 'Día',
        ejercicios: ej,
      }
    }),
  })
}

export function rutinaDesdeJsonAsignada(texto, asignadaPorDefecto = 'Entrenador') {
  const obj = JSON.parse(String(texto).trim())
  if (!obj || typeof obj !== 'object') throw new Error('El contenido no es un objeto JSON.')
  const nombre = String(obj.nombre || 'Rutina asignada').trim() || 'Rutina asignada'
  let diasRaw = obj.dias
  if (!Array.isArray(diasRaw) || diasRaw.length === 0) {
    diasRaw = [{ nombre: 'Día 1', ejercicios: [] }]
  }
  const base = Date.now()
  const dias = diasRaw.map((d, i) => {
    const nm = String(d?.nombre || `Día ${i + 1}`).trim() || `Día ${i + 1}`
    const rawEj = Array.isArray(d?.ejercicios) ? d.ejercicios : []
    const ej = rawEj
      .map((e) => {
        if (e == null) return null
        if (typeof e === 'string') return e.trim() || null
        if (typeof e === 'object' && e.nombre != null) {
          const o = { nombre: String(e.nombre).trim() }
          if (!o.nombre) return null
          if (e.series != null && String(e.series).trim()) o.series = String(e.series).trim()
          if (e.repeticiones != null && String(e.repeticiones).trim()) o.repeticiones = String(e.repeticiones).trim()
          return o.series || o.repeticiones ? o : o.nombre
        }
        return null
      })
      .filter(Boolean)
    return { id: `d_asig_${base}_${i}`, nombre: nm, ejercicios: ej }
  })
  const por = String(obj.asignadaPor ?? asignadaPorDefecto).trim() || asignadaPorDefecto
  return {
    id: `r_asig_${base}_${Math.random().toString(36).slice(2, 9)}`,
    nombre,
    dias,
    _asignacion: { por, fecha: new Date().toISOString().slice(0, 10) },
  }
}
