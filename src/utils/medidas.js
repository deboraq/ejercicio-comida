/** Campos de medidas corporales (cm). Todos opcionales por toma. */
export const CAMPOS_MEDIDAS = [
  { key: 'cuello', label: 'Cuello', hint: 'Justo debajo de la manzana de Adán' },
  { key: 'pecho', label: 'Pecho', hint: 'A la altura de los pezones / punto más amplio' },
  { key: 'cinturaAlta', label: 'Cintura alta', hint: 'Bajo el pecho / últimas costillas' },
  { key: 'cinturaBaja', label: 'Cintura baja', hint: 'A la altura del ombligo' },
  { key: 'cadera', label: 'Cadera', hint: 'Parte más ancha de glúteos/caderas' },
  { key: 'brazoIzq', label: 'Brazo izq.', hint: 'Bíceps, punto más amplio (relajado o contraído, siempre igual)' },
  { key: 'brazoDer', label: 'Brazo der.', hint: 'Bíceps, punto más amplio' },
  { key: 'musloIzq', label: 'Muslo izq.', hint: 'Parte más ancha del muslo' },
  { key: 'musloDer', label: 'Muslo der.', hint: 'Parte más ancha del muslo' },
  { key: 'pantorrillaIzq', label: 'Pantorrilla izq.', hint: 'Parte más ancha' },
  { key: 'pantorrillaDer', label: 'Pantorrilla der.', hint: 'Parte más ancha' },
]

/** Campos clave para el resumen rápido en Inicio */
export const CAMPOS_RESUMEN = ['cinturaBaja', 'cadera', 'brazoIzq', 'brazoDer', 'pecho']

export function parseCm(valor) {
  if (valor == null || valor === '') return null
  const n = Number(String(valor).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0 || n > 300) return null
  return Math.round(n * 10) / 10
}

export function formatDeltaCm(delta) {
  if (delta == null || !Number.isFinite(delta)) return null
  const r = Math.round(delta * 10) / 10
  return `${r > 0 ? '+' : ''}${r} cm`
}

/** Valores numéricos presentes en una toma. */
export function valoresDeToma(toma) {
  const out = {}
  for (const { key } of CAMPOS_MEDIDAS) {
    const v = Number(toma?.[key])
    if (Number.isFinite(v) && v > 0) out[key] = v
  }
  return out
}

export function labelCampo(key) {
  return CAMPOS_MEDIDAS.find((c) => c.key === key)?.label || key
}

/**
 * Delta entre dos tomas para un campo (actual - anterior).
 * Negativo = disminuyó (típico al bajar grasa en cintura/cadera).
 */
export function deltaCampo(actual, anterior, key) {
  const a = Number(actual?.[key])
  const b = Number(anterior?.[key])
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null
  return Math.round((a - b) * 10) / 10
}

function diasEntreIso(desde, hasta) {
  if (!desde || !hasta) return null
  const a = new Date(`${desde}T12:00:00`)
  const b = new Date(`${hasta}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

/**
 * Resume el progreso de medidas para consejos (última vs. anterior).
 * @param {Array} historial
 * @param {string} [hoyIso] fecha de referencia YYYY-MM-DD
 */
export function buildProgresoMedidas(historial = [], hoyIso) {
  const ordenDesc = [...(historial || [])].sort((a, b) =>
    String(b.fecha || '').localeCompare(String(a.fecha || ''))
  )
  if (ordenDesc.length === 0) {
    return {
      numTomas: 0,
      ultima: null,
      anterior: null,
      deltas: {},
      valoresUltima: {},
      diasDesdeUltima: null,
      camposComparables: [],
    }
  }

  const ultima = ordenDesc[0]
  const anterior = ordenDesc[1] || null
  const valoresUltima = valoresDeToma(ultima)
  const deltas = {}
  const camposComparables = []

  if (anterior) {
    for (const { key } of CAMPOS_MEDIDAS) {
      const d = deltaCampo(ultima, anterior, key)
      if (d != null) {
        deltas[key] = d
        camposComparables.push(key)
      }
    }
  }

  const fechaUltima = String(ultima.fecha || '').slice(0, 10)
  const diasDesdeUltima = hoyIso ? diasEntreIso(fechaUltima, hoyIso) : null

  const promedioBrazo = (() => {
    const izq = valoresUltima.brazoIzq
    const der = valoresUltima.brazoDer
    if (izq != null && der != null) return Math.round(((izq + der) / 2) * 10) / 10
    return izq ?? der ?? null
  })()

  const asimBrazo =
    valoresUltima.brazoIzq != null && valoresUltima.brazoDer != null
      ? Math.round(Math.abs(valoresUltima.brazoIzq - valoresUltima.brazoDer) * 10) / 10
      : null

  const asimMuslo =
    valoresUltima.musloIzq != null && valoresUltima.musloDer != null
      ? Math.round(Math.abs(valoresUltima.musloIzq - valoresUltima.musloDer) * 10) / 10
      : null

  return {
    numTomas: ordenDesc.length,
    ultima,
    anterior,
    deltas,
    valoresUltima,
    diasDesdeUltima,
    camposComparables,
    promedioBrazo,
    asimBrazo,
    asimMuslo,
    fechaUltima,
    fechaAnterior: anterior ? String(anterior.fecha || '').slice(0, 10) : null,
  }
}
