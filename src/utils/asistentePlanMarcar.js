import { buildComidasDiaKanban } from './planMes1Kanban'
import { diaPlanMes1, planMes1TieneInicio } from './planMes1'
import { fechaToISO } from './calorias'
import { textoSinAcentos } from './textoNormalizado.js'

function normalizarTextoMomento(m) {
  return textoSinAcentos(String(m || '').trim())
}

/** Mapea texto libre (Almuerzo, media mañana, colación…) al id de slot del plan. */
export function momentoPlanAId(momento) {
  const s = normalizarTextoMomento(momento)
  if (!s) return ''
  if (s.includes('desayuno')) return 'desayuno'
  if (s.includes('media') || s.includes('colacion') || s.includes('colación')) return 'media_manana'
  if (s.includes('almuerzo')) return 'almuerzo'
  if (s.includes('merienda')) return 'merienda'
  if (s.includes('cena')) return 'cena'
  if (s.includes('snack')) return 'media_manana'
  return s.replace(/\s+/g, '_')
}

/**
 * Resuelve día del plan y slot para marcar una opción desde el asistente.
 * @returns {{ diaPlan: number, slot: object, inicioISO: string } | { error: string, diaPlan?: number }}
 */
export function resolverSlotPlanParaMarcar({
  diaPlan,
  momento,
  slotId,
  configPlan,
  planPropio,
  fechaRef,
}) {
  const inicio = configPlan?.planMes1Inicio
  if (!inicio || !planMes1TieneInicio(configPlan)) {
    return { error: 'sin_plan' }
  }

  let d = diaPlan != null ? Number(diaPlan) : diaPlanMes1(inicio, fechaRef || fechaToISO(new Date()))
  if (!Number.isFinite(d) || d < 1) {
    return { error: 'dia_invalido' }
  }

  const day = buildComidasDiaKanban(d, configPlan, planPropio)
  if (!day?.comidas?.length) {
    return { error: 'dia_sin_datos', diaPlan: d }
  }

  const idBuscado = slotId ? String(slotId).trim() : momentoPlanAId(momento)
  let slot = idBuscado ? day.comidas.find((c) => c.id === idBuscado) : null

  if (!slot && momento) {
    const norm = normalizarTextoMomento(momento)
    slot = day.comidas.find((c) => {
      const label = normalizarTextoMomento(c.label)
      const mc = normalizarTextoMomento(c.momentoComida)
      return label === norm || mc === norm || label.includes(norm) || norm.includes(label)
    })
  }

  if (!slot) {
    return { error: 'slot_no_encontrado', diaPlan: d }
  }

  return { diaPlan: d, slot, inicioISO: inicio }
}
