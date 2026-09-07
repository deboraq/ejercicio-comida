import { fechaSoloDia, fechaToISO } from './calorias'
import { getUltimosNDias } from './estadisticas'

export const FILTRO_ALUMNO = {
  todos: 'todos',
  activos: 'activos',
  revisar: 'revisar',
  pausa: 'pausa',
}

const META_DIAS_SEMANA = 4

export function inicialesAlumno(fullName, email) {
  const src = (fullName || email || '?').trim()
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

export function colorAvatar(seed = '') {
  const colors = ['#8b5cf6', '#f97316', '#10b981', '#3b82f6', '#ec4899', '#64748b']
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h + seed.charCodeAt(i) * 17) % colors.length
  return colors[h]
}

/** Clase CSS de tono para avatar con degradado (0–5). */
export function avatarToneClass(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h + seed.charCodeAt(i) * 17) % 6
  return `pf-avatar-tone-${h}`
}

function ultimoRegistroRutina(regs) {
  if (!regs?.length) return null
  return [...regs].sort((a, b) => {
    const fa = fechaSoloDia(a.fecha)
    const fb = fechaSoloDia(b.fecha)
    if (fa !== fb) return fb.localeCompare(fa)
    return String(b.id || '').localeCompare(String(a.id || ''))
  })[0]
}

function diasDesde(fechaIso, hoy) {
  if (!fechaIso) return 999
  const d1 = new Date(`${fechaIso}T12:00:00`)
  const d2 = new Date(`${hoy}T12:00:00`)
  return Math.max(0, Math.round((d2 - d1) / 86400000))
}

function formatearActividadRutina(r, hoy) {
  const f = fechaSoloDia(r.fecha)
  const pref = f === hoy ? 'Hoy: ' : 'Último: '
  const ej = r.ejercicio || r.nombre || 'Ejercicio'
  const peso = r.pesoKg ?? r.peso
  const reps = r.repeticiones ?? r.reps
  if (peso != null && reps != null) return `${pref}${ej} (${peso}kg x ${reps} reps)`
  if (peso != null) return `${pref}${ej} (${peso}kg)`
  if (r.series && reps) return `${pref}${ej} (${r.series}x${reps})`
  return `${pref}${ej}`
}

export function buildAlumnoSnapshot(student, userData = {}, assignment = null, hoy = fechaToISO(new Date())) {
  const rutinaPesos = Array.isArray(userData.rutinaPesos) ? userData.rutinaPesos : []
  const comida = Array.isArray(userData.comida) ? userData.comida : []
  const ejercicios = Array.isArray(userData.ejercicios) ? userData.ejercicios : []

  const dias7 = getUltimosNDias(7)
  const diasConActividad = dias7.filter(
    (f) =>
      rutinaPesos.some((r) => fechaSoloDia(r.fecha) === f) ||
      ejercicios.some((r) => fechaSoloDia(r.fecha) === f),
  )
  const diasActivos7 = diasConActividad.length
  const pct = Math.min(100, Math.round((diasActivos7 / META_DIAS_SEMANA) * 100))

  const activoHoy =
    rutinaPesos.some((r) => fechaSoloDia(r.fecha) === hoy) ||
    comida.some((r) => fechaSoloDia(r.fecha) === hoy) ||
    ejercicios.some((r) => fechaSoloDia(r.fecha) === hoy)

  const fechasActividad = [
    ...rutinaPesos.map((r) => fechaSoloDia(r.fecha)),
    ...ejercicios.map((r) => fechaSoloDia(r.fecha)),
    ...comida.map((r) => fechaSoloDia(r.fecha)),
  ].filter(Boolean)
  const ultimaFecha = fechasActividad.sort().reverse()[0] || null
  const diasInactivo = diasDesde(ultimaFecha, hoy)

  const ultimoRutina = ultimoRegistroRutina(rutinaPesos)
  const ultimoEjercicio = ejercicios.length
    ? [...ejercicios].sort((a, b) => fechaSoloDia(b.fecha).localeCompare(fechaSoloDia(a.fecha)))[0]
    : null

  let ultimaActividad = 'Sin actividad registrada'
  if (ultimoRutina) ultimaActividad = formatearActividadRutina(ultimoRutina, hoy)
  else if (ultimoEjercicio) {
    const f = fechaSoloDia(ultimoEjercicio.fecha)
    const pref = f === hoy ? 'Hoy: ' : 'Último: '
    ultimaActividad = `${pref}${ultimoEjercicio.nombre || 'Ejercicio'} (${ultimoEjercicio.duracion || '?'} min)`
  } else if (comida.some((r) => fechaSoloDia(r.fecha) === hoy)) {
    ultimaActividad = 'Hoy: registró comidas en la app'
  }

  let estado = 'al_dia'
  let estadoLabel = 'Al día'
  let estadoTone = 'blue'
  if (activoHoy) {
    estado = 'activo_hoy'
    estadoLabel = 'Activa hoy'
    estadoTone = 'green'
  } else if (diasInactivo > 5) {
    estado = 'pausa'
    estadoLabel = 'Inactivo > 5 días'
    estadoTone = 'muted'
  } else if (assignment && diasActivos7 < 2) {
    estado = 'revisar'
    estadoLabel = 'Pendiente revisión'
    estadoTone = 'orange'
  }

  const rutinaActiva = assignment?.title?.trim() || 'Sin rutina asignada'

  return {
    ...student,
    snapshot: {
      activoHoy,
      estado,
      estadoLabel,
      estadoTone,
      rutinaActiva,
      diasActivos7,
      metaDias: META_DIAS_SEMANA,
      pctCumplimiento: pct,
      cumplimientoLabel: `${Math.min(diasActivos7, META_DIAS_SEMANA)}/${META_DIAS_SEMANA} días (${pct}%)`,
      ultimaActividad,
      diasInactivo,
      pendienteRevision: estado === 'revisar',
      enPausa: estado === 'pausa',
    },
  }
}

export function buildFeedActividad(alumnosConSnapshot, userDataMap = {}, hoy = fechaToISO(new Date())) {
  const items = []
  for (const alumno of alumnosConSnapshot) {
    const ud = userDataMap[alumno.studentId] || {}
    const nombre = (alumno.fullName || alumno.email || 'Alumno').split(' ')[0]
    const rutinaPesos = Array.isArray(ud.rutinaPesos) ? ud.rutinaPesos : []
    const comida = Array.isArray(ud.comida) ? ud.comida : []
    const ejercicios = Array.isArray(ud.ejercicios) ? ud.ejercicios : []
    const initials = inicialesAlumno(alumno.fullName, alumno.email)
    const avatarColor = colorAvatar(alumno.email || alumno.studentId)

    const ultR = ultimoRegistroRutina(rutinaPesos.filter((r) => fechaSoloDia(r.fecha) === hoy))
    if (ultR) {
      const ejLabel = ultR.ejercicio || ultR.nombre || 'ejercicio'
      items.push({
        id: `r_${alumno.studentId}_${ultR.id}`,
        initials,
        avatarColor,
        segments: [
          { text: nombre, bold: true },
          { text: ' completó ' },
          { text: ejLabel, bold: true, tone: 'blue' },
          { text: '.' },
        ],
        subtext: ultR.pesoKg != null ? `Hace 14 min • ${ultR.pesoKg} kg registrados` : 'Hace 14 min • actividad en Rutina',
        subtextTone: 'muted',
      })
    }

    const comidasHoy = comida.filter((r) => fechaSoloDia(r.fecha) === hoy)
    if (comidasHoy.length) {
      const kcal = Math.round(comidasHoy.reduce((s, r) => s + (Number(r.calorias) || 0), 0))
      const prot = Math.round(comidasHoy.reduce((s, r) => s + (Number(r.proteinas) || 0), 0))
      items.push({
        id: `c_${alumno.studentId}_${comidasHoy.length}`,
        initials,
        avatarColor,
        segments: [
          { text: nombre, bold: true },
          { text: ' registró almuerzo: ' },
          { text: `${kcal} kcal (${prot}g Proteína)`, bold: true, tone: 'green' },
          { text: '.' },
        ],
        subtext: 'Hace 1 hora • Pestaña Comida',
        subtextTone: 'muted',
      })
    }

    if (alumno.snapshot?.pendienteRevision) {
      items.push({
        id: `rev_${alumno.studentId}`,
        initials,
        avatarColor,
        segments: [
          { text: nombre, bold: true },
          { text: ' requiere revisión de cargas en la rutina asignada.' },
        ],
        subtext: 'Requiere atención del profe',
        subtextTone: 'warn',
      })
    }

    const ejHoy = ejercicios.filter((r) => fechaSoloDia(r.fecha) === hoy)
    if (ejHoy.length && !ultR) {
      const kcal = Math.round(
        ejHoy.reduce((s, e) => s + (Number(e.calorias) || Number(e.duracion) * 8 || 0), 0),
      )
      items.push({
        id: `e_${alumno.studentId}_${ejHoy.length}`,
        initials,
        avatarColor,
        segments: [
          { text: nombre, bold: true },
          { text: ' registró ' },
          { text: `${ejHoy.length} ejercicio${ejHoy.length !== 1 ? 's' : ''}`, bold: true, tone: 'blue' },
          { text: ' hoy.' },
        ],
        subtext: kcal > 0 ? `Hace 14 min • ${kcal} kcal quemadas` : 'Hace 14 min • Pestaña Ejercicios',
        subtextTone: 'muted',
      })
    }
  }
  return items.slice(0, 12)
}

export function filtrarAlumnos(alumnosConSnapshot, busqueda = '', filtro = FILTRO_ALUMNO.todos) {
  let list = alumnosConSnapshot
  const q = busqueda.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (s) =>
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q),
    )
  }
  if (filtro === FILTRO_ALUMNO.activos) list = list.filter((s) => s.snapshot?.activoHoy)
  if (filtro === FILTRO_ALUMNO.revisar) list = list.filter((s) => s.snapshot?.pendienteRevision)
  if (filtro === FILTRO_ALUMNO.pausa) list = list.filter((s) => s.snapshot?.enPausa)
  return list
}

export function contarPorFiltro(alumnosConSnapshot) {
  const total = alumnosConSnapshot.length
  const activos = alumnosConSnapshot.filter((s) => s.snapshot?.activoHoy).length
  const revisar = alumnosConSnapshot.filter((s) => s.snapshot?.pendienteRevision).length
  const pausa = alumnosConSnapshot.filter((s) => s.snapshot?.enPausa).length
  return { total, activos, revisar, pausa }
}
