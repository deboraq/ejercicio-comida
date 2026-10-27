import { GoogleGenerativeAI } from '@google/generative-ai'
import { compactarContextoParaGemini } from './asistenteContextoCompact.js'
import {
  GEMINI_SYSTEM_INSTRUCTION,
  extraerAlimentoJson,
  extraerPlanRegistroJson,
  respuestaVisible,
  GEMINI_MODELO_CHAT_DEFAULT,
  esModeloChatPermitido,
  resolverModelosChat,
  resolverModelosChatRapido,
  esErrorReintentarConOtroModelo,
} from './geminiCoreShared.js'
import {
  esIntentRegistroComida,
  extraerAlimentoDesdeRespuestaLibre,
} from './asistenteRegistroIntent.js'

export * from './geminiCoreShared.js'

async function consultaConModelo(apiKey, modelId, { pregunta, contexto, historial = [] }) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
    generationConfig: {
      maxOutputTokens: 512,
      temperature: 0.3,
    },
  })

  const contextBlock = JSON.stringify(compactarContextoParaGemini(contexto))
  const parts = []
  for (const h of historial.slice(-2)) {
    parts.push({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.text }],
    })
  }

  const userTurn = `Contexto (JSON):\n${contextBlock}\n\nPregunta:\n${pregunta.trim()}`
  const chat = model.startChat({ history: parts })
  const result = await chat.sendMessage(userTurn)
  const raw = result.response.text()
  const visible = respuestaVisible(raw)
  const planRegistroSugerido = extraerPlanRegistroJson(raw)
  let alimentoSugerido = extraerAlimentoJson(raw)
  if (
    !alimentoSugerido &&
    !planRegistroSugerido &&
    esIntentRegistroComida(pregunta)
  ) {
    alimentoSugerido = extraerAlimentoDesdeRespuestaLibre(visible, pregunta)
  }
  return {
    raw,
    visible,
    alimentoSugerido,
    planRegistroSugerido,
    modeloUsado: modelId,
  }
}

export async function ejecutarConsultaGemini(
  apiKey,
  { modelo = GEMINI_MODELO_CHAT_DEFAULT, pregunta, contexto, historial = [] },
) {
  const key = String(apiKey || '').trim()
  if (!key) throw new Error('GEMINI_API_KEY no configurada')

  const usarListaApi = process.env.GEMINI_LISTAR_MODELOS === '1'
  const modelos = usarListaApi
    ? await resolverModelosChat(key, modelo)
    : resolverModelosChatRapido(modelo)

  let lastErr = null
  for (let i = 0; i < modelos.length; i += 1) {
    const modelId = modelos[i]
    if (!esModeloChatPermitido(modelId)) continue
    try {
      return await consultaConModelo(key, modelId, { pregunta, contexto, historial })
    } catch (err) {
      lastErr = err
      if (!esErrorReintentarConOtroModelo(err) || i >= modelos.length - 1) break
      await new Promise((r) => setTimeout(r, 120))
    }
  }
  throw lastErr || new Error('No se pudo consultar a Gemini')
}
