/** Utilidades Gemini sin SDK (seguro para el bundle principal del navegador). */

export const GEMINI_SYSTEM_INSTRUCTION = `Sos el asistente de la app "Mi rutina" (nutrición y entrenamiento).
Respondé siempre en español (Argentina, claro y breve).
Escribí en texto plano: NO uses markdown (nada de **negrita**, # títulos ni backticks). Para listas, una línea por ítem empezando con "- ".

Reglas:
1) Para datos del usuario (qué comió, metas, ejercicio), usá SOLO el JSON de contexto de ESE usuario. No inventes registros ni mezcles con otros.
   fecha_hoy es el día local del usuario (no UTC del servidor). Para "hoy" usá comida_hoy y comida_registros_total; si comida_hoy está vacío pero hay registros en comida_ultimos_7_dias o mes_en_curso, decilo con esos datos.
2) Si falta información en el contexto, decilo.
3) Para alimentos que NO están en el catálogo del contexto, podés ESTIMAR kcal y macros (P/C/G en gramos).
   Indicá que es aproximado y pedí porción si no está clara.
4) Si hay "catalogo_local_coincidencias", usá esos valores como base; si el usuario agregó algo (ej. aceitunas), ajustá kcal/macros y reflejalo en ALIMENTO_JSON.
5) Cuando des números concretos de kcal y macros (estimación o catálogo ajustado), SIEMPRE cerrá con UNA línea exacta (sin markdown):
   ALIMENTO_JSON: {"descripcion":"...","calorias":0,"proteinas":0,"carbohidratos":0,"grasas":0,"porcion":"...","momento":"Almuerzo"}
   momento = Desayuno, Almuerzo, Merienda, Snack o Cena si el usuario lo mencionó. La app muestra un botón "Usar en registro de comida" leyendo esa línea; sin ALIMENTO_JSON el usuario no puede cargar nada.
6) Si piden análisis del mes o cómo vienen, usá mes_en_curso, ultimos_30_dias y plan_alimentacion.
   Resumí tendencias (kcal, proteína, días con registro, ejercicio, adherencia al plan) y sugerí 2–4 acciones concretas.
7) Si preguntan por el plan de un día, usá plan_alimentacion.detalle_dias: listá comidas (opción 1 y 2) y en el mismo bloque
   ejercicio.rutina_gym (de rutina_gym_usuario / la rutina que cargó ese usuario, con ejercicios reales del JSON) y actividad_cardio_registrada.
   Si mencionan "día 3", usá detalle_dias["3"]; si no, el dia_plan_calendario. No uses rutinas genéricas ni otro usuario.
8) No digas "ya registré" ni "no puedo registrar en la app". Si piden registrar/marcar una opción EXACTA del plan (opción 1 o 2, sin cambios), usá PLAN_REGISTRO_JSON (la app marca el check en Mi plan):
   PLAN_REGISTRO_JSON: {"accion":"marcar","momento":"Almuerzo","opcion":2,"dia_plan":3,"textoPlan":"...texto exacto de la opción...","notas":"Plan · Día 3 · Almuerzo · Opción 2"}
9) Si intent_registro_comida es true en el contexto: el usuario quiere CARGAR comida. Respondé en 2–4 frases (totales finales de kcal y P/C/G). Obligatorio ALIMENTO_JSON (plato personalizado, catálogo ajustado o extras) o PLAN_REGISTRO_JSON (opción del plan sin cambios). Cerrá invitando a tocar el botón verde de la app; nunca digas que no podés registrar.`

export function extraerAlimentoJson(text) {
  if (!text) return null
  const m = String(text).match(/ALIMENTO_JSON:\s*(\{[\s\S]*?\})/i)
  if (!m) return null
  try {
    const o = JSON.parse(m[1])
    if (!o?.descripcion) return null
    const momentoRaw = String(o.momento || o.comida || '').trim()
    return {
      descripcion: String(o.descripcion).trim(),
      calorias: Math.max(0, Math.round(Number(o.calorias) || 0)),
      proteinas: Math.max(0, Math.round(Number(o.proteinas) || 0)),
      carbohidratos: Math.max(0, Math.round(Number(o.carbohidratos) || 0)),
      grasas: Math.max(0, Math.round(Number(o.grasas) || 0)),
      porcion: String(o.porcion || '').trim(),
      momento: momentoRaw || undefined,
    }
  } catch {
    return null
  }
}

export function extraerPlanRegistroJson(text) {
  if (!text) return null
  const m = String(text).match(/PLAN_REGISTRO_JSON:\s*(\{[\s\S]*?\})/i)
  if (!m) return null
  try {
    const o = JSON.parse(m[1])
    const textoPlan = String(o.textoPlan || o.texto || '').trim()
    const momento = String(o.momento || o.comida || '').trim()
    const slotId = String(o.slot_id || o.slotId || '').trim()
    if (!textoPlan && !momento && !slotId) return null
    return {
      accion: String(o.accion || 'marcar').trim(),
      momento: momento || 'Almuerzo',
      textoPlan,
      notas: String(o.notas || '').trim(),
      opcion: o.opcion != null && Number.isFinite(Number(o.opcion)) ? Number(o.opcion) : undefined,
      dia_plan:
        o.dia_plan != null && Number.isFinite(Number(o.dia_plan)) ? Number(o.dia_plan) : undefined,
      slot_id: slotId || undefined,
    }
  } catch {
    return null
  }
}

export function respuestaVisible(text) {
  return String(text || '')
    .replace(/\n?ALIMENTO_JSON:\s*\{[\s\S]*?\}\s*/gi, '')
    .replace(/\n?PLAN_REGISTRO_JSON:\s*\{[\s\S]*?\}\s*/gi, '')
    .replace(/\n?[^\n]*no pod[eé]s registrar[^\n]*/gi, '')
    .replace(/\n?[^\n]*no puedo registrar[^\n]*/gi, '')
    .replace(/\n?Recuerda que[^\n]*registrar[^\n]*/gi, '')
    .trim()
}

export const GEMINI_MODELO_CHAT_DEFAULT = 'gemini-3.5-flash-lite'

export const GEMINI_MODELOS_TEXTO_FALLBACK = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-8b',
]

export function esErrorCuota(err) {
  const msg = (err?.message || String(err)).toLowerCase()
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit')
  )
}

/** Saturación o caída temporal de Google → probar otro modelo. */
export function esErrorServidorTemporal(err) {
  const msg = (err?.message || String(err)).toLowerCase()
  return (
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('500') ||
    msg.includes('service unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('try again later')
  )
}

export function esErrorModelo(err) {
  const msg = (err?.message || String(err)).toLowerCase()
  return (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('is not found for api version') ||
    msg.includes('response modalities') ||
    msg.includes('not supported by the model')
  )
}

export function esErrorReintentarConOtroModelo(err) {
  return esErrorCuota(err) || esErrorModelo(err) || esErrorServidorTemporal(err)
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
  if (esErrorServidorTemporal(err)) {
    return 'Gemini está saturado en este momento. Esperá unos segundos y volvé a enviar.'
  }
  if (/response modalities|not supported by the model/i.test(msg)) {
    return 'Modelo incorrecto (solo audio/imagen). Recargá la app; el servidor ya filtra modelos de texto.'
  }
  if (/GoogleGenerativeAI Error/i.test(msg)) {
    return 'No se pudo consultar a Gemini. Reintentá en unos segundos.'
  }
  return msg || 'No se pudo consultar a Gemini.'
}

function esModeloTextoChat(modelId) {
  const id = String(modelId || '').toLowerCase()
  if (!id || !id.includes('gemini')) return false
  if (
    /tts|audio|transcri|embed|image|imagen|banana|omni|live|aqa|robotics|computer-use|deep-research|antigravity|agent/.test(
      id,
    )
  ) {
    return false
  }
  return /flash|pro|gemma|learnlm|thinking/.test(id) || /^gemini-\d/.test(id)
}

export function esModeloChatPermitido(modelId) {
  const id = String(modelId || '').trim()
  if (!id) return false
  return GEMINI_MODELOS_TEXTO_FALLBACK.includes(id)
}

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

function scoreModeloChat(id) {
  const x = id.toLowerCase()
  let s = 0
  if (/3\.5-flash-lite/.test(x)) s += 100
  if (/2\.5-flash-lite/.test(x)) s += 80
  if (/2\.0-flash-lite/.test(x)) s += 60
  if (/1\.5-flash-8b/.test(x)) s += 40
  if (/preview|exp|experimental/.test(x)) s -= 12
  if (/tts|audio/.test(x)) s -= 200
  return s
}

/** Sin llamada extra a Google (más rápido en cada consulta). */
export function resolverModelosChatRapido(preferido) {
  const pref = String(preferido || '').trim()
  const prefOk = esModeloChatPermitido(pref) ? pref : ''
  const envOk =
    typeof process !== 'undefined' && process.env?.GEMINI_MODEL && esModeloChatPermitido(process.env.GEMINI_MODEL)
      ? String(process.env.GEMINI_MODEL).trim()
      : ''
  const estaticos = GEMINI_MODELOS_TEXTO_FALLBACK.filter(esModeloChatPermitido)
  const ordered = [...new Set([envOk, prefOk, ...estaticos].filter(Boolean))]
  if (ordered.length > 0) return ordered.slice(0, 4)
  return [GEMINI_MODELO_CHAT_DEFAULT]
}

export async function resolverModelosChat(apiKey, preferido) {
  const pref = String(preferido || '').trim()
  const prefOk = esModeloChatPermitido(pref) ? pref : ''
  const envOk =
    typeof process !== 'undefined' && process.env?.GEMINI_MODEL && esModeloChatPermitido(process.env.GEMINI_MODEL)
      ? String(process.env.GEMINI_MODEL).trim()
      : ''

  const fromApi = (await listarModelosGemini(apiKey)).filter(esModeloChatPermitido)
  fromApi.sort((a, b) => scoreModeloChat(b) - scoreModeloChat(a))

  const estaticos = GEMINI_MODELOS_TEXTO_FALLBACK.filter(esModeloChatPermitido)
  const ordered = [...new Set([envOk, prefOk, ...estaticos, ...fromApi].filter(Boolean))]

  if (ordered.length > 0) return ordered.slice(0, 4)
  return [GEMINI_MODELO_CHAT_DEFAULT]
}
