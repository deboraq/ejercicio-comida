/** Recorta el JSON enviado a Gemini (menos tokens = respuesta más rápida). */
export function compactarContextoParaGemini(ctx) {
  if (!ctx || typeof ctx !== 'object') return ctx
  const c = JSON.parse(JSON.stringify(ctx))

  const trimPorDia = (bloque, max = 10) => {
    if (!bloque?.por_dia || !Array.isArray(bloque.por_dia)) return
    if (bloque.por_dia.length > max) {
      bloque.por_dia = bloque.por_dia.slice(-max)
      bloque.por_dia_truncado = true
    }
  }

  trimPorDia(c.mes_en_curso?.comida, 10)
  trimPorDia(c.mes_en_curso?.ejercicio, 8)

  if (c.ultimos_30_dias?.comida) {
    const t = c.ultimos_30_dias.comida
    c.ultimos_30_dias.comida = {
      desde: t.desde,
      hasta: t.hasta,
      totales: t.totales,
      dias_con_registro: t.dias_con_registro,
      promedio_kcal_dia_con_datos: t.promedio_kcal_dia_con_datos,
    }
  }
  if (c.ultimos_30_dias?.ejercicio) {
    const t = c.ultimos_30_dias.ejercicio
    c.ultimos_30_dias.ejercicio = {
      desde: t.desde,
      hasta: t.hasta,
      sesiones: t.sesiones,
      kcal_estimadas_total: t.kcal_estimadas_total,
      dias_con_actividad: t.dias_con_actividad,
    }
  }

  if (Array.isArray(c.comida_hoy?.detalle) && c.comida_hoy.detalle.length > 14) {
    c.comida_hoy.detalle = c.comida_hoy.detalle.slice(0, 14)
    c.comida_hoy.detalle_truncado = true
  }

  if (Array.isArray(c.ejercicio_ultimos_7_dias?.registros)) {
    c.ejercicio_ultimos_7_dias.registros = c.ejercicio_ultimos_7_dias.registros.slice(0, 6)
  }

  delete c.nota_analisis
  delete c.nota_catalogo
  delete c.nota_rutina_gym

  return c
}
