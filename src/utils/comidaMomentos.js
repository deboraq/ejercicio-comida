import { textoSinAcentos } from './textoNormalizado.js'

/** Momentos del día para registro de comidas (fuente única). */
export const MOMENTOS_COMIDA = ['Desayuno', 'Almuerzo', 'Merienda', 'Snack', 'Cena']

export const MOMENTO_ICON = {
  Desayuno: '☕',
  Almuerzo: '🥗',
  Merienda: '🧁',
  Snack: '🍿',
  Cena: '🍽️',
  Otros: '📋',
}

/** Fracción de meta calórica diaria sugerida por momento (suma 1). */
export const META_MOMENTO_FRAC = {
  Desayuno: 0.22,
  Almuerzo: 0.32,
  Merienda: 0.12,
  Snack: 0.08,
  Cena: 0.26,
}

/** Hora de referencia si un ítem no tiene hora guardada. */
export const HORA_MOMENTO_DEFAULT = {
  Desayuno: '08:30 AM',
  Almuerzo: '13:15 PM',
  Merienda: '17:00 PM',
  Snack: '16:00 PM',
  Cena: '21:00 PM',
}

export function normalizarMomento(comida) {
  if (comida == null || comida === '') return ''
  return comida
}

export function esMomentoComida(comida) {
  const m = normalizarMomento(comida)
  return MOMENTOS_COMIDA.includes(m)
}

/** Detecta momento del día en frases como "en el almuerzo comí…". */
export function inferMomentoDesdeTexto(text) {
  const s = textoSinAcentos(text)
  if (!s) return ''
  if (/\balmuerzo\b/.test(s)) return 'Almuerzo'
  if (/\bdesayuno\b/.test(s)) return 'Desayuno'
  if (/\bmerienda\b/.test(s)) return 'Merienda'
  if (/\bcena\b/.test(s)) return 'Cena'
  if (/\b(snack|media\s*ma[nñ]ana|colaci[oó]n)\b/.test(s)) return 'Snack'
  return ''
}

/** Momento para prefill desde asistente (JSON + pregunta del usuario). */
export function resolverMomentoPrefillAsistente({ momento, preguntaUsuario, descripcion } = {}) {
  const m = normalizarMomento(momento)
  if (m && MOMENTOS_COMIDA.includes(m)) return m
  const inf =
    inferMomentoDesdeTexto(preguntaUsuario) || inferMomentoDesdeTexto(descripcion)
  return inf || 'Desayuno'
}
