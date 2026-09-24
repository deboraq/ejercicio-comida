import { nuevoIdRegistro } from './ids.js'
import { diaPlanMes1 } from './planMes1.js'
import { fechaToISO } from './calorias.js'
import {
  claveComidaPlan,
  estimarMacrosComida,
  fechaCalendarioDiaPlan,
} from './planMes1Kanban.js'
import { textoDesdeItems, totalesMacrosItems } from './planOpcionComida.js'

export function planRefRegistro(diaPlan, slotId, extraId = null, opcionIndex = null) {
  return `plan_${claveComidaPlan(diaPlan, slotId, extraId, opcionIndex)}`
}

export function planRefsChecksDia(diaPlan, slots, extrasDia) {
  const refs = []
  for (const slot of slots) {
    for (let i = 0; i < (slot.opciones || []).length; i += 1) {
      refs.push(planRefRegistro(diaPlan, slot.id, null, i))
    }
  }
  for (const ex of extrasDia) {
    refs.push(planRefRegistro(diaPlan, 'extra', ex.id, null))
  }
  return refs
}

/** Fecha del registro en Comida al marcar una comida del plan. */
export function fechaRegistroDesdePlanDia(inicioISO, diaPlan, hoyISO = fechaToISO(new Date())) {
  const hoy = hoyISO || fechaToISO(new Date())
  const diaHoyPlan = diaPlanMes1(inicioISO, hoy)
  const fechaSlot = fechaCalendarioDiaPlan(inicioISO, diaPlan)
  if (diaPlan === diaHoyPlan) return hoy
  if (fechaSlot === hoy) return hoy
  // Inicio desfasado: no crear comidas en fechas futuras; van al registro de hoy
  if (fechaSlot && fechaSlot > hoy) return hoy
  return fechaSlot || hoy
}

export function buildRegistroPlanEntry({
  diaPlan,
  inicioISO,
  config,
  slotId,
  opcionIndex = null,
  extraId = null,
  slot,
  texto,
  opcionLabel,
  items = null,
}) {
  const hoyISO = fechaToISO(new Date())
  const fecha = fechaRegistroDesdePlanDia(inicioISO, diaPlan, hoyISO)
  const planRef = planRefRegistro(
    diaPlan,
    slotId === 'extra' ? 'extra' : slotId,
    extraId,
    slotId === 'extra' ? null : opcionIndex,
  )
  const macroSlot = slotId === 'extra' ? 'media_manana' : slotId
  let macros = estimarMacrosComida(macroSlot, config)
  let descripcion = String(texto || '').slice(0, 240)
  if (Array.isArray(items) && items.length) {
    const t = totalesMacrosItems(items)
    macros = { kcal: t.kcal, p: t.p, h: t.h, g: t.g }
    descripcion = textoDesdeItems(items).slice(0, 240) || descripcion
  }
  const comida = slot?.momentoComida || 'Almuerzo'
  const hora = slot?.horaRef || '12:00'
  const labelSlot = slot?.label || 'Comida'
  const notas = `Mi plan · Día ${diaPlan} · ${labelSlot}${opcionLabel ? ` · ${opcionLabel}` : ''}`

  return {
    planRef,
    registro: {
      id: nuevoIdRegistro(),
      comida,
      descripcion,
      calorias: String(macros.kcal),
      proteinas: String(macros.p),
      carbohidratos: String(macros.h),
      grasas: String(macros.g),
      porciones: '1',
      categoria: 'Plan',
      hora,
      notas,
      fecha,
    },
  }
}

export function upsertRegistroPlan(registros, planRef, registro) {
  const list = Array.isArray(registros) ? [...registros] : []
  const idx = list.findIndex((r) => r.planRef === planRef)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...registro, planRef, id: list[idx].id }
    return list
  }
  return [{ ...registro, planRef }, ...list]
}

export function removeRegistroPlan(registros, planRef) {
  return (registros || []).filter((r) => r.planRef !== planRef)
}

export function removeRegistrosPlanMany(registros, planRefs) {
  const set = new Set(planRefs)
  return (registros || []).filter((r) => !r.planRef || !set.has(r.planRef))
}

/** @param {{ checked: boolean, diaPlan: number, inicioISO: string, config: object, slot?: object, opIdx?: number, extra?: object }} p */
export function payloadSyncPlanToggle(p) {
  const { diaPlan, inicioISO, config, slot, opIdx, extra, checked } = p
  if (extra) {
    const planRef = planRefRegistro(diaPlan, 'extra', extra.id, null)
    if (!checked) return { type: 'remove', planRef }
    const built = buildRegistroPlanEntry({
      diaPlan,
      inicioISO,
      config,
      slotId: 'extra',
      extraId: extra.id,
      slot: {
        label: extra.label,
        momentoComida: 'Snack',
        horaRef: extra.horaRef || '16:00',
      },
      texto: extra.texto,
      opcionLabel: extra.label,
    })
    return { type: 'upsert', ...built }
  }
  const op = slot?.opciones?.[opIdx]
  const planRef = planRefRegistro(diaPlan, slot.id, null, opIdx)
  if (!checked) return { type: 'remove', planRef }
  const built = buildRegistroPlanEntry({
    diaPlan,
    inicioISO,
    config,
    slotId: slot.id,
    opcionIndex: opIdx,
    slot,
    texto: op?.texto || op?.label || slot.label,
    opcionLabel: op?.label,
    items: op?.items,
  })
  return { type: 'upsert', ...built }
}

export function aplicarBatchSyncPlan(registros, ops) {
  let next = registros || []
  for (const op of ops) {
    if (op.type === 'remove') {
      next = removeRegistroPlan(next, op.planRef)
    } else if (op.type === 'upsert' && op.planRef && op.registro) {
      next = upsertRegistroPlan(next, op.planRef, op.registro)
    }
  }
  return next
}
