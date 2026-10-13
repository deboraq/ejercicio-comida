/** Estado del tablero: una copia por plan (Mes 1, Mes 2, propio…) sin mezclar marcas. */

export const PLAN_ESTADO_SLICE_VACIO = Object.freeze({
  checks: {},
  omitidos: {},
  extras: {},
})

export const PLAN_ESTADO_MULTIPLAN_VACIO = Object.freeze({
  version: 2,
  byPlanId: {},
})

function esSlicePlano(estado) {
  return estado && typeof estado === 'object' && !estado.version && !estado.byPlanId
}

/** Migra formato antiguo (checks sueltos) → byPlanId. */
export function normalizarEstadoMultiplan(estado, planIdLegacy = null) {
  if (!estado || typeof estado !== 'object') return { version: 2, byPlanId: {} }
  if (estado.version === 2 && estado.byPlanId && typeof estado.byPlanId === 'object') {
    return {
      version: 2,
      byPlanId: { ...estado.byPlanId },
    }
  }
  if (esSlicePlano(estado)) {
    const id = planIdLegacy || '__legacy__'
    return {
      version: 2,
      byPlanId: { [id]: { ...PLAN_ESTADO_SLICE_VACIO, ...estado } },
    }
  }
  return { version: 2, byPlanId: {} }
}

export function getEstadoPlanActivo(estado, planNutricionId) {
  const root = normalizarEstadoMultiplan(estado)
  if (!planNutricionId) {
    return root.byPlanId.__legacy__ || { ...PLAN_ESTADO_SLICE_VACIO }
  }
  const slice = root.byPlanId[planNutricionId]
  if (!slice) return { ...PLAN_ESTADO_SLICE_VACIO }
  return {
    checks: { ...(slice.checks || {}) },
    omitidos: { ...(slice.omitidos || {}) },
    extras: { ...(slice.extras || {}) },
  }
}

export function setEstadoPlanActivo(estado, planNutricionId, slice) {
  if (!planNutricionId) return estado
  const root = normalizarEstadoMultiplan(estado)
  return {
    version: 2,
    byPlanId: {
      ...root.byPlanId,
      [planNutricionId]: {
        checks: { ...(slice?.checks || {}) },
        omitidos: { ...(slice?.omitidos || {}) },
        extras: { ...(slice?.extras || {}) },
      },
    },
  }
}

/** Asigna marcas sueltas (sin plan) al primer plan Mes 1 de la biblioteca. */
export function migrarEstadoLegacyAMes1(estado, planesNutricion) {
  const root = normalizarEstadoMultiplan(estado)
  if (root.byPlanId.__legacy__) {
    const lista = Array.isArray(planesNutricion) ? planesNutricion : []
    const mes1 = lista.find((p) => p.planMesGuia !== 'mes2' && p.origen !== 'propio')
    const targetId = mes1?.id
    if (targetId && !root.byPlanId[targetId]) {
      root.byPlanId[targetId] = root.byPlanId.__legacy__
    }
    delete root.byPlanId.__legacy__
  }
  return root
}
