import { fechaToISO } from './calorias.js'
import { getDiaPlanMes1, metaCaloriasPlan, aguaMlObjetivoPlan, litrosAguaPlan } from './planMes1.js'
import { getDiaPlanAlimenticio } from './planPropio.js'
import { PLAN_MES1_SLOTS } from '../data/planMes1Semanas.js'

const PESO_KCAL_SLOT = {
  desayuno: 0.22,
  media_manana: 0.1,
  almuerzo: 0.32,
  merienda: 0.14,
  cena: 0.22,
}

export const PLAN_SLOT_ICON = {
  desayuno: '☕',
  media_manana: '🥜',
  almuerzo: '🥘',
  merienda: '🥪',
  cena: '🍽️',
}

export function esquemaPlanActivo(config) {
  if (config?.planMes1Esquema === 'ayuno168') return 'ayuno168'
  if (config?.planMes1Esquema === '4') return '4'
  if (config?.planMes1CincoComidas === false) return '4'
  return '5'
}

export function slotsVisiblesParaEsquema(esquema) {
  if (esquema === '5') return PLAN_MES1_SLOTS
  if (esquema === '4') return PLAN_MES1_SLOTS.filter((s) => s.id !== 'media_manana')
  return PLAN_MES1_SLOTS.filter((s) => s.id !== 'desayuno' && s.id !== 'media_manana')
}

export function labelEsquemaPlan(esquema) {
  if (esquema === '5') return '5 comidas (con colación)'
  if (esquema === '4') return '4 comidas'
  return 'Ayuno 16:8'
}

export function fechaCalendarioDiaPlan(inicioISO, diaPlan) {
  if (!inicioISO || !diaPlan) return null
  const d = new Date(`${inicioISO}T12:00:00`)
  d.setDate(d.getDate() + (diaPlan - 1))
  return fechaToISO(d)
}

export function nombreDiaSemanaCorto(fechaISO) {
  if (!fechaISO) return '—'
  const raw = new Date(`${fechaISO}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function etiquetaFechaCorta(fechaISO) {
  if (!fechaISO) return '—'
  const d = new Date(`${fechaISO}T12:00:00`)
  const dia = d.getDate()
  const mes = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
  return `${dia} ${mes.charAt(0).toUpperCase()}${mes.slice(1)}`
}

export function formatearHoraPlan(horaRef) {
  const m = String(horaRef || '12:00').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return horaRef || '—'
  let h = Number(m[1])
  const min = m[2]
  const ap = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${String(h).padStart(2, '0')}:${min} ${ap}`
}

export function formatearKcalRango(min, max) {
  const f = (n) => Math.round(n).toLocaleString('es-AR')
  return `${f(min)} – ${f(max)} kcal`
}

export function formatearPesoKg(peso) {
  const p = Number(peso)
  if (!Number.isFinite(p)) return '—'
  return p % 1 === 0 ? `${p} kg` : `${p.toFixed(1).replace('.', ',')} kg`
}

export function claveComidaPlan(diaPlan, slotId, extraId = null, opcionIndex = null) {
  if (extraId) return `${diaPlan}_extra_${extraId}`
  if (opcionIndex != null && opcionIndex !== '') return `${diaPlan}_${slotId}_op${opcionIndex}`
  return `${diaPlan}_${slotId}`
}

/** Claves de check por cada opción del slot (p. ej. op0 y op1). */
export function clavesOpcionesSlot(diaPlan, slotId, opciones = []) {
  return (opciones || []).map((_, i) => claveComidaPlan(diaPlan, slotId, null, i))
}

export function diasDeSemanaPlan(semana) {
  const start = (semana - 1) * 7 + 1
  return Array.from({ length: 7 }, (_, i) => start + i).filter((d) => d <= 30)
}

export function estimarMacrosComida(slotId, config) {
  const rango = metaCaloriasPlan(config?.sexo)
  const peso = PESO_KCAL_SLOT[slotId] ?? 0.2
  const kcal = Math.round(((rango.min + rango.max) / 2) * peso)
  const p = Math.round(((rango.p[0] + rango.p[1]) / 2) * peso)
  const h = Math.round(((rango.h[0] + rango.h[1]) / 2) * peso)
  const g = Math.round(((rango.g[0] + rango.g[1]) / 2) * peso)
  return { kcal, p, h, g }
}

export function totalKcalDiaEstimado(comidasVisibles, config) {
  return comidasVisibles.reduce((s, slot) => s + estimarMacrosComida(slot.id, config).kcal, 0)
}

export function textoComidaElegida(slot, opcionIndex = 0) {
  const op = slot.opciones?.[opcionIndex] || slot.opciones?.[0]
  return op?.texto || op?.label || slot.label
}

export function buildComidasDiaKanban(diaPlan, config, planPropio = null) {
  const detalle = getDiaPlanAlimenticio(diaPlan, config, planPropio)
  if (!detalle) return null
  const esquema = esquemaPlanActivo(config)
  const slotIds = new Set(slotsVisiblesParaEsquema(esquema).map((s) => s.id))
  const comidas = detalle.comidas
    .filter((c) => slotIds.has(c.id))
    .map((c) => ({
      ...c,
      opcionIndex: 0,
    }))
  return {
    diaPlan,
    detalle,
    comidas,
    esquema,
  }
}

export function tipNutricionistaPlan(config) {
  const rango = metaCaloriasPlan(config?.sexo)
  const metaP = Math.round((rango.p[0] + rango.p[1]) / 2)
  const promedio = Math.round(metaP * 0.83)
  return `Tu promedio proyectado de proteína semanal es de ${promedio} g/día (meta: ${metaP} g). Si necesitás completar, añadí 1 lata de atún al natural o 150g de pechuga extra en el almuerzo.`
}

export function resumenHidratacionPlan(config) {
  const ml = aguaMlObjetivoPlan(config?.pesoKg)
  const l = litrosAguaPlan(config?.pesoKg)
  if (ml == null || l == null) return { texto: '—', ml: null }
  return {
    ml,
    texto: `${String(l).replace('.', ',')} L / día (${ml.toLocaleString('es-AR')} ml)`,
  }
}

export function distribucionMacrosTexto(config) {
  const r = metaCaloriasPlan(config?.sexo)
  return `P ${r.p[0]}-${r.p[1]}g · H ${r.h[0]}-${r.h[1]}g · G ${r.g[0]}-${r.g[1]}g`
}
