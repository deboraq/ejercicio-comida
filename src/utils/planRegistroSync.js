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

/** Clave de slot (día + comida) sin distinguir opción 1 / 2. */
export function planRefSlotKey(planRef) {
  const p = parsePlanRef(planRef)
  if (!p) return null
  if (p.slotId === 'extra') return `${p.diaPlan}_extra_${p.extraId}`
  return `${p.diaPlan}_${p.slotId}`
}

export function slotKeyDesdeCheckKey(checkKey) {
  if (!checkKey) return null
  const s = String(checkKey)
  const op = s.match(/^(\d+)_(.+)_op(\d+)$/)
  if (op) return `${op[1]}_${op[2]}`
  return s
}

/** Quita registros del plan del mismo slot (otras opciones) antes de upsert. */
export function removeRegistrosPlanMismoSlot(registros, planRef) {
  const p = parsePlanRef(planRef)
  if (!p || p.slotId === 'extra') {
    return (registros || []).filter((r) => r?.planRef !== planRef)
  }
  const slotKey = planRefSlotKey(planRef)
  return (registros || []).filter((r) => {
    if (!r?.planRef) return true
    return planRefSlotKey(r.planRef) !== slotKey
  })
}

export function planRefsOpcionesSlot(diaPlan, slotId, opcionesCount) {
  const n = Math.max(0, Number(opcionesCount) || 0)
  return Array.from({ length: n }, (_, i) => planRefRegistro(diaPlan, slotId, null, i))
}

/** Una sola opción registrada por slot del plan; gana la primera entrada (más reciente en lista). */
export function dedupeRegistrosPorPlanRef(registros) {
  const list = Array.isArray(registros) ? registros : []
  const seenPlanRef = new Set()
  const seenSlot = new Set()
  const out = []
  for (const r of list) {
    if (!r?.planRef) {
      out.push(r)
      continue
    }
    if (seenPlanRef.has(r.planRef)) continue
    const slotKey = planRefSlotKey(r.planRef)
    if (slotKey && seenSlot.has(slotKey)) continue
    seenPlanRef.add(r.planRef)
    if (slotKey) seenSlot.add(slotKey)
    out.push(r)
  }
  return out.length === list.length ? list : out
}

/** Alinea checks del plan con lo que hay en comida (evita “marcado + pendiente”). */
export function syncPlanChecksFromRegistros(estado, registros) {
  const base = estado && typeof estado === 'object' ? estado : { checks: {}, omitidos: {}, extras: {} }
  const checks = { ...(base.checks || {}) }
  let changed = false

  const activosPorCheck = new Set()
  const checkGanadorPorSlot = new Map()
  for (const r of registros || []) {
    if (!r?.planRef) continue
    const checkKey = claveCheckDesdePlanRef(r.planRef)
    const slotKey = planRefSlotKey(r.planRef)
    if (!checkKey || !slotKey) continue
    if (!checkGanadorPorSlot.has(slotKey)) {
      checkGanadorPorSlot.set(slotKey, checkKey)
      activosPorCheck.add(checkKey)
    }
  }

  for (const key of Object.keys(checks)) {
    if (!checks[key]) continue
    const slotKey = slotKeyDesdeCheckKey(key)
    const ganador = slotKey ? checkGanadorPorSlot.get(slotKey) : null
    if (ganador) {
      if (key !== ganador && checks[key]) {
        delete checks[key]
        changed = true
      }
    }
  }

  for (const key of activosPorCheck) {
    if (!checks[key]) {
      checks[key] = true
      changed = true
    }
  }

  for (const key of Object.keys(checks)) {
    if (!checks[key]) {
      delete checks[key]
      changed = true
    }
  }

  if (!changed) return base
  return { ...base, checks }
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
  const sinSlot = removeRegistrosPlanMismoSlot(registros, planRef)
  const prev = (registros || []).find((r) => r.planRef === planRef)
  const id = prev?.id || registro.id || nuevoIdRegistro()
  return [{ ...registro, planRef, id }, ...sinSlot]
}

export function removeRegistroPlan(registros, planRef) {
  return (registros || []).filter((r) => r.planRef !== planRef)
}

export function removeRegistrosPlanMany(registros, planRefs) {
  const set = new Set(planRefs)
  return (registros || []).filter((r) => !r.planRef || !set.has(r.planRef))
}

/** Quita todos los registros de Comida ligados al plan de un día (p. ej. al desmarcar todo el día). */
export function removeRegistrosPlanDia(registros, diaPlan) {
  const d = Number(diaPlan)
  if (!Number.isFinite(d) || d < 1) return registros || []
  return (registros || []).filter((r) => {
    const p = parsePlanRef(r?.planRef)
    if (!p) return true
    return p.diaPlan !== d
  })
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

/**
 * Aplica un payload del plan sobre el listado de comida (marcar / desmarcar / batch).
 * @param {(fn: (prev: object[]) => object[]) => void} setRegistros
 * @param {object} payload
 * @param {{ onUpsert?: (registro: object, payload: object) => void }} [hooks]
 */
export function applyPlanRegistroSyncPayload(setRegistros, payload, hooks = {}) {
  if (!payload?.type || typeof setRegistros !== 'function') return

  if (payload.type === 'remove') {
    setRegistros((prev) => removeRegistroPlan(prev, payload.planRef))
    return
  }

  if (payload.type === 'removeMany') {
    setRegistros((prev) => {
      let next = removeRegistrosPlanMany(prev, payload.planRefs || [])
      if (payload.diaPlan != null) {
        next = removeRegistrosPlanDia(next, payload.diaPlan)
      }
      return next
    })
    return
  }

  if (payload.type === 'batch') {
    setRegistros((prev) => aplicarBatchSyncPlan(prev, payload.ops || []))
    return
  }

  if (payload.type === 'upsert' && payload.planRef && payload.registro) {
    setRegistros((prev) => {
      const next = upsertRegistroPlan(prev, payload.planRef, payload.registro)
      const saved = next.find((r) => r.planRef === payload.planRef)
      if (saved && hooks.onUpsert) {
        queueMicrotask(() => hooks.onUpsert(saved, payload))
      }
      return next
    })
  }
}
