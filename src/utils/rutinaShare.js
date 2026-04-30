/** JSON mínimo para compartir / importar (sin ids de rutina; se regeneran al importar). */
export function exportarRutinaAJson(rutina) {
  if (!rutina) return ''
  return JSON.stringify({
    nombre: rutina.nombre || 'Rutina',
    dias: (rutina.dias || []).map((d) => ({
      nombre: d.nombre || 'Día',
      ejercicios: [...(d.ejercicios || [])],
    })),
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
    const ej = Array.isArray(d?.ejercicios) ? d.ejercicios.map((e) => String(e).trim()).filter(Boolean) : []
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
