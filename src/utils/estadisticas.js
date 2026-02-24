/**
 * Helpers para estadísticas: últimos N días, resumen semanal, etc.
 */

export function fechaToISO(d) {
  return d.toISOString().slice(0, 10)
}

export function getUltimosNDias(n = 7) {
  const hoy = new Date()
  const dias = []
  for (let i = 0; i < n; i++) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - i)
    dias.push(fechaToISO(d))
  }
  return dias.reverse()
}

export function getResumenPorDias(registros, getDatoPorFecha, ultimosDias) {
  const dias = ultimosDias || getUltimosNDias(7)
  return dias.map((fecha) => ({ fecha, valor: getDatoPorFecha(fecha) }))
}

export function getRachaDias(registros, fechaHoy) {
  const hoy = fechaHoy || fechaToISO(new Date())
  const fechasConDatos = [...new Set(registros.map((r) => r.fecha))].sort().reverse()
  if (fechasConDatos[0] !== hoy) return 0
  let racha = 0
  let esperada = hoy
  for (const f of fechasConDatos) {
    if (f === esperada) {
      racha++
      const d = new Date(esperada + 'T12:00:00')
      d.setDate(d.getDate() - 1)
      esperada = fechaToISO(d)
    } else break
  }
  return racha
}

/** Períodos para filtrar por tiempo */
export const PERIODOS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Última semana' },
  { value: '15_dias', label: 'Últimos 15 días' },
  { value: 'mes', label: 'Último mes' },
  { value: 'personalizado', label: 'Personalizado' },
]

/** Devuelve { desde, hasta } en ISO para el período. Para personalizado usar desde/hasta pasados. */
export function getRangoPorPeriodo(periodo, desdeCustom, hastaCustom) {
  const hoy = new Date()
  const hasta = fechaToISO(hoy)
  let desde
  switch (periodo) {
    case 'hoy':
      desde = hasta
      break
    case 'semana': {
      const d = new Date(hoy)
      d.setDate(d.getDate() - 6)
      desde = fechaToISO(d)
      break
    }
    case '15_dias': {
      const d = new Date(hoy)
      d.setDate(d.getDate() - 14)
      desde = fechaToISO(d)
      break
    }
    case 'mes': {
      const d = new Date(hoy)
      d.setMonth(d.getMonth() - 1)
      desde = fechaToISO(d)
      break
    }
    case 'personalizado':
      desde = desdeCustom || hasta
      return { desde, hasta: hastaCustom || hasta }
    default:
      desde = hasta
  }
  return { desde, hasta }
}

/** Filtra registros por rango de fechas (inclusive) */
export function filtrarPorRango(registros, desde, hasta) {
  return registros.filter((r) => r.fecha >= desde && r.fecha <= hasta)
}

/** Lista de fechas entre desde y hasta (inclusive) */
export function getFechasEnRango(desde, hasta) {
  const list = []
  const d = new Date(desde + 'T12:00:00')
  const end = new Date(hasta + 'T12:00:00')
  while (d <= end) {
    list.push(fechaToISO(d))
    d.setDate(d.getDate() + 1)
  }
  return list
}
