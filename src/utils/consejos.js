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

function pct(valor, meta) {
  if (!meta || meta <= 0) return null
  return valor / meta
}

function redondear(n) {
  return Math.round(Number(n) || 0)
}

/** Sugerencias concretas de alimentos según gramos de proteína faltantes. */
function sugerenciaProteina(faltanG) {
  const f = Math.max(0, redondear(faltanG))
  if (f <= 12) return `${f} g: 1 huevo + 1 yogur o 1 loncha de queso`
  if (f <= 25) return `${f} g: 3 huevos o 1 lata de atún`
  if (f <= 40) return `${f} g: 1 pechuga chica (~120 g) o atún + 2 huevos`
  return `${f} g: pechuga de pollo (~150 g) o pescado + yogur griego`
}

function sugerenciaCarbos(faltanG) {
  const f = Math.max(0, redondear(faltanG))
  if (f <= 30) return `un plátano o 1 taza de fruta (~${f} g)`
  if (f <= 50) return `1 bowl de avena o 1 taza de arroz (~${f} g)`
  return `avena + fruta o 1 plato de pasta (~${f} g)`
}

function esDiaFuerza(ctx) {
  return (ctx.ejerciciosPorTipo?.Fuerza || 0) > 0 || ctx.numRegistrosRutina > 0
}

function minutosCardio(ctx) {
  return (ctx.ejercicios || [])
    .filter((e) => e.categoria === 'Cardio')
    .reduce((s, e) => s + num(e.duracion), 0)
}

function diaAnterior(fechaYYYYMMDD) {
  if (!fechaYYYYMMDD) return null
  const [y, m, d] = fechaYYYYMMDD.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function rachaGymSinDescanso(diasDetalle) {
  if (!diasDetalle?.length) return 0
  // días ordenados cronológicamente; mirar desde el más reciente hacia atrás
  const ordenados = [...diasDetalle].sort((a, b) => a.fecha.localeCompare(b.fecha))
  let racha = 0
  for (let i = ordenados.length - 1; i >= 0; i--) {
    if (esDiaFuerza(ordenados[i])) racha += 1
    else break
  }
  return racha
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

function consejosComidaDelDia(obj, ctx, ctxAyer = null) {
  const tips = []
  const { metas } = ctx
  const metaPro = metas.proteina
  const metaCal = metas.calorias
  const metaCarb = metas.carbohidratos

  if (ctx.numComidas === 0) {
    tips.push(
      consejo(
        'dia',
        'habitos',
        100,
        'Todavía no registraste comidas hoy. Anotá al menos el desayuno (o buscá “hamburguesa” / “empanada” si saliste) para no romper la racha.'
      )
    )
    return tips
  }

  // Falta Merienda o Cena de AYER
  if (ctxAyer && ctxAyer.numComidas > 0) {
    const faltaCena = !ctxAyer.momentosRegistrados.includes('Cena')
    const faltaMerienda = !ctxAyer.momentosRegistrados.includes('Merienda')
    if (faltaCena) {
      tips.push(
        consejo(
          'dia',
          'habitos',
          96,
          'No registraste la cena de ayer. Mantener la racha te ayuda a predecir tu progreso semanal: cargala ahora (aunque sea una estimación).'
        )
      )
    } else if (faltaMerienda) {
      tips.push(
        consejo(
          'dia',
          'habitos',
          88,
          'Ayer no registraste la merienda. Si comiste algo a la tarde, anotalo: los huecos distorsionan proteína y calorías del día.'
        )
      )
    }
  }

  const pPro = pct(ctx.proteinas, metaPro)
  const pCal = pct(ctx.caloriasConsumidas, metaCal)
  const pCarb = metaCarb ? pct(ctx.carbohidratos, metaCarb) : null
  const tieneAlmuerzo = ctx.momentosRegistrados.includes('Almuerzo')
  const faltaMeriendaHoy = !ctx.momentosRegistrados.includes('Merienda')
  const faltaCenaHoy = !ctx.momentosRegistrados.includes('Cena')

  // Proteína baja (<70% de la meta) tras el almuerzo
  if (tieneAlmuerzo && pPro != null && pPro < 0.7) {
    const faltan = Math.max(0, metaPro - ctx.proteinas)
    const pctHoy = redondear(pPro * 100)
    const cuando = faltaMeriendaHoy || faltaCenaHoy ? 'en la merienda o cena' : 'en la próxima comida'
    tips.push(
      consejo(
        'dia',
        'nutricion',
        95,
        `Llegás al ${pctHoy}% de tu proteína de hoy. Te faltan ${sugerenciaProteina(faltan)}. Sumalos ${cuando}.`
      )
    )
  }

  // Carbos altos + objetivo bajar
  if (
    obj === 'bajar_peso' &&
    ((pCarb != null && pCarb >= 0.85) ||
      (metaCarb == null && ctx.carbohidratos > 0 && ctx.caloriasConsumidas > 0 && ctx.carbohidratos * 4 > ctx.caloriasConsumidas * 0.55))
  ) {
    tips.push(
      consejo(
        'dia',
        'balance',
        92,
        'Consumiste la mayoría de tus carbos hoy. En la cena priorizá proteínas + vegetales de hoja verde (ensalada, espinaca, brócoli) y evitá pan/arroz extra.'
      )
    )
  }

  // Déficit excesivo (>800 kcal abajo de la meta)
  if (metaCal && ctx.caloriasConsumidas > 0 && metaCal - ctx.caloriasConsumidas > 800 && (faltaCenaHoy || faltaMeriendaHoy || pCal < 0.55)) {
    tips.push(
      consejo(
        'dia',
        'salud',
        97,
        `Llevás muy pocas calorías hoy (${redondear(ctx.caloriasConsumidas)} de ${metaCal}). Comer de menos puede ralentizar tu metabolismo y hacerte perder músculo: sumá una merienda con avena, fruta o yogur.`
      )
    )
  }

  // Falta registrar cena de HOY
  if (faltaCenaHoy && ctx.momentosRegistrados.length >= 2) {
    tips.push(
      consejo(
        'dia',
        'habitos',
        78,
        'Todavía no registraste la cena. Cuando comas, buscá el plato (o “Salida / Social” si salís) para cerrar el día.'
      )
    )
  }

  const desayuno = ctx.comidasPorMomento.Desayuno
  if (desayuno && desayuno.proteinas < metaPro * 0.12 && ctx.proteinas < metaPro * 0.45) {
    tips.push(
      consejo(
        'dia',
        'nutricion',
        80,
        `El desayuno trae poca proteína (${redondear(desayuno.proteinas)} g). Mañana sumá 2 huevos o yogur griego; hoy recuperá ${sugerenciaProteina(metaPro * 0.3 - ctx.proteinas)}.`
      )
    )
  }

  if (metaCal && ctx.caloriasConsumidas > metaCal * 1.12 && obj === 'bajar_peso') {
    const exceso = redondear(ctx.caloriasConsumidas - metaCal)
    tips.push(
      consejo(
        'dia',
        'balance',
        90,
        `Vas ~${exceso} kcal arriba de tu meta. En lo que queda del día priorizá proteína magra + verduras y saltá snacks azucarados.`
      )
    )
  }

  if (
    metaCal &&
    ctx.caloriasConsumidas > 0 &&
    ctx.caloriasConsumidas < metaCal * 0.65 &&
    (obj === 'aumentar_peso' || obj === 'ganar_musculo')
  ) {
    const faltan = redondear(metaCal - ctx.caloriasConsumidas)
    tips.push(
      consejo(
        'dia',
        'balance',
        89,
        `Te faltan ~${faltan} kcal para tu meta. Sumá arroz con pollo, pasta o un snack denso (palta + pan + huevo) en merienda/cena.`
      )
    )
  }

  if (pPro != null && pPro < 0.55 && !tieneAlmuerzo) {
    const faltan = Math.max(0, metaPro - ctx.proteinas)
    tips.push(
      consejo(
        'dia',
        'nutricion',
        84,
        `Llevás ${redondear(ctx.proteinas)} g de proteína (meta ${metaPro} g). Te faltan ${sugerenciaProteina(faltan)}.`
      )
    )
  }

  if (pPro != null && pPro >= 0.9 && (obj === 'ganar_musculo' || obj === 'aumentar_peso')) {
    tips.push(
      consejo(
        'dia',
        'nutricion',
        55,
        `Buen día de proteína (${redondear(ctx.proteinas)} g). Mantené esa línea en la cena para apoyar músculo.`
      )
    )
  }

  return tips
}

function consejosEjercicioDelDia(obj, ctx) {
  const tips = []
  const { metas } = ctx
  const metaPro = metas.proteina
  const metaCarb = metas.carbohidratos
  const hayFuerza = esDiaFuerza(ctx)
  const minCardio = minutosCardio(ctx)
  const hayCardio = minCardio > 0 || (ctx.ejerciciosPorTipo?.Cardio || 0) > 0

  if (!ctx.tieneActividad) {
    if (obj === 'bajar_peso' || obj === 'mantener_peso') {
      tips.push(
        consejo(
          'dia',
          'ejercicio',
          72,
          'Hoy no hay actividad registrada. Sumá una caminata de 20–30 min o una sesión corta: anotala para que el consejo de mañana sea más preciso.'
        )
      )
    } else if (obj === 'ganar_musculo') {
      tips.push(
        consejo(
          'dia',
          'ejercicio',
          75,
          'No registraste entrenamiento hoy. Para ganar músculo, priorizá fuerza o tu rutina de gym y cerrá el día con proteína alta.'
        )
      )
    }
    return tips
  }

  // Día de fuerza + proteína baja → recuperación
  if (hayFuerza && pct(ctx.proteinas, metaPro) != null && pct(ctx.proteinas, metaPro) < 0.75) {
    const objetivoCena = Math.max(25, redondear(metaPro - ctx.proteinas))
    tips.push(
      consejo(
        'dia',
        'recuperacion',
        98,
        `Hoy entrenaste pesado. Asegurá al menos ${objetivoCena} g de proteína antes de dormir (${sugerenciaProteina(objetivoCena)}) para reparar músculo.`
      )
    )
  }

  // Cardio intenso >45 min + carbos bajos → rendimiento
  const carbosBajos =
    (metaCarb && pct(ctx.carbohidratos, metaCarb) < 0.5) ||
    (!metaCarb && ctx.carbohidratos < 100 && ctx.caloriasConsumidas > 0)
  if (minCardio >= 45 && carbosBajos) {
    tips.push(
      consejo(
        'dia',
        'rendimiento',
        94,
        `Quemaste mucha energía en cardio (${minCardio} min). No le temas a un bowl de avena o fruta para recuperar glucógeno (${sugerenciaCarbos(metaCarb ? metaCarb * 0.3 : 40)}).`
      )
    )
  } else if (hayCardio && ctx.carbohidratos < 80 && ctx.caloriasConsumidas > 0 && minCardio < 45) {
    tips.push(
      consejo(
        'dia',
        'rendimiento',
        82,
        'Hiciste cardio y hoy hay pocos carbohidratos. Sumá fruta, arroz o pan integral en la próxima comida.'
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
          86,
          `Consumiste ${redondear(ctx.caloriasConsumidas)} kcal y quemaste ~${redondear(ctx.caloriasQuemadas)}. El excedente es alto: en la cena priorizá proteína + verduras.`
        )
      )
    }
    if ((obj === 'mantener_peso' || obj === 'ganar_musculo') && balance < -250) {
      tips.push(
        consejo(
          'dia',
          'balance',
          85,
          `Quemaste ~${Math.abs(redondear(balance))} kcal más de las que llevás comidas. Recuperá con una merienda densa (avena + proteína o banana + mantequilla de maní).`
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
        'Hoy solo hay cardio. Esta semana sumá al menos 2 días de fuerza o rutina de gym para ganar músculo.'
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

  // 3 días seguidos de gym sin descanso
  const racha = rachaGymSinDescanso(ctx.diasDetalle)
  if (racha >= 3) {
    tips.push(
      consejo(
        'semana',
        'descanso',
        96,
        `¡Gran racha de ${racha} días de fuerza! Los músculos crecen en el descanso. Considerá hoy un día activo: caminata suave 30–40 min y priorizá sueño + proteína.`
      )
    )
  }

  if (ctx.diasConComida === 0) {
    tips.push(
      consejo(
        'semana',
        'habitos',
        95,
        'Esta semana no hay comidas registradas. Anotá aunque sea desayuno y cena (o platos de “Salida / Social”) para no perder la racha.'
      )
    )
    return tips
  }

  if (ctx.diasConComida < Math.ceil(numDias * 0.4)) {
    tips.push(
      consejo(
        'semana',
        'habitos',
        92,
        `Solo registraste comidas ${ctx.diasConComida} de ${numDias} días. Apuntá a marcar al menos una comida por día: la app aprende tu patrón y los consejos mejoran.`
      )
    )
  }

  const cenas = ctx.momentosConteo.Cena || 0
  const meriendas = ctx.momentosConteo.Merienda || 0
  if (cenas <= 2 && ctx.diasConComida >= 4) {
    tips.push(
      consejo(
        'semana',
        'habitos',
        90,
        `Registraste cena solo ${cenas} días esta semana. Cerrar el día con el registro (aunque sea estimado) mejora el promedio de proteína y calorías.`
      )
    )
  }

  if (meriendas <= 1 && ctx.diasConComida >= 3) {
    tips.push(
      consejo(
        'semana',
        'nutricion',
        78,
        'Casi no hay meriendas esta semana. Si picás a la tarde, anotalo: yogur, fruta o un snack de salida evita quedarte corto en proteína.'
      )
    )
  }

  if (ctx.promedioProteinas > 0 && ctx.promedioProteinas < metaPro * 0.75) {
    const faltan = metaPro - ctx.promedioProteinas
    tips.push(
      consejo(
        'semana',
        'nutricion',
        88,
        `Tu promedio de proteína es ${ctx.promedioProteinas} g/día (meta ${metaPro} g). Cada día sumá ${sugerenciaProteina(faltan)} en almuerzo o cena.`
      )
    )
  }

  if (metaCal && ctx.promedioCalorias > metaCal * 1.1 && obj === 'bajar_peso') {
    tips.push(
      consejo(
        'semana',
        'balance',
        87,
        `Promediás ${ctx.promedioCalorias} kcal (meta ${metaCal}). Esta semana: porciones un poco menores en cena y 2–3 caminatas de 30 min.`
      )
    )
  }

  if (metaCal && ctx.promedioCalorias > 0 && ctx.promedioCalorias < metaCal * 0.75 && (obj === 'aumentar_peso' || obj === 'ganar_musculo')) {
    tips.push(
      consejo(
        'semana',
        'balance',
        86,
        `Promediás ${ctx.promedioCalorias} kcal; tu meta es ${metaCal}. Sumá meriendas densas (avena, pan + palta, batido) todos los días.`
      )
    )
  }

  if (ctx.diasConActividad < 3 && (obj === 'mantener_peso' || obj === 'bajar_peso' || obj === 'ganar_musculo')) {
    tips.push(
      consejo(
        'semana',
        'ejercicio',
        84,
        `Actividad ${ctx.diasConActividad} de ${numDias} días. Esta semana apuntá a 3 sesiones (aunque sean caminatas) y registralas al terminar.`
      )
    )
  }

  const soloCardio = (ctx.tiposEjercicio.Cardio || 0) > 0 && !(ctx.tiposEjercicio.Fuerza || 0)
  if (obj === 'ganar_musculo' && soloCardio && ctx.diasConActividad >= 2) {
    tips.push(
      consejo(
        'semana',
        'ejercicio',
        83,
        'Esta semana predominó el cardio. Incluí fuerza o rutina de gimnasio al menos 2 veces y cerrá esos días con +30 g de proteína.'
      )
    )
  }

  if (ctx.diasConComida >= 5 && ctx.diasConActividad >= 3 && racha < 3) {
    tips.push(
      consejo(
        'semana',
        'habitos',
        55,
        `Buen ritmo: ${ctx.diasConComida} días con comidas y ${ctx.diasConActividad} con actividad. Seguí así: la constancia predice mejor tu progreso.`
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
 * @param {object} [contextoSemana] para tips de ayer / racha (opcional)
 */
export function getConsejosDelDia(objetivo, contexto, config = {}, progresoMedidas = null, contextoSemana = null) {
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
          'Hoy llevás más calorías que las quemadas. En la próxima comida priorizá proteína + verduras y evitá snacks extra.'
        )
      )
    }
    if ((obj === 'ganar_musculo' || obj === 'aumentar_peso') && pro < metaPro && cal > 0) {
      const faltan = metaPro - pro
      tips.push(
        consejo(
          'dia',
          'nutricion',
          80,
          `Te faltan ${sugerenciaProteina(faltan)}. Sumalos en la cena.`
        )
      )
    }
    return uniqTextos(tips, 1)
  }

  const fechaAyer = diaAnterior(ctx.fecha)
  let ctxAyer = null
  if (fechaAyer && contextoSemana?.diasDetalle) {
    ctxAyer = contextoSemana.diasDetalle.find((d) => d.fecha === fechaAyer) || null
  }

  const tips = [
    ...consejosComidaDelDia(obj, ctx, ctxAyer),
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
        'Hace más de 2 semanas de tu última medición. Hoy o mañana actualizá cintura y brazos (mismos puntos y hora).'
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
        'Con tu peso ya cargado, sumá la altura en Config para calcular el IMC y sugerir kcal.'
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
    diarios: getConsejosDelDia(objetivo, contextoDia, config, progresoMedidas, contextoSemana),
    semanales: getConsejosSemanales(objetivo, contextoSemana, config, progresoMedidas),
  }
}
