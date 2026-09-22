import { PLAN_MES1_TIPS } from '../data/planMes1Tips.js'
import { PLAN_MES1_SLOTS } from '../data/planMes1Semanas.js'
import { fechaToISO } from './calorias.js'
import { parseOpcionPlan, textoDesdeItems } from './planOpcionComida.js'
import {
  PLAN_MES1_TOTAL_DIAS,
  buildActivacionPlanMes1,
  diaPlanMes1,
  getDiaPlanMes1,
} from './planMes1.js'

export function esPlanPropio(config) {
  return config?.planMes1Origen === 'propio'
}

export function labelOrigenPlan(config) {
  return esPlanPropio(config) ? 'Plan propio' : 'Plan guiado'
}

/** Plantilla vacía: 30 días × 5 comidas × 2 opciones. */
export function crearPlantillaPlanPropioVacia(nombre = 'Mi plan propio') {
  const dias = {}
  for (let d = 1; d <= PLAN_MES1_TOTAL_DIAS; d += 1) {
    const key = String(d)
    dias[key] = { tip: '' }
    for (const slot of PLAN_MES1_SLOTS) {
      dias[key][slot.id] = ['', '']
    }
  }
  return {
    nombre,
    dias,
    actualizado: fechaToISO(new Date()),
  }
}

/** Copia el menú guiado actual como punto de partida editable. */
export function crearPlanPropioDesdeGuia() {
  const dias = {}
  for (let d = 1; d <= PLAN_MES1_TOTAL_DIAS; d += 1) {
    const det = getDiaPlanMes1(d)
    const key = String(d)
    dias[key] = { tip: det?.tip || '' }
    for (const slot of PLAN_MES1_SLOTS) {
      const comida = det?.comidas?.find((c) => c.id === slot.id)
      dias[key][slot.id] = (comida?.opciones || []).map((o) => String(o.texto || ''))
      while (dias[key][slot.id].length < 2) dias[key][slot.id].push('')
    }
  }
  return {
    nombre: 'Mi plan propio',
    dias,
    actualizado: fechaToISO(new Date()),
  }
}

export function getDiaPlanPropio(diaPlan, planPropio) {
  if (diaPlan < 1 || diaPlan > PLAN_MES1_TOTAL_DIAS || !planPropio?.dias) return null
  const raw = planPropio.dias[String(diaPlan)]
  if (!raw) return null
  const semana = Math.ceil(diaPlan / 7)
  const comidas = PLAN_MES1_SLOTS.map((slot) => {
    const textos = Array.isArray(raw[slot.id]) ? raw[slot.id] : ['', '']
    return {
      ...slot,
      opciones: [0, 1].map((i) => {
        const parsed = parseOpcionPlan(textos[i])
        const texto =
          parsed.texto.trim()
          || (parsed.items.length ? textoDesdeItems(parsed.items) : '')
          || `Comida pendiente — opción ${i + 1}`
        return {
          id: `op${i + 1}`,
          label: `Opción ${i + 1}`,
          texto,
          items: parsed.items,
        }
      }),
    }
  })
  return {
    dia: diaPlan,
    semana,
    titulo: `Día ${diaPlan} · Semana ${semana}`,
    tip: raw.tip || PLAN_MES1_TIPS[diaPlan - 1] || '',
    comidas,
  }
}

export function getDiaPlanAlimenticio(diaPlan, config, planPropio) {
  if (esPlanPropio(config) && planPropio) {
    return getDiaPlanPropio(diaPlan, planPropio)
  }
  return getDiaPlanMes1(diaPlan)
}

export function buildActivacionPlanPropio(config, hoyISO = fechaToISO(new Date())) {
  const base = buildActivacionPlanMes1(config, hoyISO)
  return {
    ...base,
    planMes1Origen: 'propio',
    planMes1Inicio: hoyISO,
  }
}

/** Días numéricos de una semana del plan (1–4). */
export function numerosSemanaPlan(semana) {
  const start = (semana - 1) * 7 + 1
  return Array.from({ length: 7 }, (_, i) => start + i).filter((d) => d <= PLAN_MES1_TOTAL_DIAS)
}

export function semanaDelDiaPlan(diaPlan) {
  return Math.ceil(Number(diaPlan) / 7)
}

function clonarOpcionPlan(val) {
  if (val == null || val === '') return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object') {
    try {
      return JSON.parse(JSON.stringify(val))
    } catch {
      return { ...val }
    }
  }
  return ''
}

/** Copia profunda del menú de un día (comidas + tip). */
export function clonarContenidoDiaPlan(raw) {
  const base = raw && typeof raw === 'object' ? raw : {}
  const clone = { tip: base.tip || '' }
  for (const slot of PLAN_MES1_SLOTS) {
    const arr = Array.isArray(base[slot.id]) ? base[slot.id] : ['', '']
    clone[slot.id] = [clonarOpcionPlan(arr[0]), clonarOpcionPlan(arr[1])]
  }
  return clone
}

export function diaPlanTieneContenido(planPropio, diaPlan) {
  const raw = planPropio?.dias?.[String(diaPlan)]
  if (!raw) return false
  if (String(raw.tip || '').trim()) return true
  for (const slot of PLAN_MES1_SLOTS) {
    const arr = raw[slot.id]
    if (!Array.isArray(arr)) continue
    for (const op of arr) {
      if (!op) continue
      if (typeof op === 'string' && op.trim()) return true
      if (typeof op === 'object') {
        if (String(op.texto || '').trim()) return true
        if (Array.isArray(op.items) && op.items.length) return true
      }
    }
  }
  return false
}

/** Copia el menú del día origen a uno o más días destino. */
export function replicarDiaPlanPropio(planPropio, diaOrigen, diasDestino) {
  const origen = planPropio?.dias?.[String(diaOrigen)]
  const plantilla = clonarContenidoDiaPlan(origen || { tip: '' })
  const dias = { ...(planPropio?.dias || {}) }
  const unicos = [...new Set(diasDestino)].filter(
    (d) => d >= 1 && d <= PLAN_MES1_TOTAL_DIAS && d !== diaOrigen,
  )
  for (const d of unicos) {
    dias[String(d)] = clonarContenidoDiaPlan(plantilla)
  }
  return {
    ...planPropio,
    dias,
    actualizado: fechaToISO(new Date()),
  }
}

/** Copia los días de una semana entera a otra (mismo índice Lun–Dom dentro de la semana). */
export function replicarSemanaPlanPropio(planPropio, semanaOrigen, semanaDestino) {
  if (semanaOrigen === semanaDestino) return planPropio
  const src = numerosSemanaPlan(semanaOrigen)
  const dst = numerosSemanaPlan(semanaDestino)
  const dias = { ...(planPropio?.dias || {}) }
  const n = Math.min(src.length, dst.length)
  for (let i = 0; i < n; i += 1) {
    const raw = planPropio?.dias?.[String(src[i])]
    dias[String(dst[i])] = clonarContenidoDiaPlan(raw || { tip: '' })
  }
  return {
    ...planPropio,
    dias,
    actualizado: fechaToISO(new Date()),
  }
}

export function actualizarComidaPlanPropio(planPropio, diaPlan, slotId, opcionIndex, opcion) {
  const key = String(diaPlan)
  const dias = { ...(planPropio?.dias || {}) }
  const day = { ...(dias[key] || {}) }
  const arr = [...(Array.isArray(day[slotId]) ? day[slotId] : ['', ''])]
  if (opcion == null || opcion === '') {
    arr[opcionIndex] = ''
  } else if (typeof opcion === 'string') {
    arr[opcionIndex] = String(opcion)
  } else if (typeof opcion === 'object') {
    arr[opcionIndex] = opcion
  }
  while (arr.length < 2) arr.push('')
  day[slotId] = arr
  dias[key] = day
  return {
    ...planPropio,
    dias,
    actualizado: fechaToISO(new Date()),
  }
}

function diferenciaDiasCalendario(desdeISO, hastaISO) {
  if (!desdeISO || !hastaISO) return 0
  const a = new Date(`${desdeISO}T12:00:00`)
  const b = new Date(`${hastaISO}T12:00:00`)
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

/** Resumen diario (Comida) compatible con plan guiado o propio. */
export function resumenPlanAlimenticioHoy(config, planPropio = null, hoyISO = fechaToISO(new Date())) {
  const inicio = config?.planMes1Inicio
  if (!inicio) return null
  const dia = diaPlanMes1(inicio, hoyISO)
  if (dia == null) {
    const diff = diferenciaDiasCalendario(inicio, hoyISO)
    const estado = diff < 0 ? 'futuro' : 'fin'
    return { estado, inicio, origen: config?.planMes1Origen || 'guia' }
  }
  const detalle = getDiaPlanAlimenticio(dia, config, planPropio)
  return {
    estado: 'activo',
    dia,
    total: PLAN_MES1_TOTAL_DIAS,
    titulo: detalle?.titulo,
    tip: detalle?.tip,
    variante: config?.planMes1Variante,
    objetivo: config?.planMes1Objetivo || config?.objetivo,
    origen: config?.planMes1Origen || 'guia',
  }
}
