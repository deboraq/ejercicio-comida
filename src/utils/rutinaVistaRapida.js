import { fechaSoloDia, fechaToISO, formatearFecha } from './calorias'
import {
  agruparPlanEnBloques,
  itemEjercicioDiaNormalizado,
  nombresEjercicioCoinciden,
  parseNumSeriesPlan,
  seriesEfectivasDeItem,
} from './rutinaEjercicioDia'

export { agruparPlanEnBloques }
import { asArray } from '../hooks/useLocalStorage'
import { nuevoIdRegistro } from './ids'

export function etiquetaCortaDiaRutina(nombre) {
  if (!nombre) return 'Día'
  const antesDosPuntos = nombre.split(':')[0]?.trim()
  if (antesDosPuntos && antesDosPuntos.length <= 28) return antesDosPuntos
  if (nombre.length <= 28) return nombre
  return `${nombre.slice(0, 26)}…`
}

export function etiquetaFechaPlan(fechaRef) {
  const d = new Date(`${fechaRef}T12:00:00`)
  const hoyISO = fechaToISO(new Date())
  const base = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })
  const cap = base.charAt(0).toUpperCase() + base.slice(1)
  return fechaRef === hoyISO ? `${cap} · hoy` : cap
}

function indiceDiaRutinaParaFecha(dias, fechaRef, registrosRutinaRaw) {
  const registros = asArray(registrosRutinaRaw).filter((r) => fechaSoloDia(r.fecha) === fechaRef)
  let diaId = registros.find((r) => r.diaRutinaId)?.diaRutinaId
  if (!diaId || !dias.some((d) => d.id === diaId)) {
    const dow = new Date(`${fechaRef}T12:00:00`).getDay()
    return dow === 0 ? dias.length - 1 : Math.min(dow - 1, dias.length - 1)
  }
  const idx = dias.findIndex((d) => d.id === diaId)
  return idx >= 0 ? idx : 0
}

export function buildRutinaView(fechaRef, diaIndice, rutinasRaw, rutinaActivaId, registrosRutinaRaw) {
  const rutinas = asArray(rutinasRaw)
  if (!rutinas.length) return { tipo: 'sin-rutina' }
  const rutina = rutinas.find((r) => r.id === rutinaActivaId) || rutinas[0]
  const dias = rutina?.dias || []
  if (!dias.length) return { tipo: 'sin-dias', nombre: rutina?.nombre }

  const idx =
    diaIndice != null && diaIndice >= 0 && diaIndice < dias.length
      ? diaIndice
      : indiceDiaRutinaParaFecha(dias, fechaRef, registrosRutinaRaw)
  const dia = dias[idx]
  const ejercicios = (dia.ejercicios || []).map(itemEjercicioDiaNormalizado).filter(Boolean)
  const hechos = ejercicios.filter((ex) => ejercicioMarcadoEnFecha(ex, registrosRutinaRaw, fechaRef)).length

  return {
    tipo: 'ok',
    rutinaNombre: rutina.nombre,
    dia,
    diaIndice: idx,
    totalDias: dias.length,
    ejercicios,
    hechos,
    total: ejercicios.length,
    diaId: dia.id,
    rutinaId: rutina.id,
  }
}

export function registrosEjercicioEnFecha(registrosRaw, fechaRef, nombreEj) {
  return asArray(registrosRaw).filter(
    (r) =>
      fechaSoloDia(r.fecha) === fechaRef && nombresEjercicioCoinciden(r.ejercicio, nombreEj),
  )
}

export function parsePesoKgInicio(pesoKg) {
  if (pesoKg === '' || pesoKg == null) return undefined
  const n = Number(String(pesoKg).replace(',', '.').trim())
  return Number.isFinite(n) ? n : undefined
}

export function pesoKgDeRegistro(r) {
  if (r.pesoKg != null && r.pesoKg !== '') {
    const n = Number(String(r.pesoKg).replace(',', '.').trim())
    return Number.isFinite(n) ? n : null
  }
  if (r.peso != null && r.peso !== '') {
    const n = Number(String(r.peso).replace(',', '.').trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function ultimoRegistroConPeso(registrosRaw, nombreEj) {
  return (
    asArray(registrosRaw)
      .filter((r) => nombresEjercicioCoinciden(r.ejercicio, nombreEj))
      .filter((r) => pesoKgDeRegistro(r) != null)
      .sort((a, b) => {
        const cmp = fechaSoloDia(b.fecha).localeCompare(fechaSoloDia(a.fecha))
        if (cmp !== 0) return cmp
        return String(b.id || '').localeCompare(String(a.id || ''))
      })[0] || null
  )
}

export function textoUltimoPesoEjercicio(reg) {
  if (!reg) return null
  const kg = pesoKgDeRegistro(reg)
  if (kg == null) return null
  const reps = String(reg.repeticiones || '').trim()
  const fecha = formatearFecha(fechaSoloDia(reg.fecha))
  const partes = [`${kg} kg`]
  if (reps) partes.push(`${reps} reps`)
  partes.push(fecha)
  return partes.join(' · ')
}

export function planEjercicioTexto(ex) {
  const partes = [ex.series && `${ex.series} series`, ex.repeticiones && `${ex.repeticiones} reps`].filter(
    Boolean,
  )
  if (ex.superserie?.trim()) {
    const vueltas = parseNumSeriesPlan(ex.series, 3)
    partes.push(`SS ${ex.superserie} · ${vueltas} vueltas`)
  }
  return partes.join(' · ')
}

/** True si el ejercicio está marcado hoy (superserie = todas las vueltas con serieNum). */
export function ejercicioMarcadoEnFecha(ex, registrosRaw, fechaRef) {
  const regs = registrosEjercicioEnFecha(registrosRaw, fechaRef, ex.nombre)
  if (!ex.superserie?.trim()) return regs.length > 0
  const vueltas = parseNumSeriesPlan(ex.series, 3)
  if (!regs.length) return false
  for (let r = 1; r <= vueltas; r += 1) {
    if (!regs.some((reg) => Number(reg.serieNum) === r)) return false
  }
  return true
}

/** Progreso de vueltas en superserie (para resumen parcial). */
export function progresoVueltasSuperserie(ex, registrosRaw, fechaRef) {
  if (!ex.superserie?.trim()) return null
  const vueltas = parseNumSeriesPlan(ex.series, 3)
  const regs = registrosEjercicioEnFecha(registrosRaw, fechaRef, ex.nombre)
  let hechas = 0
  for (let r = 1; r <= vueltas; r += 1) {
    if (regs.some((reg) => Number(reg.serieNum) === r)) hechas += 1
  }
  return { hechas, total: vueltas }
}

export function crearRegistrosMarcadoEjercicio(ex, opts) {
  const { fecha, rutinaId, diaRutinaId, idConservar, pesoKg, repeticiones, notas } = opts
  const fechaIso = fechaSoloDia(fecha)
  const reps = String(repeticiones ?? ex.repeticiones ?? '').trim() || '8'
  const notasStr = (notas || '').trim()
  const base = {
    fecha: fechaIso,
    rutinaId,
    diaRutinaId,
    ejercicio: ex.nombre,
    repeticiones: reps,
    notas: notasStr,
  }

  if (ex.superserie?.trim()) {
    const vueltas = parseNumSeriesPlan(ex.series, 3)
    return Array.from({ length: vueltas }, (_, i) => ({
      ...base,
      id: i === 0 && idConservar ? idConservar : nuevoIdRegistro(),
      series: 1,
      serieNum: i + 1,
      pesoKg: pesoKg !== undefined ? pesoKg : undefined,
    }))
  }

  const nSeries = seriesEfectivasDeItem(ex)
  return [
    {
      ...base,
      id: idConservar || nuevoIdRegistro(),
      series: nSeries,
      pesoKg: pesoKg !== undefined ? pesoKg : undefined,
    },
  ]
}

export function quitarRegistrosEjercicioEnFecha(prev, fechaRef, nombreEj) {
  return prev.filter(
    (r) =>
      !(
        fechaSoloDia(r.fecha) === fechaSoloDia(fechaRef)
        && nombresEjercicioCoinciden(r.ejercicio, nombreEj)
      ),
  )
}

export function subtituloRutina(rutinaHoy) {
  if (rutinaHoy.tipo === 'sin-rutina') return 'Sin rutina'
  if (rutinaHoy.tipo === 'sin-dias') return 'Completar días'
  if (rutinaHoy.tipo === 'ok') {
    const dia = etiquetaCortaDiaRutina(rutinaHoy.dia?.nombre)
    return `${dia} · ${rutinaHoy.hechos}/${rutinaHoy.total} registrados`
  }
  return 'Ver entrenamiento'
}
