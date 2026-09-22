import { labelVariantePlan, variantePlanDesdeObjetivo } from './planMes1.js'
import { esPlanPropio } from './planPropio.js'

export function newPlanNutricionId() {
  return `pn${Date.now()}`
}

export function nombreSugeridoPlan(config, planPropio) {
  if (esPlanPropio(config)) return planPropio?.nombre?.trim() || 'Mi plan propio'
  return nombrePlanGuiadoSistema(config)
}

/** Nombre fijo que usa la app para el menú guiado de 30 días. */
export function nombrePlanGuiadoSistema(config) {
  const v = config?.planMes1Variante || variantePlanDesdeObjetivo(config?.objetivo)
  return `Plan guiado · ${labelVariantePlan(v)} (30 días)`
}

export function etiquetaOrigenPlanBiblioteca(entry) {
  return entry?.origen === 'propio' ? 'Propio' : 'Sistema'
}

function clonarJson(val) {
  if (val == null) return null
  try {
    return JSON.parse(JSON.stringify(val))
  } catch {
    return val
  }
}

/** Snapshot del plan en curso para la biblioteca de planes. */
export function snapshotFromRuntime(config, planPropio, estado, idOverride, nombreOverride) {
  const id = idOverride || config?.planNutricionId || newPlanNutricionId()
  const entry = {
    id,
    nombre: nombreOverride || nombreSugeridoPlan(config, planPropio),
    origen: esPlanPropio(config) ? 'propio' : 'guia',
    planMes1Inicio: config?.planMes1Inicio || '',
    planMes1Variante: config?.planMes1Variante,
    planMes1Esquema: config?.planMes1Esquema ?? '5',
    planMes1CincoComidas: config?.planMes1CincoComidas !== false,
    estado: {
      checks: { ...(estado?.checks || {}) },
      omitidos: { ...(estado?.omitidos || {}) },
      extras: { ...(estado?.extras || {}) },
    },
    planPropio: esPlanPropio(config) && planPropio ? clonarJson(planPropio) : null,
  }
  return entry
}

export function patchConfigFromSnapshot(entry) {
  return {
    planNutricionId: entry.id,
    planMes1Inicio: entry.planMes1Inicio,
    planMes1Variante: entry.planMes1Variante,
    planMes1Esquema: entry.planMes1Esquema ?? '5',
    planMes1CincoComidas: entry.planMes1CincoComidas !== false,
    planMes1Origen: entry.origen === 'propio' ? 'propio' : 'guia',
  }
}

export function aplicarSnapshot(entry) {
  return {
    configPatch: patchConfigFromSnapshot(entry),
    planPropio: entry.planPropio ? clonarJson(entry.planPropio) : null,
    estado: entry.estado
      ? clonarJson(entry.estado)
      : { checks: {}, omitidos: {}, extras: {} },
  }
}

/** Actualiza o agrega un snapshot en la lista; conserva el nombre si ya existía. */
export function upsertPlanEnLista(lista, snapshot) {
  const list = Array.isArray(lista) ? lista : []
  const idx = list.findIndex((p) => p.id === snapshot.id)
  if (idx >= 0) {
    const next = [...list]
    next[idx] = { ...snapshot, nombre: list[idx].nombre || snapshot.nombre }
    return next
  }
  return [...list, snapshot]
}

export function entradaPlanVacio(id, nombre, origen, hoyISO, config, planPropioData, estadoVacio) {
  return {
    id,
    nombre,
    origen,
    planMes1Inicio: hoyISO,
    planMes1Variante: config?.planMes1Variante || variantePlanDesdeObjetivo(config?.objetivo),
    planMes1Esquema: config?.planMes1Esquema ?? '5',
    planMes1CincoComidas: config?.planMes1CincoComidas !== false,
    estado: estadoVacio || { checks: {}, omitidos: {}, extras: {} },
    planPropio: origen === 'propio' ? clonarJson(planPropioData) : null,
  }
}
