import { labelVariantePlan, variantePlanDesdeObjetivo } from './planMes1.js'
import { esPlanMes2 } from './planMes2.js'
import { esPlanPropio } from './planPropio.js'
import { getEstadoPlanActivo } from './planEstadoStorage.js'

/** Mes 1 vs Mes 2: campo guardado o nombre del plan en biblioteca. */
export function planMesGuiaFromEntry(entry, config = null) {
  if (!entry) return 'mes1'
  if (entry.planMesGuia === 'mes2') return 'mes2'
  if (entry.planMesGuia === 'mes1') return 'mes1'
  const nombre = String(entry.nombre || '')
  if (/mes\s*2|mes2|\bavanzado\b/i.test(nombre) && !/mes\s*1|tonificaci/i.test(nombre)) {
    return 'mes2'
  }
  if (config?.planNutricionId === entry.id && config?.planMesGuia === 'mes2') return 'mes2'
  return 'mes1'
}

/** Repara entradas viejas sin planMesGuia (evita menú Mes 1 en plan «Mes 2»). */
export function normalizarBibliotecaPlanesNutricion(lista) {
  if (!Array.isArray(lista) || !lista.length) return lista || []
  let changed = false
  const next = lista.map((p) => {
    const guia = planMesGuiaFromEntry(p, null)
    if (p.planMesGuia === guia) return p
    changed = true
    return { ...p, planMesGuia: guia }
  })
  return changed ? next : lista
}

function estadoSliceForSnapshot(estado) {
  if (!estado || typeof estado !== 'object' || estado.version === 2) {
    return { checks: {}, omitidos: {}, extras: {} }
  }
  return {
    checks: { ...(estado.checks || {}) },
    omitidos: { ...(estado.omitidos || {}) },
    extras: { ...(estado.extras || {}) },
  }
}

export function snapshotEstadoParaPlan(estadoRoot, planNutricionId) {
  return estadoSliceForSnapshot(getEstadoPlanActivo(estadoRoot, planNutricionId))
}

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
  if (esPlanMes2(config)) {
    return `Plan guiado · Mes 2 avanzado · ${labelVariantePlan(v)} (30 días)`
  }
  return `Plan guiado · Mes 1 · ${labelVariantePlan(v)} (30 días)`
}

export function etiquetaOrigenPlanBiblioteca(entry) {
  return entry?.origen === 'propio' ? 'Propio' : 'Sistema'
}

/** Config efectiva según el plan elegido en la biblioteca (Mes 1 vs Mes 2). */
export function configConPlanBibliotecaActivo(config, planesNutricion, planActivoId) {
  const id = planActivoId || config?.planNutricionId
  if (!id || !config) return config
  const entry = (planesNutricion || []).find((p) => p.id === id)
  if (!entry) return config
  const planMesGuia = planMesGuiaFromEntry(entry, config)
  return {
    ...config,
    planNutricionId: id,
    planMesGuia,
    planMes1Inicio: entry.planMes1Inicio || config.planMes1Inicio,
    planMes1Variante: entry.planMes1Variante ?? config.planMes1Variante,
    planMes1Origen: entry.origen === 'propio' ? 'propio' : 'guia',
  }
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
    planMesGuia: planMesGuiaFromEntry({ planMesGuia: config?.planMesGuia, nombre: nombreOverride || nombreSugeridoPlan(config, planPropio) }, config),
    estado: estadoSliceForSnapshot(estado),
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
    planMesGuia: planMesGuiaFromEntry(entry),
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
    planMesGuia: planMesGuiaFromEntry(
      { planMesGuia: config?.planMesGuia, nombre, origen },
      config,
    ),
    estado: estadoVacio || { checks: {}, omitidos: {}, extras: {} },
    planPropio: origen === 'propio' ? clonarJson(planPropioData) : null,
  }
}
