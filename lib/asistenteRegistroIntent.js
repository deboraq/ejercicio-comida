/** Detecta cuando el usuario quiere cargar comida en la app (no solo consultar). */

function textoSinAcentos(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function esIntentRegistroComida(pregunta) {
  const p = textoSinAcentos(pregunta)
  if (!p.trim()) return false
  if (/\bquiero\s+registrar\b/.test(p)) return true
  if (/\b(registrar|anotar|agregar|cargo|cargar|guardar)\b/.test(p)) {
    return /\b(comida|comi|almuerzo|desayuno|cena|merienda|colacion|snack|plato|ensalada|menu)\b/.test(
      p,
    )
  }
  return false
}

function inferMomentoLite(text) {
  const s = String(text || '').toLowerCase()
  if (/\balmuerzo\b/.test(s)) return 'Almuerzo'
  if (/\bdesayuno\b/.test(s)) return 'Desayuno'
  if (/\bmerienda\b/.test(s)) return 'Merienda'
  if (/\bcena\b/.test(s)) return 'Cena'
  if (/\b(snack|media\s*manana|colacion)\b/.test(s)) return 'Snack'
  return ''
}

/** Nombre del plato a partir de la pregunta del usuario. */
export function descripcionDesdePreguntaRegistro(pregunta) {
  let s = String(pregunta || '').trim()
  s = s.replace(/^quiero\s+registrar\s+(el\s+)?/i, '')
  s = s.replace(/^(registrar|anotar|agregar)\s+(el\s+)?/i, '')
  s = s.replace(/\b(de\s+)?hoy\b/gi, ' ').trim()
  const m = s.match(
    /(?:almuerzo|desayuno|cena|merienda|snack|media\s*mañana)[,\s:]+(.+)/i,
  )
  if (m?.[1]) return m[1].trim().replace(/\s+/g, ' ').slice(0, 240)
  return s.replace(/\s+/g, ' ').slice(0, 240)
}

function numMacro(raw) {
  const n = Number(String(raw || '').replace(',', '.'))
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

/**
 * Si el modelo olvidó ALIMENTO_JSON pero dio kcal y P/C/G en el texto, armar sugerencia.
 */
export function extraerAlimentoDesdeRespuestaLibre(visible, pregunta) {
  const text = String(visible || '')
  if (!text.trim()) return null

  const calMatches = [...text.matchAll(/(?:~|≈|unas?\s+)?(\d{2,4})\s*kcal/gi)]
  if (!calMatches.length) return null
  const calorias = numMacro(calMatches[calMatches.length - 1][1])
  if (calorias < 30) return null

  const macroMatches = [
    ...text.matchAll(
      /P:\s*(\d+(?:[.,]\d+)?)\s*g[,\s]*C:\s*(\d+(?:[.,]\d+)?)\s*g[,\s]*G:\s*(\d+(?:[.,]\d+)?)\s*g/gi,
    ),
  ]
  const macros = macroMatches.length ? macroMatches[macroMatches.length - 1] : null
  const proteinas = macros ? numMacro(macros[1]) : 0
  const carbohidratos = macros ? numMacro(macros[2]) : 0
  const grasas = macros ? numMacro(macros[3]) : 0

  let descripcion = descripcionDesdePreguntaRegistro(pregunta)
  if (descripcion.length < 10) {
    const titulo = text.match(
      /(?:^|\n)\s*[-*]?\s*([^:\n]{8,100}(?:ensalada|pollo|huevo|plato)[^:\n]{0,60}):/i,
    )
    if (titulo?.[1]) descripcion = titulo[1].trim().slice(0, 240)
  }
  if (!descripcion.trim()) return null

  const momento = inferMomentoLite(pregunta) || inferMomentoLite(text) || undefined

  return {
    descripcion: descripcion.trim(),
    calorias,
    proteinas,
    carbohidratos,
    grasas,
    porcion: '1 plato',
    momento,
  }
}
