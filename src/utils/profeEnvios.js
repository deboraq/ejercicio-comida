import { fechaSoloDia } from './calorias'

/** Estado visual de un envío cloud según datos del alumno en user_data. */
export function estadoEnvioCloud(row, userData = {}) {
  const asignadas = Array.isArray(userData.rutinasAsignadas) ? userData.rutinasAsignadas : []
  const rutinaPesos = Array.isArray(userData.rutinaPesos) ? userData.rutinaPesos : []
  const createdDay = (row.created_at || '').slice(0, 10)
  const totalDias = Math.max(1, Array.isArray(row.payload?.dias) ? row.payload.dias.length : 1)

  const vinculada = asignadas.some((a) => a?._asignacion?.assignmentId === row.id)
  const regsDesdeEnvio = createdDay
    ? rutinaPesos.filter((r) => {
        const f = fechaSoloDia(r.fecha)
        return f && f >= createdDay
      })
    : rutinaPesos
  const cargasDesdeEnvio = regsDesdeEnvio.length > 0

  const diasHechos = new Set(regsDesdeEnvio.map((r) => r.diaRutinaId).filter(Boolean)).size
  const diasPorFecha = new Set(regsDesdeEnvio.map((r) => fechaSoloDia(r.fecha)).filter(Boolean)).size
  const sesiones = Math.max(diasHechos, diasPorFecha)

  if (sesiones >= totalDias) {
    return { id: 'completado', label: `Completada (${Math.min(100, Math.round((sesiones / totalDias) * 100))}%)`, tone: 'green' }
  }
  if (cargasDesdeEnvio) {
    const pct = Math.min(100, Math.round((sesiones / totalDias) * 100))
    return { id: 'progreso', label: `En progreso (${sesiones}/${totalDias} días)`, tone: 'blue', pct, sesiones, totalDias }
  }
  if (vinculada) {
    return { id: 'visto', label: 'Visto en app', tone: 'green', pct: Math.max(5, Math.round(100 / totalDias)) }
  }
  return { id: 'pendiente', label: 'Pendiente de apertura', tone: 'orange', pct: 0 }
}

/** Barra de progreso y etiqueta para la tarjeta del historial. */
export function progresoEnvioCloud(row, userData = {}) {
  const st = estadoEnvioCloud(row, userData)
  const pct = st.pct ?? (st.id === 'completado' ? 100 : st.id === 'pendiente' ? 0 : 15)
  let barLabel = 'Sin iniciar (0%)'
  let barTone = 'muted'

  if (st.id === 'completado') {
    barLabel = `${pct}% completado`
    barTone = 'green'
  } else if (st.id === 'progreso') {
    barLabel = `${st.sesiones ?? 0} de ${st.totalDias ?? 1} sesiones (${pct}%)`
    barTone = 'blue'
  } else if (st.id === 'visto') {
    barLabel = `Apertura en app (${pct}%)`
    barTone = 'green'
  } else {
    barLabel = 'Sin iniciar (0%)'
    barTone = 'orange'
  }

  return { pct, barLabel, barTone, estado: st }
}

export const FILTRO_ENVIO = {
  todos: 'todos',
  activo: 'activo',
  visto: 'visto',
  pendiente: 'pendiente',
  completado: 'completado',
}

export function filtrarEnvios(rows, filtro, userDataMap = {}) {
  if (filtro === FILTRO_ENVIO.todos) return rows
  return rows.filter((r) => {
    const st = estadoEnvioCloud(r, userDataMap[r.student_id] || {})
    if (filtro === FILTRO_ENVIO.activo) return st.id === 'progreso'
    if (filtro === FILTRO_ENVIO.visto) return st.id === 'visto'
    if (filtro === FILTRO_ENVIO.pendiente) return st.id === 'pendiente'
    if (filtro === FILTRO_ENVIO.completado) return st.id === 'completado'
    return true
  })
}

export function contarEnvios(rows, userDataMap = {}) {
  const total = rows.length
  let activo = 0
  let visto = 0
  let pendiente = 0
  let completado = 0
  for (const r of rows) {
    const st = estadoEnvioCloud(r, userDataMap[r.student_id] || {}).id
    if (st === 'progreso') activo += 1
    else if (st === 'visto') visto += 1
    else if (st === 'pendiente') pendiente += 1
    else if (st === 'completado') completado += 1
  }
  return { total, activo, visto, pendiente, completado }
}

export function metricasEnvios(rows, userDataMap = {}) {
  const conteos = contarEnvios(rows, userDataMap)
  const abiertos = conteos.total - conteos.pendiente
  const tasaApertura = conteos.total ? Math.round((abiertos / conteos.total) * 100) : 0
  const hace30 = Date.now() - 30 * 86400000
  const enviosMes = rows.filter((r) => new Date(r.created_at || 0).getTime() >= hace30).length
  const hace7 = Date.now() - 7 * 86400000
  const enviosSemana = rows.filter((r) => new Date(r.created_at || 0).getTime() >= hace7).length
  return {
    tasaApertura,
    enviosTotales: conteos.total,
    enviosMes,
    enviosSemana,
    conteos,
  }
}

/** Filtra envíos por ventana de días (desde hoy hacia atrás). */
export function filtrarEnviosPorDias(rows, dias = 30) {
  if (!dias || dias <= 0) return rows
  const desde = Date.now() - dias * 86400000
  return rows.filter((r) => new Date(r.created_at || 0).getTime() >= desde)
}
