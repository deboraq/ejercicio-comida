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

/** IDs estables en AI Studio (evitar 404 en free tier). */
export const GEMINI_MODELOS_FALLBACK = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash-lite',
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
  return (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('is not found for api version') ||
    msg.includes('response modalities') ||
    msg.includes('not supported by the model')
  )
}

export function mensajeErrorGemini(err) {
  const msg = err?.message || String(err)
  if (esErrorModelo(err)) {
    return 'Ningún modelo Gemini disponible con tu API key (404). En AI Studio → Claves de API, verificá que la key sea del proyecto Ejercicio-comida y que la API esté habilitada.'
  }
  if (/401|403|API key|invalid/i.test(msg)) {
    return 'La API de Gemini no está bien configurada en el servidor.'
  }
  if (esErrorCuota(err)) {
    return 'Límite de uso de Google (cuota free). Esperá 1–2 minutos e intentá de nuevo.'
  }
  if (/response modalities|not supported by the model/i.test(msg)) {
    return 'Modelo incorrecto (solo audio/imagen). Recargá la app; el servidor ya filtra modelos de texto.'
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

function esModeloTextoChat(modelId) {
  const id = String(modelId || '').toLowerCase()
  if (!id || !id.includes('gemini')) return false
  if (
    /tts|audio|transcri|embed|image|imagen|banana|omni|live|aqa|robotics|computer-use|deep-research/.test(
      id,
    )
  ) {
    return false
  }
  return /flash|pro|gemma|learnlm|thinking/.test(id) || /^gemini-\d/.test(id)
}

/** Modelos de chat con salida TEXTO (excluye TTS/audio-only que dan 400). */
export async function listarModelosGemini(apiKey) {
  const key = String(apiKey || '').trim()
  if (!key) return []
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((id) => esModeloTextoChat(id))
  } catch {
    return []
  }
}

function scoreModeloTexto(id) {
  const x = id.toLowerCase()
  let s = 0
  if (/flash/.test(x)) s += 20
  if (/flash-lite|flash-8b/.test(x)) s += 8
  if (/1\.5-flash/.test(x)) s += 15
  if (/2\.0-flash/.test(x)) s += 14
  if (/2\.5-flash/.test(x) && !/tts|preview-tts/.test(x)) s += 12
  if (/pro/.test(x)) s += 5
  if (/preview|exp|experimental|thinking/.test(x)) s -= 10
  if (/tts|audio/.test(x)) s -= 100
  return s
}

function ordenarModelosPreferidos(ids, preferido) {
  const pref = preferido && esModeloTextoChat(preferido) ? [preferido] : []
  const fallback = GEMINI_MODELOS_FALLBACK.filter(esModeloTextoChat)
  const fromApi = [...ids].sort((a, b) => scoreModeloTexto(b) - scoreModeloTexto(a))
  return [...new Set([...pref, ...fallback, ...fromApi])]
}

export async function ejecutarConsultaGemini(apiKey, { modelo = 'gemini-1.5-flash', pregunta, contexto, historial = [] }) {
  const key = String(apiKey || '').trim()
  if (!key) throw new Error('GEMINI_API_KEY no configurada')

  const disponibles = await listarModelosGemini(key)
  const modelos =
    disponibles.length > 0
      ? ordenarModelosPreferidos(disponibles, modelo).slice(0, 12)
      : [...new Set([modelo, ...GEMINI_MODELOS_FALLBACK].filter(Boolean))]

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
