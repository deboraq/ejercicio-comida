import { ejecutarConsultaGemini, mensajeErrorGemini } from '../lib/geminiCore.js'

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
  return user
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const user = await validarSesionSupabase(req.headers.authorization)
  if (!user) {
    return res.status(403).json({ error: 'Iniciá sesión para usar las consultas con IA.' })
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
      modelo: process.env.GEMINI_MODEL || modelo || 'gemini-1.5-flash',
      pregunta: String(pregunta),
      contexto: contexto || {},
      historial: Array.isArray(historial) ? historial : [],
    })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ error: mensajeErrorGemini(err) })
  }
}
