import { GoogleGenerativeAI } from '@google/generative-ai'

export const GEMINI_SYSTEM_INSTRUCTION = `Sos el asistente de la app "Mi rutina" (nutrición y entrenamiento).
Respondé siempre en español (Argentina, claro y breve).

Reglas:
1) Para datos del usuario (qué comió, metas, ejercicio), usá SOLO el JSON de contexto. No inventes registros.
2) Si falta información en el contexto, decilo.
3) Para alimentos que NO están en el catálogo del contexto, podés ESTIMAR kcal y macros (P/C/G en gramos).
   Indicá que es aproximado y pedí porción si no está clara.
4) Si hay "catalogo_local_coincidencias", usá esos valores como fuente principal.
5) Al final de estimaciones de un alimento, incluí UNA línea exacta (sin markdown):
   ALIMENTO_JSON: {"descripcion":"...","calorias":0,"proteinas":0,"carbohidratos":0,"grasas":0,"porcion":"..."}
   Solo cuando des una estimación nutricional concreta de un alimento; si no aplica, omití esa línea.`

export function extraerAlimentoJson(text) {
  if (!text) return null
  const m = String(text).match(/ALIMENTO_JSON:\s*(\{[\s\S]*?\})/i)
  if (!m) return null
  try {
    const o = JSON.parse(m[1])
    if (!o?.descripcion) return null
    return {
      descripcion: String(o.descripcion).trim(),
      calorias: Math.max(0, Math.round(Number(o.calorias) || 0)),
      proteinas: Math.max(0, Math.round(Number(o.proteinas) || 0)),
      carbohidratos: Math.max(0, Math.round(Number(o.carbohidratos) || 0)),
      grasas: Math.max(0, Math.round(Number(o.grasas) || 0)),
      porcion: String(o.porcion || '').trim(),
    }
  } catch {
    return null
  }
}

export function respuestaVisible(text) {
  return String(text || '')
    .replace(/\n?ALIMENTO_JSON:\s*\{[\s\S]*?\}\s*/i, '')
    .trim()
}

export const GEMINI_MODELOS_FALLBACK = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

function esErrorCuota(err) {
  const msg = (err?.message || String(err)).toLowerCase()
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit')
  )
}

function esErrorModelo(err) {
  const msg = (err?.message || String(err)).toLowerCase()
  return msg.includes('404') || msg.includes('not found') || msg.includes('is not found for api version')
}

export function mensajeErrorGemini(err) {
  const msg = err?.message || String(err)
  if (esErrorCuota(err)) {
    return 'Límite de uso de Google (cuota free). Esperá 1–2 minutos, no toques varios ejemplos seguidos, o en Config elegí Gemini 2.5 Flash-Lite.'
  }
  if (/401|403|API key|invalid/i.test(msg)) {
    return 'La API de Gemini no está bien configurada en el servidor.'
  }
  if (/404|not found|model/i.test(msg)) {
    return 'Modelo no disponible. Probá otro modelo en Config.'
  }
  return msg || 'No se pudo consultar a Gemini.'
}

/**
 * @param {string} apiKey
 * @param {{ modelo?: string, pregunta: string, contexto: object, historial?: { role: string, text: string }[] }} params
 */
async function consultaConModelo(apiKey, modelId, { pregunta, contexto, historial = [] }) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
  })

  const contextBlock = JSON.stringify(contexto)
  const parts = []
  for (const h of historial.slice(-4)) {
    parts.push({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.text }],
    })
  }

  const userTurn = `Contexto (JSON):\n${contextBlock}\n\nPregunta:\n${pregunta.trim()}`
  const chat = model.startChat({ history: parts })
  const result = await chat.sendMessage(userTurn)
  const raw = result.response.text()
  return {
    raw,
    visible: respuestaVisible(raw),
    alimentoSugerido: extraerAlimentoJson(raw),
    modeloUsado: modelId,
  }
}

export async function ejecutarConsultaGemini(apiKey, { modelo = 'gemini-2.5-flash-lite', pregunta, contexto, historial = [] }) {
  const key = String(apiKey || '').trim()
  if (!key) throw new Error('GEMINI_API_KEY no configurada')

  const candidatos = [
    modelo,
    ...GEMINI_MODELOS_FALLBACK,
  ].filter(Boolean)
  const modelos = [...new Set(candidatos)]

  let lastErr = null
  for (const modelId of modelos) {
    try {
      return await consultaConModelo(key, modelId, { pregunta, contexto, historial })
    } catch (err) {
      lastErr = err
      if (!esErrorCuota(err) && !esErrorModelo(err)) break
    }
  }
  throw lastErr || new Error('No se pudo consultar a Gemini')
}
