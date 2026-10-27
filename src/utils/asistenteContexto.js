import { fechaSoloDia, fechaToISO, caloriasEjercicioRegistro } from './calorias'
import { buscarAlimentos } from './referenciaComidas'
import { getUltimosNDias } from './estadisticas'

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
  const lineas = delDia.slice(0, 40).map((r) => ({
    momento: r.comida,
    descripcion: r.descripcion,
    kcal: Math.round(num(r.calorias)),
    hora: r.hora || '',
  }))
  return { fecha, totales: tot, comidas: lineas, count: delDia.length }
}

/**
 * JSON compacto para el asistente (metas + comida + ejercicio reciente).
 * @param {{
 *   config?: object,
 *   comida?: object[],
 *   ejercicios?: object[],
 *   pregunta?: string,
 *   fechaRef?: string,
 * }} params
 */
export function buildAsistenteContexto({ config = {}, comida = [], ejercicios = [], pregunta = '', fechaRef }) {
  const hoy = fechaSoloDia(fechaRef) || fechaToISO(new Date())
  const dias = getUltimosNDias(7)

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

  const ejerciciosSemana = (ejercicios || []).filter((e) => {
    const f = fechaSoloDia(e.fecha)
    return dias.includes(f)
  })
  const pesoKg = num(config.pesoKg) || 70
  let kcalEjercicioSemana = 0
  const ejerciciosRecientes = ejerciciosSemana.slice(0, 25).map((e) => {
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
  if (pregunta.trim()) {
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

  return {
    app: 'Mi rutina',
    fecha_hoy: hoy,
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
    ejercicio_ultimos_7_dias: {
      kcal_estimadas_total: Math.round(kcalEjercicioSemana),
      registros: ejerciciosRecientes,
    },
    catalogo_local_coincidencias: catalogoHits,
    nota_catalogo:
      'Si catalogo_local_coincidencias tiene ítems, priorizá esos datos sobre estimaciones genéricas.',
  }
}
