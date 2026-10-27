import { buildAsistenteContexto } from '../src/utils/asistenteContexto.js'

const ASISTENTE_DATA_KEYS = [
  'config',
  'comida',
  'ejercicios',
  'planMes1Estado',
  'planPropio',
  'planNutricionActivoId',
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

export function buildContextoDesdeUserData(map, pregunta) {
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

  return buildAsistenteContexto({
    config,
    comida,
    ejercicios,
    pregunta,
    planMes1Estado,
    planPropio,
    planNutricionActivoId,
    rutinaPesos,
  })
}

export { ASISTENTE_DATA_KEYS }
