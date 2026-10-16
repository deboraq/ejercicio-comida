import { PLAN_MES2_DIAS, PLAN_MES2_TOTAL_DIAS } from '../data/planMes2Dias.js'
import { PLAN_MES2_TIPS } from '../data/planMes2Tips.js'
import { PLAN_MES1_SLOTS } from '../data/planMes1Semanas.js'
import {
  aguaMlObjetivoPlan,
  buildActivacionPlanMes1,
  diaPlanMes1,
  factorPorcionHidratos,
  metaCaloriasPlan,
  perfilPlanListo,
  PLAN_MES1_TOTAL_DIAS,
  variantePlanDesdeObjetivo,
} from './planMes1.js'
import { fechaToISO } from './calorias.js'

export const PLAN_MES2_ID = 'mes2_avanzado'
export { PLAN_MES2_TOTAL_DIAS }

/** Rangos levemente superiores al mes 1 (plan avanzado). */
const CALORIAS_RANGO_MES2 = {
  mujer: { min: 1480, max: 1730, p: [105, 125], h: [115, 135], g: [62, 72] },
  hombre: { min: 1730, max: 1940, p: [125, 135], h: [135, 155], g: [72, 82] },
}

export function esPlanMes2(config) {
  return config?.planMesGuia === 'mes2'
}

export function metaCaloriasPlanMes2(sexo) {
  const key = sexo === 'hombre' ? 'hombre' : 'mujer'
  return CALORIAS_RANGO_MES2[key]
}

export function getDiaPlanMes2(diaPlan) {
  if (diaPlan < 1 || diaPlan > PLAN_MES2_TOTAL_DIAS) return null
  const plantilla = PLAN_MES2_DIAS[diaPlan - 1]
  if (!plantilla) return null
  const semana = Math.ceil(diaPlan / 7)
  const tip = PLAN_MES2_TIPS[diaPlan - 1] || ''

  const comidas = PLAN_MES1_SLOTS.map((slot) => ({
    ...slot,
    opciones: (plantilla[slot.id] || ['', '']).map((texto, i) => ({
      id: `op${i + 1}`,
      label: `Opción ${i + 1}`,
      texto,
    })),
  }))

  return {
    dia: diaPlan,
    semana,
    titulo: `Mes 2 · Día ${diaPlan} · Semana ${semana}`,
    tip,
    comidas,
  }
}

/** Parches al activar el menú guiado mes 2. */
export function buildActivacionPlanMes2(config, hoyISO = fechaToISO(new Date())) {
  const base = buildActivacionPlanMes1(config, hoyISO)
  const variante = variantePlanDesdeObjetivo(config?.objetivo)
  const rango = metaCaloriasPlanMes2(config?.sexo)
  const kcalMedia = Math.round((rango.min + rango.max) / 2)
  const patch = {
    ...base,
    planMesGuia: 'mes2',
  }
  patch.metaCalorias = String(kcalMedia)
  patch.metaProteina = String(Math.round((rango.p[0] + rango.p[1]) / 2))
  const hMid = Math.round((rango.h[0] + rango.h[1]) / 2)
  patch.metaCarbohidratos = String(Math.round(hMid * factorPorcionHidratos(config)))
  patch.metaGrasa = String(Math.round((rango.g[0] + rango.g[1]) / 2))
  return patch
}

export { aguaMlObjetivoPlan, perfilPlanListo }
