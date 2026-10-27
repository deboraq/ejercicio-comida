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

export function mensajeErrorGemini(err) {
  const msg = err?.message || String(err)
  if (/429|quota|rate/i.test(msg)) {
    return 'Límite de uso alcanzado. Esperá unos minutos e intentá de nuevo.'
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
export async function ejecutarConsultaGemini(apiKey, { modelo = 'gemini-2.0-flash', pregunta, contexto, historial = [] }) {
  const key = String(apiKey || '').trim()
  if (!key) throw new Error('GEMINI_API_KEY no configurada')

  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: modelo || 'gemini-2.0-flash',
    systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
  })

  const contextBlock = JSON.stringify(contexto, null, 2)
  const parts = []
  for (const h of historial.slice(-8)) {
    parts.push({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.text }],
    })
  }

  const userTurn = `Contexto actual (JSON):\n${contextBlock}\n\nPregunta del usuario:\n${pregunta.trim()}`

  const chat = model.startChat({ history: parts })
  const result = await chat.sendMessage(userTurn)
  const raw = result.response.text()
  return {
    raw,
    visible: respuestaVisible(raw),
    alimentoSugerido: extraerAlimentoJson(raw),
  }
}
