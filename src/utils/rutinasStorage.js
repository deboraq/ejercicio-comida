export const RUTINA_PRINCIPAL_ID_PREFERIDO = 'r_default'

export function normalizarNombreRutina(nombre) {
  return String(nombre || '')
    .trim()
    .toLowerCase()
}

export function esRutinaPrincipalNombre(nombre) {
  return normalizarNombreRutina(nombre) === 'rutina principal'
}

function contarEjerciciosRutina(rutina) {
  if (!rutina?.dias) return 0
  return rutina.dias.reduce((s, d) => s + (Array.isArray(d.ejercicios) ? d.ejercicios.length : 0), 0)
}

function prioridadRutinaPrincipal(r) {
  if (r?.id === RUTINA_PRINCIPAL_ID_PREFERIDO) return 0
  if (r?.id === 'r1') return 1
  return 100 - contarEjerciciosRutina(r)
}

/** Evita varias «Rutina principal» por sync/local + ids distintos. */
export function dedupeRutinasPropias(list) {
  if (!Array.isArray(list) || list.length <= 1) return list

  const byId = new Map()
  for (const r of list) {
    if (!r || r.id == null) continue
    byId.set(String(r.id), r)
  }
  let arr = [...byId.values()]
  if (arr.length <= 1) return arr

  const principals = arr.filter((r) => esRutinaPrincipalNombre(r.nombre))
  if (principals.length <= 1) return arr

  const sorted = [...principals].sort(
    (a, b) => prioridadRutinaPrincipal(a) - prioridadRutinaPrincipal(b),
  )
  const keeperId = sorted[0].id
  const dropIds = new Set(principals.filter((p) => p.id !== keeperId).map((p) => p.id))
  if (!dropIds.size) return arr

  return arr.filter((r) => !dropIds.has(r.id))
}

export function rutinasListChanged(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return true
  if (a.length !== b.length) return true
  const idsA = a.map((r) => r?.id).join('|')
  const idsB = b.map((r) => r?.id).join('|')
  return idsA !== idsB
}
