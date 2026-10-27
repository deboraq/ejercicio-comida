/** Historial del asistente en sessionStorage (tab) con TTL. */

const TTL_MS = 45 * 60 * 1000
const MAX_MENSAJES = 40

function storageKey(userId) {
  return `asistente_chat_v1_${String(userId || 'anon')}`
}

export function leerAsistenteChatCache(userId) {
  if (typeof sessionStorage === 'undefined' || !userId) return null
  try {
    const raw = sessionStorage.getItem(storageKey(userId))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.updatedAt || !Array.isArray(data.mensajes)) return null
    if (Date.now() - data.updatedAt > TTL_MS) {
      sessionStorage.removeItem(storageKey(userId))
      return null
    }
    return {
      mensajes: data.mensajes.slice(-MAX_MENSAJES),
      ultimoAlimento: data.ultimoAlimento || null,
      ultimoPlanRegistro: data.ultimoPlanRegistro || null,
    }
  } catch {
    return null
  }
}

export function guardarAsistenteChatCache(userId, payload) {
  if (typeof sessionStorage === 'undefined' || !userId) return
  try {
    const mensajes = Array.isArray(payload?.mensajes) ? payload.mensajes.slice(-MAX_MENSAJES) : []
    sessionStorage.setItem(
      storageKey(userId),
      JSON.stringify({
        updatedAt: Date.now(),
        mensajes,
        ultimoAlimento: payload?.ultimoAlimento || null,
        ultimoPlanRegistro: payload?.ultimoPlanRegistro || null,
      }),
    )
  } catch {
    /* quota / private mode */
  }
}

export function limpiarAsistenteChatCache(userId) {
  if (typeof sessionStorage === 'undefined' || !userId) return
  try {
    sessionStorage.removeItem(storageKey(userId))
  } catch {
    /* ignore */
  }
}
