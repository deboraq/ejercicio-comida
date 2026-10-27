/**
 * Contexto del asistente (compartido cliente + API Vercel).
 * Imports con extensión .js para Node ESM en serverless.
 */
import { fechaSoloDia, fechaToISO, caloriasEjercicioRegistro } from '../src/utils/calorias.js'
import { buscarAlimentos } from '../src/utils/referenciaComidas.js'
import { getUltimosNDias, getRangoPorPeriodo, filtrarPorRango } from '../src/utils/estadisticas.js'
import {
  resumenPlanAlimenticioHoy,
  labelOrigenPlan,
  planPropioStorageActivo,
} from '../src/utils/planPropio.js'
import { getEstadoPlanActivo } from '../src/utils/planEstadoStorage.js'
import { diaPlanMes1, PLAN_MES1_TOTAL_DIAS } from '../src/utils/planMes1.js'
import { getDiaPlanAlimenticio } from '../src/utils/planPropio.js'
import { esIntentRegistroComida } from './asistenteRegistroIntent.js'
import { configConPlanBibliotecaActivo } from '../src/utils/planesNutricion.js'
import { fechaCalendarioDiaPlan } from '../src/utils/planMes1Kanban.js'
import { buildRutinaView, planEjercicioTexto } from '../src/utils/rutinaVistaRapida.js'
import {
  indiceDiaRutinaParaDiaPlan,
  resumenRutinaActivaUsuario,
} from './asistenteRutinas.js'

function preguntaNecesitaCatalogo(pregunta) {
  if (esIntentRegistroComida(pregunta)) return true
  const p = String(pregunta || '').toLowerCase()
  return /\b(kcal|calor|comida|com[ií]|alimento|plato|ensalada|prote|carb|grasa|estim|registrar|men[uú]|cat[aá]logo)\b/.test(
    p,
  )
}

function preguntaMencionaRutinaOPlan(pregunta) {
  const p = String(pregunta || '').toLowerCase()
  return /\b(gym|gimnasio|ejercicio|entren|rutina|cardio|plan|d[ií]a\s*\d|mes\b|c[oó]mo ven)/.test(p)
}

function num(val) {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

function sumMacrosRegistros(lista) {
  return (lista || []).reduce(
    (acc, r) => ({
      kcal: acc.kcal + num(r.calorias),
      p: acc.p + num(r.proteinas),
      c: acc.c + num(r.carbohidratos),
      g: acc.g + num(r.grasas),
    }),
    { kcal: 0, p: 0, c: 0, g: 0 },
  )
}

function resumenComidaDia(registros, fecha) {
  const delDia = (registros || []).filter((r) => fechaSoloDia(r.fecha) === fecha)
  const tot = sumMacrosRegistros(delDia)
  const lineas = delDia.slice(0, 18).map((r) => ({
    momento: r.comida,
    descripcion: r.descripcion,
    kcal: Math.round(num(r.calorias)),
    hora: r.hora || '',
  }))
  return { fecha, totales: tot, comidas: lineas, count: delDia.length }
}

function getRangoMesEnCurso(fechaRef) {
  const hasta = fechaSoloDia(fechaRef) || fechaToISO(new Date())
  const [y, m] = hasta.split('-')
  const desde = `${y}-${m}-01`
  return { desde, hasta, etiqueta: `${m}/${y}` }
}

function resumenPeriodoComida(registros, desde, hasta) {
  const enRango = filtrarPorRango(registros || [], desde, hasta)
  const tot = sumMacrosRegistros(enRango)
  const diasConRegistro = new Set(enRango.map((r) => fechaSoloDia(r.fecha))).size
  const porDia = {}
  for (const r of enRango) {
    const f = fechaSoloDia(r.fecha)
    if (!porDia[f]) porDia[f] = { kcal: 0, registros: 0, proteinas_g: 0 }
    porDia[f].kcal += num(r.calorias)
    porDia[f].proteinas_g += num(r.proteinas)
    porDia[f].registros += 1
  }
  const serie = Object.keys(porDia)
    .sort()
    .map((fecha) => ({
      fecha,
      kcal: Math.round(porDia[fecha].kcal),
      proteinas_g: Math.round(porDia[fecha].proteinas_g),
      registros: porDia[fecha].registros,
    }))
  const diasCalendario = Math.max(
    1,
    Math.round((new Date(`${hasta}T12:00:00`) - new Date(`${desde}T12:00:00`)) / 86400000) + 1,
  )
  return {
    desde,
    hasta,
    dias_calendario: diasCalendario,
    dias_con_registro: diasConRegistro,
    total_registros: enRango.length,
    totales: {
      kcal: Math.round(tot.kcal),
      proteinas_g: Math.round(tot.p),
      carbohidratos_g: Math.round(tot.c),
      grasas_g: Math.round(tot.g),
    },
    promedio_kcal_dia_con_datos:
      diasConRegistro > 0 ? Math.round(tot.kcal / diasConRegistro) : 0,
    por_dia: serie,
  }
}

function resumenPeriodoEjercicio(ejercicios, desde, hasta, pesoKg) {
  const enRango = (ejercicios || []).filter((e) => {
    const f = fechaSoloDia(e.fecha)
    return f >= desde && f <= hasta
  })
  let kcalTotal = 0
  const porTipo = {}
  for (const e of enRango) {
    const kcal = caloriasEjercicioRegistro(e, pesoKg)
    kcalTotal += kcal
    const t = e.tipo || e.nombre || 'otro'
    porTipo[t] = (porTipo[t] || 0) + 1
  }
  const diasConActividad = new Set(enRango.map((e) => fechaSoloDia(e.fecha))).size
  const muestra = enRango.slice(-20).map((e) => ({
    fecha: fechaSoloDia(e.fecha),
    nombre: e.nombre,
    tipo: e.tipo,
    duracion_min: num(e.duracion),
    distancia_km: e.distanciaKm != null ? num(e.distanciaKm) : undefined,
    kcal_est: Math.round(caloriasEjercicioRegistro(e, pesoKg)),
  }))
  return {
    desde,
    hasta,
    sesiones: enRango.length,
    dias_con_actividad: diasConActividad,
    kcal_estimadas_total: Math.round(kcalTotal),
    conteo_por_tipo: porTipo,
    ultimos_registros: muestra,
  }
}

function extraerDiaPlanDePregunta(pregunta) {
  const t = String(pregunta || '').toLowerCase()
  const patterns = [
    /(?:d[ií]a\s*(?:del\s*plan\s*)?|estoy\s+en\s+(?:el\s*)?d[ií]a\s*|d[ií]a\s*n[°º.]?\s*)(\d{1,2})\b/,
    /\bd[ií]a\s*(\d{1,2})\b/,
    /(?:plan\s*)?(?:d[ií]a|day)\s*(\d{1,2})\b/,
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= 1 && n <= PLAN_MES1_TOTAL_DIAS) return n
    }
  }
  return null
}

function compactarDetalleDiaPlan(detalle) {
  if (!detalle?.comidas) return null
  return {
    dia: detalle.dia,
    titulo: detalle.titulo,
    tip: detalle.tip || '',
    comidas: detalle.comidas.map((slot) => ({
      momento: slot.label || slot.id,
      opcion_1: slot.opciones?.[0]?.texto || '',
      opcion_2: slot.opciones?.[1]?.texto || '',
    })),
  }
}

function compactarEjercicioDiaPlan(
  diaPlan,
  inicio,
  rutinas,
  rutinaActivaId,
  rutinaPesos,
  ejerciciosCardio,
  pesoKg,
) {
  const fecha = fechaCalendarioDiaPlan(inicio, diaPlan)
  if (!fecha) return null

  const diaIndiceEnRutina = indiceDiaRutinaParaDiaPlan(diaPlan, rutinas, rutinaActivaId)
  const rutinaView = buildRutinaView(
    fecha,
    diaIndiceEnRutina,
    rutinas,
    rutinaActivaId,
    rutinaPesos,
  )
  let rutina_gym = null
  if (rutinaView.tipo === 'ok') {
    rutina_gym = {
      nombre_rutina: rutinaView.rutinaNombre,
      dia_entrenamiento: rutinaView.dia?.nombre,
      indice_en_ciclo_rutina: rutinaView.diaIndice,
      ejercicios: rutinaView.ejercicios.map((ex) => ({
        nombre: ex.nombre,
        detalle: planEjercicioTexto(ex),
      })),
    }
  } else {
    rutina_gym = { sin_plan: rutinaView.tipo }
  }

  const actividad = (ejerciciosCardio || [])
    .filter((e) => fechaSoloDia(e.fecha) === fecha)
    .map((e) => ({
      nombre: e.nombre,
      tipo: e.tipo,
      duracion_min: num(e.duracion),
      distancia_km: e.distanciaKm != null ? num(e.distanciaKm) : undefined,
      kcal_est: Math.round(caloriasEjercicioRegistro(e, pesoKg)),
    }))

  return {
    fecha_calendario: fecha,
    dia_plan: diaPlan,
    rutina_gym,
    actividad_cardio_registrada: actividad,
  }
}

function buildDetalleDiasPlan(
  configPlan,
  planPropio,
  inicio,
  hoy,
  pregunta,
  rutinas,
  rutinaActivaId,
  rutinaPesos,
  ejerciciosCardio,
  pesoKg,
) {
  if (!inicio) return { dia_plan_calendario: null, detalle_dias: {} }
  const diaCalendario = diaPlanMes1(inicio, hoy)
  const diaPregunta = extraerDiaPlanDePregunta(pregunta)
  const dias = [...new Set([diaCalendario, diaPregunta].filter((d) => d != null && d >= 1 && d <= PLAN_MES1_TOTAL_DIAS))]

  const detalle_dias = {}
  for (const d of dias) {
    const raw = getDiaPlanAlimenticio(d, configPlan, planPropio)
    const compact = compactarDetalleDiaPlan(raw)
    const ejercicio = compactarEjercicioDiaPlan(
      d,
      inicio,
      rutinas,
      rutinaActivaId,
      rutinaPesos,
      ejerciciosCardio,
      pesoKg,
    )
    if (compact || ejercicio) {
      detalle_dias[String(d)] = {
        ...(compact || { dia: d }),
        ejercicio,
      }
    }
  }

  return {
    dia_plan_calendario: diaCalendario,
    dia_mencionado_en_pregunta: diaPregunta,
    detalle_dias,
  }
}

function resumenPlanNutricion(
  config,
  planPropio,
  planMes1Estado,
  planNutricionActivoId,
  planesNutricion,
  hoy,
  pregunta,
  rutinas,
  rutinaActivaId,
  rutinaPesos,
  ejerciciosCardio,
) {
  const configPlan = configConPlanBibliotecaActivo(
    config,
    planesNutricion,
    planNutricionActivoId,
  )
  const pesoKg = num(configPlan?.pesoKg) || 70
  const planHoy = resumenPlanAlimenticioHoy(configPlan, planPropio, hoy)
  const planId = planNutricionActivoId || config?.planNutricionId || null
  const estado = getEstadoPlanActivo(planMes1Estado, planId)
  const checks = Object.keys(estado.checks || {}).length
  const omitidos = Object.keys(estado.omitidos || {}).length
  const extras = Object.keys(estado.extras || {}).length
  const inicio = configPlan?.planMes1Inicio || null
  const diaCalendario = inicio ? diaPlanMes1(inicio, hoy) : null

  let adherenciaAprox = null
  if (diaCalendario != null && diaCalendario >= 1) {
    adherenciaAprox = {
      dia_plan_actual: diaCalendario,
      dias_plan_total: PLAN_MES1_TOTAL_DIAS,
      comidas_marcadas_ok: checks,
      omitidos: omitidos,
      extras_registrados: extras,
    }
  }

  const diasPlan = buildDetalleDiasPlan(
    configPlan,
    planPropio,
    inicio,
    hoy,
    pregunta,
    rutinas,
    rutinaActivaId,
    rutinaPesos,
    ejerciciosCardio,
    pesoKg,
  )

  return {
    activo: Boolean(inicio),
    origen: labelOrigenPlan(configPlan),
    plan_nutricion_id: planId,
    inicio_calendario: inicio,
    plan_propio_activo: planPropioStorageActivo(planPropio),
    hoy: planHoy,
    adherencia_aprox: adherenciaAprox,
    ...diasPlan,
  }
}

function resumenRutinaGym(rutinaPesos, desde, hasta) {
  const enRango = (rutinaPesos || []).filter((r) => {
    const f = fechaSoloDia(r.fecha)
    return f && f >= desde && f <= hasta
  })
  const series = enRango.reduce((acc, r) => acc + (Array.isArray(r.series) ? r.series.length : 1), 0)
  const dias = new Set(enRango.map((r) => fechaSoloDia(r.fecha))).size
  return {
    sesiones_registradas: enRango.length,
    dias_con_gym: dias,
    series_aprox: series,
  }
}

export function buildAsistenteContexto({
  config = {},
  comida = [],
  ejercicios = [],
  pregunta = '',
  fechaRef,
  planMes1Estado = null,
  planPropio = null,
  planNutricionActivoId = '',
  rutinaPesos = [],
  planesNutricion = [],
  rutinas = [],
  rutinaActivaId = '',
}) {
  const hoy = fechaSoloDia(fechaRef) || fechaToISO(new Date())
  const dias = getUltimosNDias(7)
  const mesEnCurso = getRangoMesEnCurso(hoy)
  const ultimos30 = getRangoPorPeriodo('mes')

  const resumenPorDia = dias.map((f) => {
    const r = resumenComidaDia(comida, f)
    return {
      fecha: f,
      kcal: Math.round(r.totales.kcal),
      proteinas_g: Math.round(r.totales.p),
      registros: r.count,
    }
  })

  const hoyDetalle = resumenComidaDia(comida, hoy)
  const pesoKg = num(config.pesoKg) || 70

  const ejerciciosSemana = (ejercicios || []).filter((e) => {
    const f = fechaSoloDia(e.fecha)
    return dias.includes(f)
  })
  let kcalEjercicioSemana = 0
  const ejerciciosRecientes = ejerciciosSemana.slice(0, 10).map((e) => {
    const kcal = caloriasEjercicioRegistro(e, pesoKg)
    kcalEjercicioSemana += kcal
    return {
      fecha: fechaSoloDia(e.fecha),
      nombre: e.nombre,
      tipo: e.tipo,
      duracion_min: num(e.duracion),
      distancia_km: e.distanciaKm != null ? num(e.distanciaKm) : undefined,
      kcal_est: Math.round(kcal),
    }
  })

  let catalogoHits = []
  if (pregunta.trim() && preguntaNecesitaCatalogo(pregunta)) {
    catalogoHits = buscarAlimentos(pregunta)
      .slice(0, 6)
      .map((a) => ({
        nombre: a.nombre,
        kcal: a.calorias,
        porcion: a.porcion,
        proteinas_g: a.proteinas,
        carbohidratos_g: a.carbohidratos,
        grasas_g: a.grasas,
      }))
  }

  const comidaMesEnCurso = resumenPeriodoComida(comida, mesEnCurso.desde, mesEnCurso.hasta)
  const comidaUltimos30 = resumenPeriodoComida(comida, ultimos30.desde, ultimos30.hasta)
  const ejercicioMesEnCurso = resumenPeriodoEjercicio(
    ejercicios,
    mesEnCurso.desde,
    mesEnCurso.hasta,
    pesoKg,
  )
  const ejercicioUltimos30 = resumenPeriodoEjercicio(
    ejercicios,
    ultimos30.desde,
    ultimos30.hasta,
    pesoKg,
  )
  const gymMes = resumenRutinaGym(rutinaPesos, mesEnCurso.desde, mesEnCurso.hasta)
  const planNutricion = resumenPlanNutricion(
    config,
    planPropio,
    planMes1Estado,
    planNutricionActivoId,
    planesNutricion,
    hoy,
    pregunta,
    rutinas,
    rutinaActivaId,
    rutinaPesos,
    ejercicios,
  )

  const rutinaGymUsuario = resumenRutinaActivaUsuario(rutinas, rutinaActivaId)

  return {
    app: 'Mi rutina',
    fecha_hoy: hoy,
    comida_registros_total: (comida || []).length,
    rutina_gym_usuario: rutinaGymUsuario,
    perfil: {
      peso_kg: pesoKg,
      objetivo: config.objetivo || '',
      meta_kcal: config.metaCalorias || '',
      meta_proteina_g: config.metaProteina || '',
      meta_carbohidratos_g: config.metaCarbohidratos || '',
      meta_grasa_g: config.metaGrasa || '',
    },
    comida_hoy: {
      totales: {
        kcal: Math.round(hoyDetalle.totales.kcal),
        proteinas_g: Math.round(hoyDetalle.totales.p),
        carbohidratos_g: Math.round(hoyDetalle.totales.c),
        grasas_g: Math.round(hoyDetalle.totales.g),
      },
      detalle: hoyDetalle.comidas,
    },
    comida_ultimos_7_dias: resumenPorDia,
    mes_en_curso: {
      etiqueta: mesEnCurso.etiqueta,
      comida: comidaMesEnCurso,
      ejercicio: ejercicioMesEnCurso,
      rutina_gym: gymMes,
    },
    ultimos_30_dias: {
      comida: comidaUltimos30,
      ejercicio: ejercicioUltimos30,
    },
    plan_alimentacion: planNutricion,
    ejercicio_ultimos_7_dias: {
      kcal_estimadas_total: Math.round(kcalEjercicioSemana),
      registros: ejerciciosRecientes,
    },
    catalogo_local_coincidencias: catalogoHits,
    intent_registro_comida: esIntentRegistroComida(pregunta),
    incluir_rutina_gym_en_contexto: preguntaMencionaRutinaOPlan(pregunta),
    nota_analisis:
      'Para preguntas del mes usá mes_en_curso y plan_alimentacion; compará con metas en perfil. No inventes datos.',
    nota_catalogo:
      'Si catalogo_local_coincidencias tiene ítems, priorizá esos datos sobre estimaciones genéricas.',
    nota_rutina_gym:
      'El gym del plan usa rutina_gym_usuario (rutina activa del usuario). Día N del plan = día N del ciclo de sus días de entrenamiento (1→1, 2→2, luego repite). No inventes ejercicios.',
  }
}
