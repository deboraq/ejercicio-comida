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
  esErrorCuota,
  esErrorModelo,
} from './geminiCoreShared.js'

export * from './geminiCoreShared.js'

async function consultaConModelo(apiKey, modelId, { pregunta, contexto, historial = [] }) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.35,
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
  return {
    raw,
    visible: respuestaVisible(raw),
    alimentoSugerido: extraerAlimentoJson(raw),
    planRegistroSugerido: extraerPlanRegistroJson(raw),
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
  for (const modelId of modelos) {
    if (!esModeloChatPermitido(modelId)) continue
    try {
      return await consultaConModelo(key, modelId, { pregunta, contexto, historial })
    } catch (err) {
      lastErr = err
      if (!esErrorCuota(err) && !esErrorModelo(err)) break
    }
  }
  throw lastErr || new Error('No se pudo consultar a Gemini')
}
