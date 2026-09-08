/** Tonos visuales compartidos entre workshop y modal de catálogo. */
export function grupoMuscularTone(grupo) {
  const g = String(grupo || '').toLowerCase()
  if (g.includes('calentamiento') || g.includes('cardio') || g.includes('running')) return 'core'
  if (g.includes('pecho')) return 'chest'
  if (g.includes('espalda')) return 'back'
  if (g.includes('pierna') || g.includes('glúteo')) return 'legs'
  if (g.includes('hombro') || g.includes('delto')) return 'shoulder'
  if (g.includes('bíceps') || g.includes('tríceps') || g.includes('brazo')) return 'arms'
  if (g.includes('core') || g.includes('abdomen')) return 'core'
  if (g.includes('natación') || g.includes('deporte') || g.includes('funcional')) return 'other'
  return 'other'
}
