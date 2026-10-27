import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  GEMINI_SYSTEM_INSTRUCTION,
  extraerAlimentoJson,
  respuestaVisible,
  mensajeErrorGemini,
} from '../../lib/geminiCore.js'

export { extraerAlimentoJson, respuestaVisible }

export const GEMINI_MODELOS_SUGERIDOS = [
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (recomendado, free tier)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B' },
]

async function consultarGeminiCliente(apiKey, params) {
  const key = String(apiKey || '').trim()
  if (!key) throw new Error('Falta API key personal (solo desarrollo local).')

  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: params.modelo || 'gemini-2.0-flash',
    systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
  })

  const contextBlock = JSON.stringify(params.contexto, null, 2)
  const parts = []
  for (const h of (params.historial || []).slice(-8)) {
    parts.push({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.text }],
    })
  }
  const userTurn = `Contexto actual (JSON):\n${contextBlock}\n\nPregunta del usuario:\n${params.pregunta.trim()}`
  const chat = model.startChat({ history: parts })
  const result = await chat.sendMessage(userTurn)
  const raw = result.response.text()
  return {
    raw,
    visible: respuestaVisible(raw),
    alimentoSugerido: extraerAlimentoJson(raw),
  }
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
      contexto: params.contexto,
      historial: params.historial,
      modelo: params.modelo,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Error del servidor (${res.status})`)
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
  modelo = 'gemini-2.0-flash',
  pregunta,
  contexto,
  historial = [],
}) {
  const params = { modelo, pregunta, contexto, historial }

  if (accessToken) {
    try {
      return await consultarGeminiServidor(accessToken, params)
    } catch (err) {
      if (err.status === 503 && apiKey?.trim()) {
        return consultarGeminiCliente(apiKey, params)
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
