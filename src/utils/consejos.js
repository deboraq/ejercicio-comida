import {
  caloriasEjercicioRegistro,
  caloriasQuemadasRutinaDia,
  etiquetaTipo,
  fechaSoloDia,
  getCategoriaTipo,
  minutosRutinaDia,
} from './calorias'
import { getUltimosNDias } from './estadisticas'
import { buildProgresoMedidas, formatDeltaCm, labelCampo } from './medidas'
import { buildPerfilCorporal } from './composicion'

export const OBJETIVOS = [
  { value: 'bajar_peso', label: 'Bajar de peso', icon: '📉' },
  { value: 'mantener_peso', label: 'Mantener peso', icon: '⚖️' },
  { value: 'aumentar_peso', label: 'Aumentar peso', icon: '📈' },
  { value: 'ganar_musculo', label: 'Ganar músculo', icon: '💪' },
]

export const MOMENTOS_COMIDA = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena']
const ALIAS_MOMENTO = { Snack: 'Merienda' }

function num(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

export function normalizarMomento(comida) {
  if (comida == null || comida === '') return ''
  return ALIAS_MOMENTO[comida] || comida
}

function getMetas(config, pesoKg) {
  return {
    calorias: num(config?.metaCalorias) || null,
    proteina: num(config?.metaProteina) || Math.round(pesoKg * 1.4),
    carbohidratos: num(config?.metaCarbohidratos) || null,
    grasa: num(config?.metaGrasa) || null,
  }
}

function consejo(ambito, tipo, prioridad, texto) {
  return { ambito, tipo, prioridad, texto }
}

function ordenarConsejos(lista) {
  return [...lista].sort((a, b) => b.prioridad - a.prioridad)
}

function uniqTextos(lista, max) {
  const vistos = new Set()
  const out = []
  for (const item of ordenarConsejos(lista)) {
    if (vistos.has(item.texto)) continue
    vistos.add(item.texto)
    out.push(item)
    if (out.length >= max) break
  }
  return out
}

/**
 * Arma el contexto del día a partir de comidas, ejercicios y rutina registrados.
 */
export function buildContextoDia({
  comidas = [],
  ejercicios = [],
  registrosRutina = [],
  fecha,
  pesoKg = 70,
  config = {},
}) {
  const comidasDia = comidas.filter((c) => fechaSoloDia(c.fecha) === fecha)
  const ejerciciosDia = ejercicios.filter((e) => fechaSoloDia(e.fecha) === fecha)
  const rutinaDia = registrosRutina.filter((r) => fechaSoloDia(r.fecha) === fecha)

  const caloriasConsumidas = comidasDia.reduce((s, r) => s + num(r.calorias), 0)
  const proteinas = comidasDia.reduce((s, r) => s + num(r.proteinas), 0)
  const carbohidratos = comidasDia.reduce((s, r) => s + num(r.carbohidratos), 0)
  const caloriasQuemadasEjercicio = ejerciciosDia.reduce(
    (s, e) => s + caloriasEjercicioRegistro(e, pesoKg),
    0
  )
  const caloriasQuemadasRutina = caloriasQuemadasRutinaDia(registrosRutina, fecha, pesoKg)
  const caloriasQuemadas = caloriasQuemadasEjercicio + caloriasQuemadasRutina
  const minutosEjercicio = ejerciciosDia.reduce((s, e) => s + num(e.duracion), 0)
  const minutosRutina = minutosRutinaDia(registrosRutina, fecha)
  const minutosActividad = minutosEjercicio + minutosRutina

  const momentosRegistrados = new Set(
    comidasDia
      .map((r) => normalizarMomento(r.comida))
      .filter((m) => MOMENTOS_COMIDA.includes(m))
  )
  const momentosPendientes = MOMENTOS_COMIDA.filter((m) => !momentosRegistrados.has(m))

  const comidasPorMomento = {}
  for (const momento of MOMENTOS_COMIDA) {
    const items = comidasDia.filter((r) => normalizarMomento(r.comida) === momento)
    if (!items.length) continue
    comidasPorMomento[momento] = {
      items,
      calorias: items.reduce((s, r) => s + num(r.calorias), 0),
      proteinas: items.reduce((s, r) => s + num(r.proteinas), 0),
      carbohidratos: items.reduce((s, r) => s + num(r.carbohidratos), 0),
    }
  }

  const ejerciciosPorTipo = ejerciciosDia.reduce((acc, ex) => {
    const cat = getCategoriaTipo(ex.tipo)
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  const ejerciciosResumen = ejerciciosDia.map((e) => ({
    tipo: e.tipo,
    categoria: getCategoriaTipo(e.tipo),
    etiqueta: etiquetaTipo(e.tipo),
    duracion: num(e.duracion),
    calorias: caloriasEjercicioRegistro(e, pesoKg),
  }))

  const tieneActividad =
    ejerciciosDia.length > 0 || rutinaDia.length > 0 || minutosActividad > 0

  return {
    fecha,
    caloriasConsumidas,
    caloriasQuemadas,
    caloriasQuemadasEjercicio,
    caloriasQuemadasRutina,
    proteinas,
    carbohidratos,
    minutosEjercicio,
    minutosRutina,
    minutosActividad,
    numComidas: comidasDia.length,
    comidas: comidasDia.map((r) => ({
      momento: normalizarMomento(r.comida) || 'Otros',
      descripcion: r.descripcion || '',
      calorias: num(r.calorias),
      proteinas: num(r.proteinas),
      carbohidratos: num(r.carbohidratos),
    })),
    momentosRegistrados: [...momentosRegistrados],
    momentosPendientes,
    comidasPorMomento,
    ejercicios: ejerciciosResumen,
    ejerciciosPorTipo,
    numEjercicios: ejerciciosDia.length,
    numRegistrosRutina: rutinaDia.length,
    tieneActividad,
    metas: getMetas(config, pesoKg),
    // Compatibilidad con código que aún lee estos campos sueltos
    ejerciciosPorTipoLegacy: ejerciciosPorTipo,
  }
}

/**
 * Resume los últimos N días (por defecto 7) con lo registrado en comida y actividad.
 */
export function buildContextoSemana({
  comidas = [],
  ejercicios = [],
  registrosRutina = [],
  dias = getUltimosNDias(7),
  pesoKg = 70,
  config = {},
}) {
  const metas = getMetas(config, pesoKg)
  let diasConComida = 0
  let diasConActividad = 0
  let totalCalorias = 0
  let totalProteinas = 0
  let totalQuemadas = 0
  let totalMinutos = 0
  const momentosConteo = Object.fromEntries(MOMENTOS_COMIDA.map((m) => [m, 0]))
  const tiposEjercicio = {}
  const diasDetalle = []

  for (const fecha of dias) {
    const ctx = buildContextoDia({
      comidas,
      ejercicios,
      registrosRutina,
      fecha,
      pesoKg,
      config,
    })
    diasDetalle.push(ctx)

    if (ctx.numComidas > 0) {
      diasConComida += 1
      totalCalorias += ctx.caloriasConsumidas
      totalProteinas += ctx.proteinas
    }
    if (ctx.tieneActividad) {
      diasConActividad += 1
      totalQuemadas += ctx.caloriasQuemadas
      totalMinutos += ctx.minutosActividad
    }
    ctx.momentosRegistrados.forEach((m) => {
      if (momentosConteo[m] != null) momentosConteo[m] += 1
    })
    Object.entries(ctx.ejerciciosPorTipo).forEach(([tipo, cantidad]) => {
      tiposEjercicio[tipo] = (tiposEjercicio[tipo] || 0) + cantidad
    })
  }

  const numDias = dias.length

  return {
    numDias,
    dias,
    diasConComida,
    diasConActividad,
    promedioCalorias: diasConComida ? Math.round(totalCalorias / diasConComida) : 0,
    promedioProteinas: diasConComida ? Math.round(totalProteinas / diasConComida) : 0,
    promedioQuemadas: diasConActividad ? Math.round(totalQuemadas / diasConActividad) : 0,
    promedioMinutosActividad: diasConActividad ? Math.round(totalMinutos / diasConActividad) : 0,
    momentosConteo,
    tiposEjercicio,
    metas,
    diasDetalle,
  }
}

function consejosComidaDelDia(obj, ctx) {
  const tips = []
  const { metas } = ctx
  const metaPro = metas.proteina
  const metaCal = metas.calorias

  if (ctx.numComidas === 0) {
    tips.push(
      consejo(
        'dia',
        'comida',
        100,
        'Todavía no registraste comidas hoy. Anotá al menos el desayuno o la comida que ya hayas hecho para tener consejos más útiles.'
      )
    )
    return tips
  }

  if (ctx.momentosPendientes.length > 0) {
    const faltan = ctx.momentosPendientes.join(', ')
    tips.push(
      consejo(
        'dia',
        'comida',
        90,
        `Registraste ${ctx.momentosRegistrados.join(', ') || 'algunas comidas'}. Te falta anotar: ${faltan}.`
      )
    )
  }

  const desayuno = ctx.comidasPorMomento.Desayuno
  if (desayuno && desayuno.proteinas < metaPro * 0.15 && ctx.proteinas < metaPro * 0.5) {
    tips.push(
      consejo(
        'dia',
        'comida',
        82,
        'El desayuno trae poca proteína. Sumá huevo, yogur, queso o legumbres para arrancar mejor el día.'
      )
    )
  }

  const momentosConCal = Object.entries(ctx.comidasPorMomento)
  if (momentosConCal.length >= 1 && ctx.caloriasConsumidas > 0) {
    const [, mayor] = momentosConCal.reduce(
      (max, entry) => (entry[1].calorias > max[1].calorias ? entry : max),
      ['', { calorias: 0 }]
    )
    if (mayor.calorias > ctx.caloriasConsumidas * 0.75 && momentosConCal.length > 1) {
      tips.push(
        consejo(
          'dia',
          'comida',
          70,
          'La mayor parte de las calorías está en una sola comida. Repartir en más momentos ayuda a la energía y al control del apetito.'
        )
      )
    }
  }

  if (metaCal && ctx.caloriasConsumidas > metaCal * 1.12 && obj === 'bajar_peso') {
    tips.push(
      consejo(
        'dia',
        'balance',
        88,
        `Llevás ${ctx.caloriasConsumidas} kcal y tu meta es ${metaCal}. Para bajar de peso, intentá cerrar el día más cerca de la meta o sumar actividad.`
      )
    )
  }

  if (
    metaCal &&
    ctx.caloriasConsumidas > 0 &&
    ctx.caloriasConsumidas < metaCal * 0.65 &&
    (obj === 'aumentar_peso' || obj === 'ganar_musculo')
  ) {
    tips.push(
      consejo(
        'dia',
        'balance',
        86,
        `Hoy vas ${ctx.caloriasConsumidas} kcal de ${metaCal}. Para tu objetivo conviene sumar comidas nutritivas, sobre todo en almuerzo o merienda.`
      )
    )
  }

  if (ctx.proteinas > 0 && ctx.proteinas < metaPro * 0.55) {
    tips.push(
      consejo(
        'dia',
        'comida',
        85,
        `Llevás ${Math.round(ctx.proteinas)} g de proteína y tu meta ronda ${metaPro} g. La cena es buen momento para pollo, pescado, huevo o legumbres.`
      )
    )
  }

  if (ctx.proteinas >= metaPro * 0.9 && (obj === 'ganar_musculo' || obj === 'aumentar_peso')) {
    tips.push(
      consejo(
        'dia',
        'comida',
        60,
        `Buen día de proteína (${Math.round(ctx.proteinas)} g). Mantené esa línea para apoyar tu objetivo.`
      )
    )
  }

  return tips
}

function consejosEjercicioDelDia(obj, ctx) {
  const tips = []
  const { metas } = ctx
  const metaPro = metas.proteina

  if (!ctx.tieneActividad) {
    if (obj === 'bajar_peso' || obj === 'mantener_peso') {
      tips.push(
        consejo(
          'dia',
          'ejercicio',
          75,
          'Hoy no hay ejercicio ni rutina registrados. Una caminata o sesión corta suma al balance calórico y al ánimo.'
        )
      )
    } else if (obj === 'ganar_musculo') {
      tips.push(
        consejo(
          'dia',
          'ejercicio',
          78,
          'No registraste entrenamiento hoy. Para ganar músculo, la constancia con fuerza o rutina de gimnasio es clave.'
        )
      )
    }
    return tips
  }

  const partes = []
  if (ctx.numEjercicios > 0) {
    const nombres = [...new Set(ctx.ejercicios.map((e) => e.etiqueta))].slice(0, 3)
    partes.push(`${ctx.numEjercicios} ejercicio${ctx.numEjercicios > 1 ? 's' : ''} (${nombres.join(', ')})`)
  }
  if (ctx.numRegistrosRutina > 0) {
    partes.push(`${ctx.numRegistrosRutina} registro${ctx.numRegistrosRutina > 1 ? 's' : ''} de rutina`)
  }

  tips.push(
    consejo(
      'dia',
      'ejercicio',
      72,
      `Hoy registraste ${partes.join(' y ')}: ~${Math.round(ctx.caloriasQuemadas)} kcal quemadas en ${ctx.minutosActividad} min.`
    )
  )

  const hayCardio = (ctx.ejerciciosPorTipo.Cardio || 0) > 0
  const hayFuerza = (ctx.ejerciciosPorTipo.Fuerza || 0) > 0 || ctx.numRegistrosRutina > 0

  if (hayCardio && ctx.carbohidratos < 80 && ctx.caloriasConsumidas > 0) {
    tips.push(
      consejo(
        'dia',
        'ejercicio',
        80,
        'Hiciste cardio y hoy hay pocos carbohidratos registrados. Arroz, fruta o pan integral en la próxima comida ayudan a recuperar.'
      )
    )
  }

  if (hayFuerza && ctx.proteinas < metaPro * 0.7) {
    tips.push(
      consejo(
        'dia',
        'ejercicio',
        84,
        'Entrenaste fuerza o rutina y la proteína del día va baja. Priorizala en la comida que siga para recuperar mejor.'
      )
    )
  }

  if (ctx.caloriasQuemadas > 350 && ctx.caloriasConsumidas > 0) {
    const balance = ctx.caloriasConsumidas - ctx.caloriasQuemadas
    if (obj === 'bajar_peso' && balance > 400) {
      tips.push(
        consejo(
          'dia',
          'balance',
          87,
          `Consumiste ${ctx.caloriasConsumidas} kcal y quemaste ~${Math.round(ctx.caloriasQuemadas)}. El excedente es alto para bajar de peso; controlá porciones en la cena.`
        )
      )
    }
    if ((obj === 'mantener_peso' || obj === 'ganar_musculo') && balance < -250) {
      tips.push(
        consejo(
          'dia',
          'balance',
          83,
          `Quemaste más de lo que llevás consumido (~${Math.abs(Math.round(balance))} kcal de diferencia). Sumá una comida o merienda nutritiva para no quedarte corto.`
        )
      )
    }
  }

  if (obj === 'ganar_musculo' && hayCardio && !hayFuerza) {
    tips.push(
      consejo(
        'dia',
        'ejercicio',
        68,
        'Hoy solo hay cardio registrado. Para ganar músculo, sumá también entrenamiento de fuerza o tu rutina de gimnasio.'
      )
    )
  }

  return tips
}

function consejosSemanales(obj, ctx) {
  const tips = []
  const { metas, numDias } = ctx
  const metaPro = metas.proteina
  const metaCal = metas.calorias

  if (ctx.diasConComida === 0) {
    tips.push(
      consejo(
        'semana',
        'comida',
        95,
        'Esta semana no hay comidas registradas. Anotar aunque sea desayuno y cena te da un panorama real y mejores consejos.'
      )
    )
    return tips
  }

  if (ctx.diasConComida < Math.ceil(numDias * 0.4)) {
    tips.push(
      consejo(
        'semana',
        'comida',
        92,
        `Solo registraste comidas ${ctx.diasConComida} de ${numDias} días. Registrar más seguido ayuda a ver patrones y ajustar mejor.`
      )
    )
  }

  const meriendas = ctx.momentosConteo.Merienda || 0
  if (meriendas <= 1 && ctx.diasConComida >= 3) {
    tips.push(
      consejo(
        'semana',
        'comida',
        78,
        'Casi no registraste meriendas esta semana. Si comés a la tarde, anotarlas evita quedarte corto en calorías o proteína.'
      )
    )
  }

  if (ctx.promedioProteinas > 0 && ctx.promedioProteinas < metaPro * 0.75) {
    tips.push(
      consejo(
        'semana',
        'comida',
        86,
        `Tu promedio de proteína ronda ${ctx.promedioProteinas} g/día y la meta es ${metaPro} g. Subí proteína en almuerzo y cena de forma constante.`
      )
    )
  }

  if (metaCal && ctx.promedioCalorias > metaCal * 1.1 && obj === 'bajar_peso') {
    tips.push(
      consejo(
        'semana',
        'balance',
        88,
        `En los días que registraste comida, promediás ${ctx.promedioCalorias} kcal (meta ${metaCal}). Revisá porciones o sumá actividad varias veces por semana.`
      )
    )
  }

  if (metaCal && ctx.promedioCalorias > 0 && ctx.promedioCalorias < metaCal * 0.75 && (obj === 'aumentar_peso' || obj === 'ganar_musculo')) {
    tips.push(
      consejo(
        'semana',
        'balance',
        87,
        `Promediás ${ctx.promedioCalorias} kcal en días con registro; tu meta es ${metaCal}. Sumá meriendas o colaciones nutritivas entre comidas principales.`
      )
    )
  }

  if (ctx.diasConActividad < 3 && (obj === 'mantener_peso' || obj === 'bajar_peso' || obj === 'ganar_musculo')) {
    tips.push(
      consejo(
        'semana',
        'ejercicio',
        85,
        `Esta semana registraste actividad ${ctx.diasConActividad} de ${numDias} días. Apuntá a al menos 3 días con movimiento o rutina.`
      )
    )
  }

  const soloCardio = (ctx.tiposEjercicio.Cardio || 0) > 0 && !(ctx.tiposEjercicio.Fuerza || 0)
  if (obj === 'ganar_musculo' && soloCardio && ctx.diasConActividad >= 2) {
    tips.push(
      consejo(
        'semana',
        'ejercicio',
        82,
        'Esta semana predominó el cardio. Para ganar músculo, incluí fuerza o rutina de gimnasio al menos 2 veces por semana.'
      )
    )
  }

  if (ctx.diasConComida >= 5 && ctx.diasConActividad >= 3) {
    tips.push(
      consejo(
        'semana',
        'habito',
        55,
        `Buen ritmo: ${ctx.diasConComida} días con comidas y ${ctx.diasConActividad} con actividad esta semana. Mantener el registro te da ventaja.`
      )
    )
  }

  return tips
}

/**
 * Consejos según historial de medidas corporales (cm).
 */
function consejosMedidas(obj, progreso) {
  const tips = []
  if (!progreso) return tips

  if (progreso.numTomas === 0) {
    tips.push(
      consejo(
        'semana',
        'medidas',
        70,
        'Todavía no hay medidas corporales. Registrá cintura, cadera y brazos en Config: el peso solo no cuenta toda la historia del progreso.'
      )
    )
    return tips
  }

  if (progreso.numTomas === 1) {
    tips.push(
      consejo(
        'semana',
        'medidas',
        72,
        'Ya tenés una toma de medidas. Volvé a medir en 1–2 semanas (mismos puntos y hora) para ver si bajó cintura o subieron brazos/muslos.'
      )
    )
  }

  if (progreso.diasDesdeUltima != null && progreso.diasDesdeUltima >= 14) {
    tips.push(
      consejo(
        'semana',
        'medidas',
        90,
        `Pasaron ${progreso.diasDesdeUltima} días desde tu última toma de medidas. Una nueva medición actualiza el progreso real de cintura, cadera y brazos.`
      )
    )
  } else if (progreso.diasDesdeUltima != null && progreso.diasDesdeUltima >= 7 && progreso.numTomas >= 1) {
    tips.push(
      consejo(
        'semana',
        'medidas',
        62,
        'Esta semana es buen momento para una nueva toma de medidas y comparar con la anterior.'
      )
    )
  }

  const d = progreso.deltas || {}
  const v = progreso.valoresUltima || {}

  if (d.cinturaBaja != null) {
    const textoDelta = formatDeltaCm(d.cinturaBaja)
    if (obj === 'bajar_peso' && d.cinturaBaja <= -1) {
      tips.push(
        consejo(
          'semana',
          'medidas',
          88,
          `La cintura baja bajó ${textoDelta} vs. la toma anterior. Buen progreso de composición, aunque el peso no se mueva tanto.`
        )
      )
    } else if (obj === 'bajar_peso' && d.cinturaBaja >= 1.5) {
      tips.push(
        consejo(
          'semana',
          'medidas',
          84,
          `La cintura baja subió ${textoDelta}. Revisá calorías de la semana y mantené constancia con actividad; medí siempre en el mismo punto.`
        )
      )
    } else if (d.cinturaBaja <= -1) {
      tips.push(
        consejo(
          'semana',
          'medidas',
          74,
          `Cintura baja: ${textoDelta} respecto a la medición anterior. El seguimiento en cm ayuda a ver cambios reales.`
        )
      )
    }
  }

  if (d.cadera != null && obj === 'bajar_peso' && d.cadera <= -1) {
    tips.push(
      consejo(
        'semana',
        'medidas',
        80,
        `La cadera bajó ${formatDeltaCm(d.cadera)}. Seguí priorizando proteína y déficit moderado para conservar músculo.`
      )
    )
  }

  const deltaBrazo = (() => {
    const partes = [d.brazoIzq, d.brazoDer].filter((x) => x != null)
    if (!partes.length) return null
    return Math.round((partes.reduce((s, x) => s + x, 0) / partes.length) * 10) / 10
  })()

  if (deltaBrazo != null) {
    if ((obj === 'ganar_musculo' || obj === 'aumentar_peso') && deltaBrazo >= 0.5) {
      tips.push(
        consejo(
          'semana',
          'medidas',
          86,
          `Los brazos subieron en promedio ${formatDeltaCm(deltaBrazo)}. Buena señal de progreso muscular; mantené fuerza y proteína alta.`
        )
      )
    } else if (obj === 'ganar_musculo' && deltaBrazo <= -0.5) {
      tips.push(
        consejo(
          'semana',
          'medidas',
          83,
          `Los brazos bajaron ~${formatDeltaCm(Math.abs(deltaBrazo))}. Revisá si estás en déficit fuerte o faltan series de fuerza / proteína.`
        )
      )
    }
  }

  if (d.pecho != null && (obj === 'ganar_musculo' || obj === 'aumentar_peso') && d.pecho >= 0.8) {
    tips.push(
      consejo(
        'semana',
        'medidas',
        76,
        `El pecho subió ${formatDeltaCm(d.pecho)}. Si entrenás pecho/espalda, ese cambio suele ir con más masa o mejor postura.`
      )
    )
  }

  if (progreso.asimBrazo != null && progreso.asimBrazo >= 1.5) {
    tips.push(
      consejo(
        'semana',
        'medidas',
        68,
        `Hay ${progreso.asimBrazo} cm de diferencia entre brazos. Trabajá un poco más el lado más chico (mismas series unilaterales) y medí siempre igual.`
      )
    )
  }

  if (progreso.asimMuslo != null && progreso.asimMuslo >= 2) {
    tips.push(
      consejo(
        'semana',
        'medidas',
        66,
        `Los muslos difieren ${progreso.asimMuslo} cm. Sumá trabajo unilateral (zancadas, step-ups) para equilibrar.`
      )
    )
  }

  if (v.cinturaBaja != null && v.cadera != null && v.cadera > 0) {
    const ratio = Math.round((v.cinturaBaja / v.cadera) * 100) / 100
    if (obj === 'bajar_peso' && ratio >= 0.9) {
      tips.push(
        consejo(
          'semana',
          'medidas',
          64,
          `Tu cintura (${v.cinturaBaja} cm) está cerca de la cadera (${v.cadera} cm). Bajar cintura con déficit y caminatas suele mejorar esa proporción.`
        )
      )
    }
  }

  if (progreso.camposComparables?.length >= 2) {
    const bajaron = progreso.camposComparables.filter((k) => d[k] < 0)
    const subieron = progreso.camposComparables.filter((k) => d[k] > 0)
    if (obj === 'bajar_peso' && bajaron.includes('cinturaBaja') && (subieron.includes('brazoIzq') || subieron.includes('brazoDer'))) {
      tips.push(
        consejo(
          'semana',
          'medidas',
          79,
          'Bajó cintura y subieron brazos: típico de recomposición (menos grasa, más músculo). Seguí con fuerza + proteína.'
        )
      )
    }
  }

  // Tip suave si hay datos pero sin deltas “fuertes”
  if (tips.length === 0 && progreso.numTomas >= 2 && Object.keys(d).length > 0) {
    const ejemplo = progreso.camposComparables[0]
    tips.push(
      consejo(
        'semana',
        'medidas',
        58,
        `Última comparación: ${labelCampo(ejemplo)} ${formatDeltaCm(d[ejemplo])}. Los cambios chicos son normales; mirá la tendencia en 3–4 tomas.`
      )
    )
  }

  return tips
}

/**
 * Consejos según peso, altura (IMC), sexo y edad.
 */
function consejosPerfilCorporal(obj, perfil) {
  const tips = []
  if (!perfil) return tips

  if (!perfil.alturaCm) {
    tips.push(
      consejo(
        'semana',
        'perfil',
        73,
        'Falta tu altura en Config. Con peso + altura calculamos el IMC y un rango de peso orientativo.'
      )
    )
    return tips
  }

  if (!perfil.pesoKg) {
    tips.push(
      consejo(
        'semana',
        'perfil',
        74,
        'Tenés altura cargada pero falta el peso. Registrá una medición para ver el IMC.'
      )
    )
    return tips
  }

  if (perfil.imc != null && perfil.categoria) {
    const { imc, categoria, rango } = perfil
    if (obj === 'bajar_peso' && (categoria.key === 'sobrepeso' || categoria.key === 'obesidad')) {
      tips.push(
        consejo(
          'semana',
          'perfil',
          81,
          `Tu IMC es ${imc} (${categoria.label}). Bajá de a poco con déficit moderado; el rango orientativo para tu altura es ${rango.min}–${rango.max} kg (el IMC no ve músculo vs grasa).`
        )
      )
    } else if (obj === 'aumentar_peso' && categoria.key === 'bajo') {
      tips.push(
        consejo(
          'semana',
          'perfil',
          81,
          `Tu IMC es ${imc} (bajo peso). Subí calorías con comidas nutritivas y sumá fuerza para ganar músculo, no solo grasa.`
        )
      )
    } else if (obj === 'ganar_musculo' && categoria.key === 'normal') {
      tips.push(
        consejo(
          'semana',
          'perfil',
          60,
          `IMC ${imc} en rango saludable. Para ganar músculo importan más fuerza, proteína y medidas (brazos/pecho) que el IMC solo.`
        )
      )
    } else if (categoria.key === 'normal' && obj === 'mantener_peso') {
      tips.push(
        consejo(
          'semana',
          'perfil',
          52,
          `IMC ${imc}: en rango saludable. Seguí midiendo cintura y peso cada tanto para mantener el equilibrio.`
        )
      )
    } else if (obj === 'ganar_musculo' && (categoria.key === 'sobrepeso' || categoria.key === 'obesidad')) {
      tips.push(
        consejo(
          'semana',
          'perfil',
          78,
          `IMC ${imc}. Si buscás músculo con sobrepeso, priorizá fuerza + proteína y mirá cintura/medidas: el peso puede bajar poco mientras mejorás composición.`
        )
      )
    }
  }

  if (!perfil.sexo || !perfil.edad) {
    tips.push(
      consejo(
        'semana',
        'perfil',
        48,
        'Si cargás sexo y edad en Config, podemos estimar tu metabolismo basal (TMB) y sugerir kcal diarias.'
      )
    )
  }

  if (perfil.edad && perfil.pesoKg && perfil.alturaCm && !perfil.nivelActividad) {
    tips.push(
      consejo(
        'semana',
        'perfil',
        76,
        'Falta tu nivel de actividad en Config. Con eso estimamos tu gasto diario y sugerimos metas de calorías y macros.'
      )
    )
  }

  if (perfil.tdee != null && perfil.sugerencia) {
    tips.push(
      consejo(
        'semana',
        'perfil',
        57,
        `Tu gasto diario estimado es ~${perfil.tdee} kcal. Para tu objetivo sugerimos ~${perfil.sugerencia.calorias} kcal/día (podés aplicarlo en Config → Metas).`
      )
    )
  }

  return tips
}

/**
 * Consejos del día según comidas y ejercicios registrados.
 */
export function getConsejosDelDia(objetivo, contexto, config = {}, progresoMedidas = null) {
  const obj = objetivo || config?.objetivo || 'mantener_peso'
  const ctx =
    contexto?.numComidas != null
      ? contexto
      : buildContextoDia({
          comidas: contexto?.comidas || [],
          ejercicios: contexto?.ejercicios || [],
          registrosRutina: contexto?.registrosRutina || [],
          fecha: contexto?.fecha,
          pesoKg: config?.pesoKg || 70,
          config,
        })

  if (!ctx.fecha && contexto?.caloriasConsumidas != null) {
    // Compatibilidad mínima con el formato anterior (solo totales)
    const tips = []
    const metaPro = getMetas(config, config?.pesoKg || 70).proteina
    const cal = num(contexto.caloriasConsumidas)
    const pro = num(contexto.proteinas)
    const quemadas = num(contexto.caloriasQuemadas)
    if (obj === 'bajar_peso' && cal > 0 && quemadas > 0 && cal > quemadas + 400) {
      tips.push(
        consejo(
          'dia',
          'balance',
          80,
          'Hoy llevás más calorías que las quemadas. Para bajar, buscá un déficit moderado con comida o más movimiento.'
        )
      )
    }
    if ((obj === 'ganar_musculo' || obj === 'aumentar_peso') && pro < metaPro && cal > 0) {
      tips.push(
        consejo(
          'dia',
          'comida',
          80,
          `Para tu objetivo conviene más proteína: intentá llegar a unos ${metaPro} g al día.`
        )
      )
    }
    return uniqTextos(tips, 1)
  }

  const tips = [
    ...consejosComidaDelDia(obj, ctx),
    ...consejosEjercicioDelDia(obj, ctx),
  ]

  // Recordatorio puntual de medidas (prioridad media) mezclado en el día
  if (progresoMedidas?.numTomas === 0) {
    tips.push(
      consejo(
        'dia',
        'medidas',
        55,
        'Para ver progreso real, sumá una toma de medidas (cintura, cadera, brazos) en Config cuando puedas.'
      )
    )
  } else if (progresoMedidas?.diasDesdeUltima != null && progresoMedidas.diasDesdeUltima >= 14) {
    tips.push(
      consejo(
        'dia',
        'medidas',
        77,
        'Hace más de 2 semanas de tu última medición. Hoy o mañana es buen día para actualizar cintura y brazos.'
      )
    )
  }

  const perfil = buildPerfilCorporal(config)
  if (!perfil.alturaCm && perfil.pesoKg) {
    tips.push(
      consejo(
        'dia',
        'perfil',
        58,
        'Con tu peso ya cargado, sumá la altura en Config para calcular el IMC.'
      )
    )
  }

  return uniqTextos(tips, 1)
}

/**
 * Consejos semanales según lo registrado en los últimos días.
 */
export function getConsejosSemanales(objetivo, contextoSemana, config = {}, progresoMedidas = null) {
  const obj = objetivo || config?.objetivo || 'mantener_peso'
  const ctx = contextoSemana?.diasConComida != null
    ? contextoSemana
    : buildContextoSemana({
        comidas: contextoSemana?.comidas || [],
        ejercicios: contextoSemana?.ejercicios || [],
        registrosRutina: contextoSemana?.registrosRutina || [],
        dias: contextoSemana?.dias,
        pesoKg: config?.pesoKg || 70,
        config,
      })

  const tips = [
    ...consejosSemanales(obj, ctx),
    ...consejosMedidas(obj, progresoMedidas),
    ...consejosPerfilCorporal(obj, buildPerfilCorporal(config)),
  ]

  return uniqTextos(tips, 1)
}

/**
 * Devuelve consejos diarios y semanales listos para mostrar.
 * @param {object} [extras] { historialMedidas, hoy }
 */
export function getConsejos(objetivo, contextoDia, contextoSemana, config = {}, extras = {}) {
  const hoy = extras.hoy || contextoDia?.fecha
  const progresoMedidas =
    extras.progresoMedidas ||
    (extras.historialMedidas != null
      ? buildProgresoMedidas(extras.historialMedidas, hoy)
      : null)

  return {
    diarios: getConsejosDelDia(objetivo, contextoDia, config, progresoMedidas),
    semanales: getConsejosSemanales(objetivo, contextoSemana, config, progresoMedidas),
  }
}
