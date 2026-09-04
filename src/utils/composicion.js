/** Utilidades de composición / peso-altura (IMC y rangos). */

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

  return {
    pesoKg,
    alturaCm,
    imc,
    categoria,
    rango,
    sexo,
    edad,
  }
}

export const SEXOS = [
  { value: '', label: 'Prefiero no decir' },
  { value: 'mujer', label: 'Mujer' },
  { value: 'hombre', label: 'Hombre' },
  { value: 'otro', label: 'Otro' },
]
