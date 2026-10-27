/** Rutinas propias + asignadas (sin duplicar id) para el asistente. */
export function mergeRutinasUsuario(propias, asignadas) {
  const p = Array.isArray(propias) ? propias : []
  const a = Array.isArray(asignadas) ? asignadas : []
  if (!a.length) return p
  const ids = new Set(p.map((r) => r?.id).filter(Boolean))
  return [...p, ...a.filter((r) => r?.id && !ids.has(r.id))]
}

export function rutinaActivaDeLista(rutinas, rutinaActivaId) {
  const list = Array.isArray(rutinas) ? rutinas : []
  if (!list.length) return null
  if (rutinaActivaId) {
    const found = list.find((r) => r.id === rutinaActivaId)
    if (found) return found
  }
  return list[0]
}

/** Día N del plan → día (índice) del ciclo de la rutina que cargó el usuario. */
export function indiceDiaRutinaParaDiaPlan(diaPlan, rutinas, rutinaActivaId) {
  const n = Number(diaPlan)
  if (!Number.isFinite(n) || n < 1) return null
  const rutina = rutinaActivaDeLista(rutinas, rutinaActivaId)
  const dias = rutina?.dias || []
  if (!dias.length) return null
  return (n - 1) % dias.length
}

export function resumenRutinaActivaUsuario(rutinas, rutinaActivaId) {
  const rutina = rutinaActivaDeLista(rutinas, rutinaActivaId)
  if (!rutina) {
    return { tiene_rutina: false, mensaje: 'Sin rutina de gym cargada en la app' }
  }
  const dias = rutina.dias || []
  return {
    tiene_rutina: true,
    rutina_activa_id: rutina.id,
    nombre: rutina.nombre || 'Rutina',
    asignada_por_profe: Boolean(rutina._asignacion?.assignmentId),
    dias_entrenamiento: dias.map((d, i) => ({
      indice: i,
      nombre: d.nombre || `Día ${i + 1}`,
      ejercicios_count: (d.ejercicios || []).length,
    })),
    total_dias_ciclo: dias.length,
  }
}
