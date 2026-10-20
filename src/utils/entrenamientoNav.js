/** @typedef {'hub' | 'hoy' | 'gym' | 'actividades'} EntrenVista */

const GYM_VISTAS = new Set(['configurar', 'progreso', 'registrar'])

/**
 * @param {URLSearchParams} params
 * @returns {EntrenVista}
 */
export function leerVistaEntren(params) {
  const v = params.get('vista')
  if (v === 'hoy' || v === 'gym' || v === 'actividades' || v === 'hub') {
    return v === 'hub' ? 'hub' : v
  }
  if (params.get('modo') === 'hoy') return 'hoy'
  if (params.get('modo') === 'gym') return 'gym'
  if (params.get('seccion') === 'actividad') return 'actividades'
  return 'hub'
}

/**
 * @param {URLSearchParams} params
 * @returns {'configurar' | 'progreso' | 'registrar' | null}
 */
export function leerGymVista(params) {
  const g = params.get('gym')
  if (g && GYM_VISTAS.has(g)) return g
  return null
}

/**
 * Escribe vista canónica en params (elimina legacy modo/seccion/iniciar).
 * @param {URLSearchParams} params
 * @param {EntrenVista} vista
 * @param {{ gymVista?: string | null, fecha?: string | null }} [opts]
 */
export function escribirVistaEntren(params, vista, opts = {}) {
  params.delete('modo')
  params.delete('seccion')
  params.delete('iniciar')
  if (vista === 'hub') {
    params.delete('vista')
    params.delete('gym')
  } else {
    params.set('vista', vista)
  }
  if (vista === 'gym' && opts.gymVista && GYM_VISTAS.has(opts.gymVista)) {
    params.set('gym', opts.gymVista)
  } else {
    params.delete('gym')
  }
  if (opts.fecha) params.set('fecha', opts.fecha)
}

/**
 * Migra query legacy → canónica si hace falta.
 * @param {URLSearchParams} params
 * @returns {boolean} true si hubo cambios
 */
export function migrarParamsEntrenLegacy(params) {
  const tieneLegacy =
    params.has('modo') || params.get('seccion') === 'actividad' || params.get('iniciar') === '1'
  if (!tieneLegacy) return false
  let vista = leerVistaEntren(params)
  if (params.get('iniciar') === '1') vista = 'hoy'
  const gymVista = leerGymVista(params)
  const fecha = params.get('fecha')
  escribirVistaEntren(params, vista, { gymVista, fecha })
  return true
}
