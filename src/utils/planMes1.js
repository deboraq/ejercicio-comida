import { PLAN_MES1_TIPS } from '../data/planMes1Tips.js'
import {
  PLAN_MES1_SLOTS,
  PLAN_MES1_WEEK_A,
  PLAN_MES1_WEEK_B,
} from '../data/planMes1Semanas.js'
import { fechaToISO } from './calorias.js'
import { buscarAlimentos } from './referenciaComidas.js'

export const PLAN_MES1_ID = 'tmv_mes1_tonificacion'
export const PLAN_MES1_TOTAL_DIAS = 30

export const PLAN_MES1_VARIANTES = [
  {
    id: 'bajar_grasa',
    label: 'Bajar grasa / peso',
    hint: 'Cantidades estándar del plan.',
    factorHidratos: 1,
  },
  {
    id: 'mantener_energia',
    label: 'Mantener peso o más energía',
    hint: 'Tras 1–2 semanas probando: +20 % en hidratos (arroz, quinoa, legumbres, tostadas).',
    factorHidratos: 1.2,
  },
]

const CALORIAS_RANGO = {
  mujer: { min: 1380, max: 1630, p: [100, 120], h: [110, 130], g: [60, 70] },
  hombre: { min: 1630, max: 1840, p: [120, 130], h: [130, 150], g: [70, 80] },
}

function diferenciaDiasCalendario(desdeISO, hastaISO) {
  if (!desdeISO || !hastaISO) return 0
  const a = new Date(`${desdeISO}T12:00:00`)
  const b = new Date(`${hastaISO}T12:00:00`)
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

export function aguaMlObjetivoPlan(pesoKg) {
  const p = Number(pesoKg)
  if (!Number.isFinite(p) || p <= 0) return null
  return Math.round(p * 35)
}

export function litrosAguaPlan(pesoKg) {
  const ml = aguaMlObjetivoPlan(pesoKg)
  return ml != null ? Math.round((ml / 1000) * 10) / 10 : null
}

export function metaCaloriasPlan(sexo) {
  const key = sexo === 'hombre' ? 'hombre' : 'mujer'
  return CALORIAS_RANGO[key]
}

export function perfilPlanListo(config) {
  const sexo = config?.sexo
  const peso = Number(config?.pesoKg)
  return (sexo === 'mujer' || sexo === 'hombre') && Number.isFinite(peso) && peso > 0
}

/** Día del plan 1…30 según fecha de inicio; null si aún no empezó o pasó el mes. */
export function diaPlanMes1(fechaInicioISO, fechaRef = fechaToISO(new Date())) {
  if (!fechaInicioISO) return null
  const diff = diferenciaDiasCalendario(fechaInicioISO, fechaRef)
  if (diff < 0) return null
  if (diff >= PLAN_MES1_TOTAL_DIAS) return null
  return diff + 1
}

/** Fecha de inicio para que hoy sea el día N del plan (1…30). */
export function inicioISOparaDiaPlan(diaPlan, hoyISO = fechaToISO(new Date())) {
  const d = Number(diaPlan)
  if (!Number.isFinite(d) || d < 1 || d > PLAN_MES1_TOTAL_DIAS) return hoyISO
  const ref = new Date(`${hoyISO}T12:00:00`)
  ref.setDate(ref.getDate() - (d - 1))
  return fechaToISO(ref)
}

function plantillaSemana(diaPlan) {
  const idx = (diaPlan - 1) % 7
  const semana = Math.floor((diaPlan - 1) / 7)
  return semana % 2 === 0 ? PLAN_MES1_WEEK_A[idx] : PLAN_MES1_WEEK_B[idx]
}

export function getDiaPlanMes1(diaPlan) {
  if (diaPlan < 1 || diaPlan > PLAN_MES1_TOTAL_DIAS) return null
  const plantilla = plantillaSemana(diaPlan)
  const semana = Math.ceil(diaPlan / 7)
  const tip = PLAN_MES1_TIPS[diaPlan - 1] || ''

  const comidas = PLAN_MES1_SLOTS.map((slot) => ({
    ...slot,
    opciones: (plantilla[slot.id] || []).map((texto, i) => ({
      id: `op${i + 1}`,
      label: `Opción ${i + 1}`,
      texto,
    })),
  }))

  return {
    dia: diaPlan,
    semana,
    titulo: `Día ${diaPlan} · Semana ${semana}`,
    tip,
    comidas,
  }
}

/** Sugiere ítems del catálogo para precargar Comida (heurística). */
export function sugerenciasCatalogoParaTexto(texto) {
  if (!texto) return []
  const t = texto.toLowerCase()
  const claves = []
  if (/hortalizas a y b|½ plato hortalizas|ensalada/.test(t)) claves.push('hortalizas tipo a')
  if (/¼ plato.*arroz|arroz integral/.test(t)) claves.push('arroz integral cocido')
  if (/quinua|quinoa/.test(t)) claves.push('quinoa cocida')
  if (/legumbre|lenteja|poroto|garbanzo/.test(t)) claves.push('legumbres cocidas')
  if (/pechuga.*pollo|pollo/.test(t)) claves.push('pechuga pollo plancha')
  if (/pescado|merluza|atún|atun/.test(t)) claves.push('merluza')
  if (/carne|lomo|milanesa/.test(t)) claves.push('carne magra')
  if (/huevo|omelette|tortilla.*huevo/.test(t)) claves.push('huevo')
  if (/yogur/.test(t)) claves.push('yogur descremado')
  if (/tostada|pan integral/.test(t)) claves.push('tostada integral')
  if (/avena/.test(t)) claves.push('avena instantánea')
  if (/frutos secos|nueces|almendras/.test(t)) claves.push('frutos secos')
  if (/½ fruta|1 fruta|fruta/.test(t)) claves.push('fruta mediana')
  if (/palta|aguacate/.test(t)) claves.push('palta')
  if (/queso descremado|queso untable|queso firme/.test(t)) claves.push('queso descremado')
  if (/aceite de oliva|oliva/.test(t)) claves.push('aceite oliva')
  if (/batata|papa/.test(t)) claves.push('hortalizas tipo c')
  if (claves.length === 0) {
    const palabras = t.replace(/opción \d+:/gi, '').split(/\s+/).filter((w) => w.length > 4)
    if (palabras[0]) claves.push(palabras.slice(0, 3).join(' '))
  }

  const vistos = new Set()
  const out = []
  for (const q of claves.slice(0, 4)) {
    const hits = buscarAlimentos(q)
    for (const h of hits.slice(0, 2)) {
      if (vistos.has(h.nombre)) continue
      vistos.add(h.nombre)
      out.push(h)
    }
  }
  return out.slice(0, 6)
}

export function factorPorcionHidratos(config) {
  const v = config?.planMes1Variante || 'bajar_grasa'
  const found = PLAN_MES1_VARIANTES.find((x) => x.id === v)
  return found?.factorHidratos ?? 1
}

/** Asocia el objetivo de Config con la variante del menú PDF. */
export function variantePlanDesdeObjetivo(objetivo) {
  if (objetivo === 'bajar_peso') return 'bajar_grasa'
  return 'mantener_energia'
}

export function labelVariantePlan(varianteId) {
  return PLAN_MES1_VARIANTES.find((v) => v.id === varianteId)?.label || varianteId
}

export function planMes1TieneInicio(config) {
  return Boolean(String(config?.planMes1Inicio || '').trim())
}

/** Perfil mínimo para generar el plan (sexo, peso y objetivo elegido). */
export function perfilListoParaGenerarPlan(config) {
  return perfilPlanListo(config) && Boolean(config?.objetivo)
}

/** Parches de config al activar el plan desde Config (atado al objetivo actual). */
export function buildActivacionPlanMes1(config, hoyISO = fechaToISO(new Date())) {
  const variante = variantePlanDesdeObjetivo(config?.objetivo)
  const rango = metaCaloriasPlan(config?.sexo)
  const kcalMedia = Math.round((rango.min + rango.max) / 2)
  const patch = {
    planMes1Inicio: hoyISO,
    planMes1Variante: variante,
    planMes1CincoComidas: config?.planMes1CincoComidas !== false,
    planMes1Objetivo: config?.objetivo || '',
    planMes1Origen: 'guia',
  }
  if (!config?.metaCalorias) patch.metaCalorias = String(kcalMedia)
  if (!config?.metaProteina) patch.metaProteina = String(Math.round((rango.p[0] + rango.p[1]) / 2))
  if (!config?.metaCarbohidratos) {
    const hMid = Math.round((rango.h[0] + rango.h[1]) / 2)
    const factor = PLAN_MES1_VARIANTES.find((x) => x.id === variante)?.factorHidratos ?? 1
    patch.metaCarbohidratos = String(Math.round(hMid * factor))
  }
  if (!config?.metaGrasa) patch.metaGrasa = String(Math.round((rango.g[0] + rango.g[1]) / 2))
  return patch
}

/** Resumen corto para banners en Comida. */
export function resumenPlanMes1Hoy(config, hoyISO = fechaToISO(new Date())) {
  const inicio = config?.planMes1Inicio
  if (!inicio) return null
  const dia = diaPlanMes1(inicio, hoyISO)
  if (dia == null) {
    const diff = diferenciaDiasCalendario(inicio, hoyISO)
    const estado = diff < 0 ? 'futuro' : 'fin'
    return { estado, inicio }
  }
  const detalle = getDiaPlanMes1(dia)
  return {
    estado: 'activo',
    dia,
    total: PLAN_MES1_TOTAL_DIAS,
    titulo: detalle?.titulo,
    tip: detalle?.tip,
    variante: config?.planMes1Variante,
    objetivo: config?.planMes1Objetivo || config?.objetivo,
  }
}
