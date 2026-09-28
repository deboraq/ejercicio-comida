import { nuevoIdRegistro } from './ids.js'
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

/** Fecha del registro en Comida al marcar una comida del plan (día del calendario del plan). */
export function fechaRegistroDesdePlanDia(inicioISO, diaPlan, hoyISO = fechaToISO(new Date())) {
  const hoy = hoyISO || fechaToISO(new Date())
  const fechaSlot = fechaCalendarioDiaPlan(inicioISO, diaPlan)
  return fechaSlot || hoy
}

/** Interpreta planRef guardado en un registro de comida. */
export function parsePlanRef(planRef) {
  if (!planRef || !String(planRef).startsWith('plan_')) return null
  const key = String(planRef).slice(5)
  const extra = key.match(/^(\d+)_extra_(.+)$/)
  if (extra) {
    return {
      diaPlan: Number(extra[1]),
      slotId: 'extra',
      extraId: extra[2],
      opcionIndex: null,
    }
  }
  const op = key.match(/^(\d+)_([^_]+)_op(\d+)$/)
  if (op) {
    return {
      diaPlan: Number(op[1]),
      slotId: op[2],
      extraId: null,
      opcionIndex: Number(op[3]),
    }
  }
  return null
}

export function claveCheckDesdePlanRef(planRef) {
  const p = parsePlanRef(planRef)
  if (!p) return null
  if (p.slotId === 'extra') return claveComidaPlan(p.diaPlan, 'extra', p.extraId)
  return claveComidaPlan(p.diaPlan, p.slotId, null, p.opcionIndex)
}

/** Elimina duplicados con el mismo planRef (deja el más reciente por orden en lista). */
export function dedupeRegistrosPorPlanRef(registros) {
  const list = Array.isArray(registros) ? registros : []
  const seen = new Set()
  const out = []
  for (const r of list) {
    if (!r?.planRef) {
      out.push(r)
      continue
    }
    if (seen.has(r.planRef)) continue
    seen.add(r.planRef)
    out.push(r)
  }
  return out.length === list.length ? list : out
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
  const list = Array.isArray(registros) ? registros : []
  const prev = list.find((r) => r.planRef === planRef)
  const sinEste = list.filter((r) => r.planRef !== planRef)
  const id = prev?.id || registro.id || nuevoIdRegistro()
  return [{ ...registro, planRef, id }, ...sinEste]
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
