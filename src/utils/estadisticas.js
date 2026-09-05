import { fechaToISO, fechaSoloDia } from './calorias.js'

export { fechaToISO }

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

function diaAnteriorISO(fechaYYYYMMDD) {
  const d = new Date(`${fechaYYYYMMDD}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return fechaToISO(d)
}

/**
 * Días seguidos con al menos un registro.
 * Si hoy todavía no hay datos pero ayer sí, la racha sigue viva hasta las 00:00
 * (no se pierde durante el día en curso).
 */
export function getRachaDias(registros, fechaHoy) {
  const hoy = fechaHoy || fechaToISO(new Date())
  const set = new Set(
    (registros || [])
      .map((r) => fechaSoloDia(r?.fecha ?? r))
      .filter(Boolean)
  )
  if (set.size === 0) return 0

  const ayer = diaAnteriorISO(hoy)
  // Gracia del día: sin registro hoy todavía → contar desde ayer
  let esperada = set.has(hoy) ? hoy : set.has(ayer) ? ayer : null
  if (!esperada) return 0

  let racha = 0
  while (set.has(esperada)) {
    racha++
    esperada = diaAnteriorISO(esperada)
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
    case 'personalizado': {
      let fin = hastaCustom || hasta
      let inicio = desdeCustom
      if (!inicio) {
        const d = new Date(fin + 'T12:00:00')
        d.setDate(d.getDate() - 30)
        inicio = fechaToISO(d)
      }
      if (inicio > fin) {
        const tmp = inicio
        inicio = fin
        fin = tmp
      }
      return { desde: inicio, hasta: fin }
    }
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
