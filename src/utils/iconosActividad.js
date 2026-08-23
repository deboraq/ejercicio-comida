import { getCategoriaTipo } from './calorias'

/** Icono y tono visual por tipo de actividad (clave del selector). */
const ICONO_POR_TIPO = {
  // Cardio / Aeróbico
  caminata_lenta: { icon: '🚶', tone: 'green' },
  caminata_rapida: { icon: '🚶‍♂️', tone: 'green' },
  correr_8: { icon: '🏃', tone: 'green' },
  correr_10: { icon: '🏃', tone: 'green' },
  correr_12: { icon: '🏃‍♂️', tone: 'green' },
  bici_estatica_ligera: { icon: '🚴', tone: 'green' },
  bici_estatica_moderada: { icon: '🚴', tone: 'green' },
  bici_estatica_intensa: { icon: '🚴‍♂️', tone: 'green' },
  bici_aire_paseo: { icon: '🚴', tone: 'green' },
  bici_aire_intensa: { icon: '🚴‍♂️', tone: 'green' },
  nadar_suave: { icon: '🏊', tone: 'blue' },
  nadar_moderado: { icon: '🏊', tone: 'blue' },
  nadar_intenso: { icon: '🏊‍♂️', tone: 'blue' },
  eliptica: { icon: '⭕', tone: 'green' },
  escaladora: { icon: '🧗', tone: 'green' },
  saltar_cuerda: { icon: '🪢', tone: 'green' },
  escaleras: { icon: '🪜', tone: 'green' },
  hiit: { icon: '🔥', tone: 'orange' },
  patinar: { icon: '⛸️', tone: 'blue' },
  remo: { icon: '🚣', tone: 'blue' },
  // Fuerza
  pesas_general: { icon: '🏋️', tone: 'gray' },
  pesas_intenso: { icon: '🏋️‍♂️', tone: 'gray' },
  crossfit: { icon: '💪', tone: 'gray' },
  peso_corporal: { icon: '🤸', tone: 'gray' },
  funcional: { icon: '⚡', tone: 'gray' },
  // Flexibilidad / Mente-cuerpo
  estiramiento: { icon: '🙆', tone: 'purple' },
  yoga_suave: { icon: '🧘', tone: 'purple' },
  yoga_moderado: { icon: '🧘‍♀️', tone: 'purple' },
  pilates: { icon: '🤸‍♀️', tone: 'purple' },
  // Deportes
  futbol: { icon: '⚽', tone: 'blue' },
  tenis_singles: { icon: '🎾', tone: 'blue' },
  tenis_dobles: { icon: '🎾', tone: 'blue' },
  baloncesto: { icon: '🏀', tone: 'blue' },
  voleibol: { icon: '🏐', tone: 'blue' },
  padel: { icon: '🎾', tone: 'blue' },
  rugby: { icon: '🏉', tone: 'blue' },
  artes_marciales: { icon: '🥊', tone: 'blue' },
  // Otro + datos antiguos por categoría
  otro: { icon: '⚡', tone: 'muted' },
  Cardio: { icon: '🏃', tone: 'green' },
  Fuerza: { icon: '🏋️', tone: 'gray' },
  Flexibilidad: { icon: '🧘', tone: 'purple' },
  Deportes: { icon: '🏅', tone: 'blue' },
  Otro: { icon: '⚡', tone: 'muted' },
}

const CATEGORIA_FALLBACK = {
  Cardio: { icon: '🏃', tone: 'green' },
  Fuerza: { icon: '🏋️', tone: 'gray' },
  Flexibilidad: { icon: '🧘', tone: 'purple' },
  Deportes: { icon: '🏅', tone: 'blue' },
  Otro: { icon: '⚡', tone: 'muted' },
}

/** Heurística por fragmentos del value (tipos custom o variantes). */
function iconoPorFragmento(tipo) {
  const t = String(tipo).toLowerCase()
  if (/nadar|natac|swim/.test(t)) return { icon: '🏊', tone: 'blue' }
  if (/correr|trote|run|jog/.test(t)) return { icon: '🏃', tone: 'green' }
  if (/camin|walk|paseo/.test(t)) return { icon: '🚶', tone: 'green' }
  if (/bici|cicl|bike/.test(t)) return { icon: '🚴', tone: 'green' }
  if (/remo|row/.test(t)) return { icon: '🚣', tone: 'blue' }
  if (/patin|skat|roller/.test(t)) return { icon: '⛸️', tone: 'blue' }
  if (/elipt/.test(t)) return { icon: '⭕', tone: 'green' }
  if (/escal|climb/.test(t)) return { icon: '🧗', tone: 'green' }
  if (/cuerda|rope/.test(t)) return { icon: '🪢', tone: 'green' }
  if (/hiit|interval/.test(t)) return { icon: '🔥', tone: 'orange' }
  if (/yoga/.test(t)) return { icon: '🧘', tone: 'purple' }
  if (/pilates/.test(t)) return { icon: '🤸‍♀️', tone: 'purple' }
  if (/estir|stretch/.test(t)) return { icon: '🙆', tone: 'purple' }
  if (/pesa|muscul|fuerza|crossfit|gym/.test(t)) return { icon: '🏋️', tone: 'gray' }
  if (/futbol|soccer/.test(t)) return { icon: '⚽', tone: 'blue' }
  if (/tenis|padel/.test(t)) return { icon: '🎾', tone: 'blue' }
  if (/basket|baloncesto/.test(t)) return { icon: '🏀', tone: 'blue' }
  if (/voley|volley/.test(t)) return { icon: '🏐', tone: 'blue' }
  if (/rugby/.test(t)) return { icon: '🏉', tone: 'blue' }
  if (/box|martial|karate|judo/.test(t)) return { icon: '🥊', tone: 'blue' }
  return null
}

/**
 * Devuelve { icon, tone } para mostrar en historial y listas.
 * @param {string} tipo — value del selector o categoría legacy
 * @param {string} [nombre] — nombre del ejercicio (ayuda con datos antiguos tipo "Cardio")
 */
export function getIconoActividad(tipo, nombre = '') {
  if (tipo && ICONO_POR_TIPO[tipo]) return ICONO_POR_TIPO[tipo]
  const porTipo = iconoPorFragmento(tipo)
  if (porTipo) return porTipo
  const porNombre = iconoPorFragmento(nombre)
  if (porNombre) return porNombre
  const cat = getCategoriaTipo(tipo)
  return CATEGORIA_FALLBACK[cat] || CATEGORIA_FALLBACK.Otro
}
