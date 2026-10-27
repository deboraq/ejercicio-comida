import { buildAsistenteContexto } from './asistenteContexto.js'
import { mergeRutinasUsuario } from './asistenteRutinas.js'

const ASISTENTE_DATA_KEYS = [
  'config',
  'comida',
  'ejercicios',
  'planMes1Estado',
  'planPropio',
  'planNutricionActivoId',
  'planesNutricion',
  'rutinas',
  'rutinasAsignadas',
  'rutinaActivaId',
  'rutinaPesos',
]

function parseJsonValue(raw) {
  if (raw == null) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

/**
 * Lee user_data del usuario autenticado (RLS: solo su fila).
 * @param {{ supabaseUrl: string, anonKey: string }} env
 * @param {string} token JWT del usuario
 * @param {string} userId
 */
export async function fetchUserDataForAsistente(env, token, userId) {
  const { supabaseUrl, anonKey } = env
  const url = `${supabaseUrl}/rest/v1/user_data?user_id=eq.${encodeURIComponent(userId)}&select=key,value`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      Accept: 'application/json',
    },
  })
  if (!res.ok) return { map: {}, error: `user_data ${res.status}` }
  const rows = await res.json()
  const map = Object.create(null)
  for (const row of rows || []) {
    if (row?.key != null) map[row.key] = row.value
  }
  return { map, error: null }
}

export function buildContextoDesdeUserData(map, pregunta, fechaRef) {
  const config = parseJsonValue(map.config) || {}
  const comida = Array.isArray(parseJsonValue(map.comida)) ? parseJsonValue(map.comida) : []
  const ejercicios = Array.isArray(parseJsonValue(map.ejercicios)) ? parseJsonValue(map.ejercicios) : []
  const planMes1Estado = parseJsonValue(map.planMes1Estado)
  const planPropio = parseJsonValue(map.planPropio)
  const rawPlanId = map.planNutricionActivoId
  const parsedPlanId = parseJsonValue(rawPlanId)
  const planNutricionActivoId =
    parsedPlanId != null && parsedPlanId !== ''
      ? String(parsedPlanId)
      : typeof rawPlanId === 'string'
        ? rawPlanId
        : ''
  const rutinaPesos = Array.isArray(parseJsonValue(map.rutinaPesos)) ? parseJsonValue(map.rutinaPesos) : []
  const planesNutricion = Array.isArray(parseJsonValue(map.planesNutricion))
    ? parseJsonValue(map.planesNutricion)
    : []
  const rutinasPropias = Array.isArray(parseJsonValue(map.rutinas)) ? parseJsonValue(map.rutinas) : []
  const rutinasAsignadas = Array.isArray(parseJsonValue(map.rutinasAsignadas))
    ? parseJsonValue(map.rutinasAsignadas)
    : []
  const rutinas = mergeRutinasUsuario(rutinasPropias, rutinasAsignadas)
  const rawRutinaActiva = map.rutinaActivaId
  const parsedRutinaActiva = parseJsonValue(rawRutinaActiva)
  const rutinaActivaId =
    parsedRutinaActiva != null && parsedRutinaActiva !== ''
      ? String(parsedRutinaActiva)
      : typeof rawRutinaActiva === 'string'
        ? rawRutinaActiva
        : ''

  const fechaValida =
    fechaRef && /^\d{4}-\d{2}-\d{2}$/.test(String(fechaRef)) ? String(fechaRef) : undefined

  return buildAsistenteContexto({
    config,
    comida,
    ejercicios,
    pregunta,
    fechaRef: fechaValida,
    planMes1Estado,
    planPropio,
    planNutricionActivoId,
    rutinaPesos,
    planesNutricion,
    rutinas,
    rutinaActivaId,
  })
}

export { ASISTENTE_DATA_KEYS }
