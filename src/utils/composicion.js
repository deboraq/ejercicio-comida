/** Utilidades de composición / peso-altura / gasto calórico. */

export function parseAlturaCm(valor) {
  if (valor == null || valor === '') return null
  const n = Number(String(valor).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 100 || n > 250) return null
  return Math.round(n * 10) / 10
}

export function parsePesoKg(valor) {
  if (valor == null || valor === '') return null
  const n = Number(String(valor).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0 || n > 400) return null
  return Math.round(n * 10) / 10
}

/**
 * IMC = peso(kg) / altura(m)^2
 */
export function calcularIMC(pesoKg, alturaCm) {
  const p = parsePesoKg(pesoKg)
  const h = parseAlturaCm(alturaCm)
  if (p == null || h == null) return null
  const metros = h / 100
  return Math.round((p / (metros * metros)) * 10) / 10
}

/** Categoría OMS aproximada (orientativa; no es diagnóstico). */
export function categoriaIMC(imc) {
  if (imc == null || !Number.isFinite(imc)) return null
  if (imc < 18.5) return { key: 'bajo', label: 'Bajo peso', tono: 'warning' }
  if (imc < 25) return { key: 'normal', label: 'Peso saludable', tono: 'success' }
  if (imc < 30) return { key: 'sobrepeso', label: 'Sobrepeso', tono: 'warning' }
  return { key: 'obesidad', label: 'Obesidad', tono: 'danger' }
}

/** Rango de peso asociado a IMC 18.5–24.9 para esa altura. */
export function rangoPesoSaludable(alturaCm) {
  const h = parseAlturaCm(alturaCm)
  if (h == null) return null
  const m = h / 100
  const min = Math.round(18.5 * m * m * 10) / 10
  const max = Math.round(24.9 * m * m * 10) / 10
  return { min, max }
}

export const SEXOS = [
  { value: '', label: 'Prefiero no decir' },
  { value: 'mujer', label: 'Mujer' },
  { value: 'hombre', label: 'Hombre' },
  { value: 'otro', label: 'Otro' },
]

/** Nivel de actividad habitual (multiplicador TDEE). */
export const NIVELES_ACTIVIDAD = [
  {
    value: 'sedentario',
    label: 'Sedentario',
    factor: 1.2,
    hint: 'Poco o nada de ejercicio, trabajo de escritorio',
  },
  {
    value: 'ligero',
    label: 'Ligero',
    factor: 1.375,
    hint: 'Ejercicio 1–3 días/semana o caminatas frecuentes',
  },
  {
    value: 'moderado',
    label: 'Moderado',
    factor: 1.55,
    hint: 'Ejercicio 3–5 días/semana',
  },
  {
    value: 'alto',
    label: 'Alto',
    factor: 1.725,
    hint: 'Entreno intenso 6–7 días/semana',
  },
  {
    value: 'muy_alto',
    label: 'Muy alto',
    factor: 1.9,
    hint: 'Trabajo físico + entreno fuerte, o doble sesión',
  },
]

export function getNivelActividad(value) {
  return NIVELES_ACTIVIDAD.find((n) => n.value === value) || null
}

/**
 * Tasa metabólica basal (Mifflin–St Jeor). Requiere peso, altura, edad y sexo.
 * Si sexo es otro/vacío, usa el promedio de fórmulas hombre/mujer.
 */
export function calcularTMB({ pesoKg, alturaCm, edad, sexo }) {
  const p = parsePesoKg(pesoKg)
  const h = parseAlturaCm(alturaCm)
  const e = Number(edad)
  if (p == null || h == null || !Number.isFinite(e) || e < 10 || e > 120) return null

  const base = 10 * p + 6.25 * h - 5 * e
  if (sexo === 'hombre') return Math.round(base + 5)
  if (sexo === 'mujer') return Math.round(base - 161)
  // otro / no declarado: punto medio
  return Math.round(base - 78)
}

/** Gasto total diario estimado = TMB × factor de actividad. */
export function calcularTDEE(tmb, nivelActividad) {
  if (tmb == null) return null
  const nivel = getNivelActividad(nivelActividad) || getNivelActividad('moderado')
  return Math.round(tmb * nivel.factor)
}

/**
 * Metas sugeridas según objetivo (kcal y macros aproximados).
 */
export function sugerirMetasDiarias({ tdee, pesoKg, objetivo }) {
  if (tdee == null) return null
  const p = parsePesoKg(pesoKg)
  const obj = objetivo || 'mantener_peso'

  let ajuste = 0
  if (obj === 'bajar_peso') ajuste = -400
  else if (obj === 'aumentar_peso') ajuste = 350
  else if (obj === 'ganar_musculo') ajuste = 250

  const calorias = Math.max(1200, Math.round((tdee + ajuste) / 10) * 10)

  let gProPorKg = 1.4
  if (obj === 'bajar_peso') gProPorKg = 1.8
  else if (obj === 'aumentar_peso') gProPorKg = 1.6
  else if (obj === 'ganar_musculo') gProPorKg = 2.0

  const proteina = p != null ? Math.round(p * gProPorKg) : Math.round((calorias * 0.25) / 4)
  const grasa = p != null ? Math.round(p * 0.9) : Math.round((calorias * 0.28) / 9)
  const kcalPro = proteina * 4
  const kcalGra = grasa * 9
  const carbohidratos = Math.max(50, Math.round((calorias - kcalPro - kcalGra) / 4))

  return {
    calorias,
    proteina,
    carbohidratos,
    grasa,
    tdee,
    ajuste,
    objetivo: obj,
  }
}

export function buildPerfilCorporal(config = {}, pesoFallback = null) {
  const pesoKg = parsePesoKg(config?.pesoKg) ?? parsePesoKg(pesoFallback)
  const alturaCm = parseAlturaCm(config?.alturaCm)
  const imc = calcularIMC(pesoKg, alturaCm)
  const categoria = categoriaIMC(imc)
  const rango = rangoPesoSaludable(alturaCm)
  const sexo = config?.sexo || ''
  const edad = (() => {
    const n = Number(config?.edad)
    return Number.isFinite(n) && n >= 10 && n <= 120 ? Math.round(n) : null
  })()
  const nivelActividad = config?.nivelActividad || ''
  const tmb = calcularTMB({ pesoKg, alturaCm, edad, sexo })
  const tdee =
    tmb != null && nivelActividad
      ? calcularTDEE(tmb, nivelActividad)
      : tmb != null
        ? calcularTDEE(tmb, 'moderado')
        : null
  const sugerencia =
    tdee != null
      ? sugerirMetasDiarias({ tdee, pesoKg, objetivo: config?.objetivo })
      : null

  return {
    pesoKg,
    alturaCm,
    imc,
    categoria,
    rango,
    sexo,
    edad,
    nivelActividad,
    nivelActividadInfo: getNivelActividad(nivelActividad),
    tmb,
    tdee: nivelActividad ? tdee : null,
    tdeeEstimadoSinNivel: !nivelActividad && tmb != null ? calcularTDEE(tmb, 'moderado') : null,
    sugerencia: nivelActividad ? sugerencia : null,
    puedeCalcularGasto: Boolean(pesoKg && alturaCm && edad && (sexo === 'mujer' || sexo === 'hombre' || sexo === 'otro' || sexo === '')),
  }
}
