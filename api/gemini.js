import {
  ejecutarConsultaGemini,
  mensajeErrorGemini,
  GEMINI_MODELO_CHAT_DEFAULT,
  esModeloChatPermitido,
} from '../lib/geminiCore.js'
import { fetchUserDataForAsistente, buildContextoDesdeUserData } from '../lib/asistenteUserData.js'

function supabaseEnv() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return null
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ''), anonKey }
}

async function validarSesionSupabase(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null

  const env = supabaseEnv()
  if (!env) return null
  const { supabaseUrl, anonKey } = env

  const resUser = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  })
  if (!resUser.ok) return null
  const user = await resUser.json()
  if (!user?.id) return null
  return { user, token }
}

async function consultasIaHabilitadasGlobal(token) {
  const env = supabaseEnv()
  if (!env || !token) return true
  const { supabaseUrl, anonKey } = env
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/app_settings?key=eq.consultas_ia&select=value`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          Accept: 'application/json',
        },
      },
    )
    if (!res.ok) return true
    const rows = await res.json()
    return rows?.[0]?.value?.enabled !== false
  } catch {
    return true
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const sesion = await validarSesionSupabase(req.headers.authorization)
  if (!sesion) {
    return res.status(403).json({ error: 'Iniciá sesión para usar las consultas con IA.' })
  }

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    return res.status(503).json({
      error: 'El asistente no está configurado en el servidor (falta GEMINI_API_KEY en Vercel).',
    })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const { pregunta, historial, fechaRef: fechaRefBody } = body
  const fechaRef =
    fechaRefBody && /^\d{4}-\d{2}-\d{2}$/.test(String(fechaRefBody)) ? String(fechaRefBody) : null
  if (!pregunta || !String(pregunta).trim()) {
    return res.status(400).json({ error: 'Falta la pregunta.' })
  }

  const env = supabaseEnv()
  if (!env) {
    return res.status(503).json({ error: 'Supabase no configurado en el servidor.' })
  }

  const [consultasOn, userDataFirst] = await Promise.all([
    consultasIaHabilitadasGlobal(sesion.token),
    fetchUserDataForAsistente(env, sesion.token, sesion.user.id),
  ])
  if (!consultasOn) {
    return res.status(503).json({
      error: 'Las consultas con IA están desactivadas. Probá más tarde.',
    })
  }

  let { map, error: userDataError } = userDataFirst
  if (userDataError) {
    return res.status(502).json({
      error: 'No se pudieron cargar tus datos. Reintentá en unos segundos.',
    })
  }

  const comidaRegistrosCliente = Number(body.comidaRegistrosCliente)
  const comidaEnNube = (() => {
    try {
      const raw = map?.comida
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return Array.isArray(parsed) ? parsed.length : 0
    } catch {
      return 0
    }
  })()
  if (comidaRegistrosCliente > 0 && comidaEnNube === 0) {
    await new Promise((r) => setTimeout(r, 180))
    const retry = await fetchUserDataForAsistente(env, sesion.token, sesion.user.id)
    if (!retry.error) map = retry.map
  }

  const preguntaStr = String(pregunta).trim()

  let contexto
  try {
    contexto = buildContextoDesdeUserData(map, preguntaStr, fechaRef)
  } catch (ctxErr) {
    console.error('asistente contexto:', ctxErr)
    return res.status(500).json({
      error: 'No se pudo preparar tus datos para la consulta. Reintentá en unos segundos.',
    })
  }

  const envModel = String(process.env.GEMINI_MODEL || '').trim()
  const modeloServidor =
    envModel && esModeloChatPermitido(envModel) ? envModel : GEMINI_MODELO_CHAT_DEFAULT

  try {
    const result = await ejecutarConsultaGemini(geminiKey, {
      modelo: modeloServidor,
      pregunta: preguntaStr,
      contexto,
      historial: Array.isArray(historial) ? historial : [],
    })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ error: mensajeErrorGemini(err) })
  }
}
