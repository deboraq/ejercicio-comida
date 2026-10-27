import { ejecutarConsultaGemini, mensajeErrorGemini } from '../lib/geminiCore.js'

async function validarUsuarioSupabase(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return null

  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  })
  if (!res.ok) return null
  const user = await res.json()
  return user?.id ? user : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const user = await validarUsuarioSupabase(req.headers.authorization)
  if (!user) {
    return res.status(401).json({ error: 'Iniciá sesión para usar el asistente.' })
  }

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    return res.status(503).json({
      error: 'El asistente no está configurado en el servidor (falta GEMINI_API_KEY en Vercel).',
    })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const { pregunta, contexto, historial, modelo } = body
  if (!pregunta || !String(pregunta).trim()) {
    return res.status(400).json({ error: 'Falta la pregunta.' })
  }

  try {
    const result = await ejecutarConsultaGemini(geminiKey, {
      modelo: modelo || process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      pregunta: String(pregunta),
      contexto: contexto || {},
      historial: Array.isArray(historial) ? historial : [],
    })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ error: mensajeErrorGemini(err) })
  }
}
