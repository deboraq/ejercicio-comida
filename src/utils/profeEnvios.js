import { fechaSoloDia } from './calorias'

/** Estado visual de un envío cloud según datos del alumno en user_data. */
export function estadoEnvioCloud(row, userData = {}) {
  const asignadas = Array.isArray(userData.rutinasAsignadas) ? userData.rutinasAsignadas : []
  const rutinaPesos = Array.isArray(userData.rutinaPesos) ? userData.rutinaPesos : []
  const createdDay = (row.created_at || '').slice(0, 10)

  const vinculada = asignadas.some((a) => a?._asignacion?.assignmentId === row.id)
  const cargasDesdeEnvio = createdDay
    ? rutinaPesos.some((r) => {
        const f = fechaSoloDia(r.fecha)
        return f && f >= createdDay
      })
    : rutinaPesos.length > 0

  if (cargasDesdeEnvio) {
    return { id: 'progreso', label: 'En progreso', tone: 'blue' }
  }
  if (vinculada) {
    return { id: 'visto', label: 'Visto en app', tone: 'green' }
  }
  return { id: 'pendiente', label: 'Pendiente de sincronizar', tone: 'muted' }
}

export const FILTRO_ENVIO = {
  todos: 'todos',
  activo: 'activo',
  visto: 'visto',
  pendiente: 'pendiente',
}

export function filtrarEnvios(rows, filtro, userDataMap = {}) {
  if (filtro === FILTRO_ENVIO.todos) return rows
  return rows.filter((r) => {
    const st = estadoEnvioCloud(r, userDataMap[r.student_id] || {})
    if (filtro === FILTRO_ENVIO.activo) return st.id === 'progreso'
    if (filtro === FILTRO_ENVIO.visto) return st.id === 'visto'
    if (filtro === FILTRO_ENVIO.pendiente) return st.id === 'pendiente'
    return true
  })
}
