import {
  GEMINI_MODELO_CHAT_DEFAULT,
  extraerAlimentoJson,
  respuestaVisible,
  mensajeErrorGemini,
  esModeloChatPermitido,
} from '../../lib/geminiCoreShared.js'

export { extraerAlimentoJson, respuestaVisible }

export const GEMINI_MODELOS_SUGERIDOS = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (~500/día, recomendado)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
  { id: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B' },
]

async function consultarGeminiCliente(apiKey, params) {
  const key = String(apiKey || '').trim()
  if (!key) throw new Error('Falta API key personal (solo desarrollo local).')
  const modelo =
    params.modelo && esModeloChatPermitido(params.modelo) ? params.modelo : GEMINI_MODELO_CHAT_DEFAULT
  const { ejecutarConsultaGemini } = await import('../../lib/geminiCore.js')
  return ejecutarConsultaGemini(key, { ...params, modelo })
}

async function consultarGeminiServidor(accessToken, params) {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      pregunta: params.pregunta,
      historial: params.historial,
      fechaRef: params.fechaRef || params.contexto?.fecha_hoy || null,
      comidaRegistrosCliente:
        typeof params.comidaRegistrosCliente === 'number' ? params.comidaRegistrosCliente : null,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(
      data.error ||
        (res.status === 403
          ? 'Iniciá sesión para usar las consultas con IA.'
          : `Error del servidor (${res.status})`),
    )
    err.status = res.status
    throw err
  }
  return data
}

/**
 * Prioridad: servidor (/api/gemini + sesión) → key personal en config (localhost).
 * @param {{
 *   accessToken?: string | null,
 *   apiKey?: string,
 *   modelo?: string,
 *   pregunta: string,
 *   contexto: object,
 *   historial?: { role: 'user' | 'model', text: string }[],
 * }} params
 */
export async function consultarGemini({
  accessToken,
  apiKey,
  modelo = GEMINI_MODELO_CHAT_DEFAULT,
  pregunta,
  contexto,
  historial = [],
  fechaRef = null,
  comidaRegistrosCliente = null,
}) {
  const params = {
    modelo,
    pregunta,
    contexto,
    historial,
    fechaRef,
    comidaRegistrosCliente,
  }

  if (accessToken) {
    try {
      return await consultarGeminiServidor(accessToken, params)
    } catch (err) {
      if (apiKey?.trim() && (err.status === 503 || err.status === 404)) {
        return consultarGeminiCliente(apiKey, params)
      }
      if (import.meta.env.DEV && err.status === 404) {
        throw new Error(
          'No hay API en este puerto (solo front con Vite). Reiniciá con el proxy en vite.config o usá `npx vercel dev`. También podés probar la app publicada en Vercel.',
        )
      }
      throw new Error(err.message || mensajeErrorGemini(err))
    }
  }

  if (apiKey?.trim()) {
    try {
      return await consultarGeminiCliente(apiKey, params)
    } catch (err) {
      throw new Error(mensajeErrorGemini(err))
    }
  }

  throw new Error('Iniciá sesión para usar el asistente (o configurá GEMINI_API_KEY en Vercel).')
}
