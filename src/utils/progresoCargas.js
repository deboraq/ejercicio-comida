import { fechaToISO, fechaSoloDia } from './calorias.js'
import { inferirGrupoMuscular, nombreDisplayPlan } from './rutinaEjercicioDia.js'

/** Períodos del dashboard Progreso & Cargas */
export const PERIODOS_PROGRESO = [
  { value: '7d', label: '7D', dias: 7 },
  { value: '30d', label: '30 días', dias: 30 },
  { value: '3m', label: '3 meses', dias: 90 },
  { value: '6m', label: '6 meses', dias: 180 },
  { value: '1y', label: 'Todo el año', dias: 365 },
]

export function rangoProgreso(periodo = '30d', hoyISO = fechaToISO(new Date())) {
  const def = PERIODOS_PROGRESO.find((p) => p.value === periodo) || PERIODOS_PROGRESO[1]
  const hasta = hoyISO
  const d = new Date(`${hasta}T12:00:00`)
  d.setDate(d.getDate() - (def.dias - 1))
  return { desde: fechaToISO(d), hasta, dias: def.dias }
}

export function parseReps(reps) {
  const s = String(reps ?? '').trim()
  if (!s) return 0
  if (/\+/.test(s)) {
    return s.split('+').reduce((a, p) => a + (parseFloat(String(p).replace(',', '.')) || 0), 0)
  }
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/)
  if (m) return (parseFloat(m[1].replace(',', '.')) + parseFloat(m[2].replace(',', '.'))) / 2
  return parseFloat(s.replace(',', '.')) || 0
}

/** 1RM estimado (promedio Epley + Brzycki). Confiable hasta ~12 reps. */
export function estimar1RM(pesoKg, repeticiones) {
  const w = Number(pesoKg)
  const r = Math.min(Math.max(parseReps(repeticiones), 1), 12)
  if (!(w > 0)) return null
  if (r <= 1) return Math.round(w * 10) / 10
  const epley = w * (1 + r / 30)
  const brzycki = r < 37 ? (w * 36) / (37 - r) : epley
  return Math.round(((epley + brzycki) / 2) * 10) / 10
}

export function volumenDeRegistro(r) {
  const peso = r?.pesoKg != null ? Number(r.pesoKg) : 0
  if (!(peso > 0)) return 0
  const series = Number(r.series) || 1
  const reps = parseReps(r.repeticiones) || 1
  return peso * series * reps
}

function rpeDeRegistro(r) {
  if (r?.rpe != null && r.rpe !== '') return Number(r.rpe)
  const m = String(r?.notas || '').match(/RPE\s*(\d+(?:[.,]\d+)?)/i)
  return m ? Number(m[1].replace(',', '.')) : null
}

export function filtrarRegistrosRango(registros, desde, hasta) {
  return (registros || []).filter((r) => {
    const f = fechaSoloDia(r.fecha)
    return f && f >= desde && f <= hasta
  })
}

/** Agrupa por fecha: carga máx, 1RM máx, volumen, mejor set, RPE avg */
export function seriesDiariasEjercicio(registros, ejercicio) {
  const nombre = String(ejercicio || '')
  const porFecha = {}
  for (const r of registros || []) {
    if (String(r.ejercicio || '') !== nombre) continue
    const f = fechaSoloDia(r.fecha)
    if (!f) continue
    if (!porFecha[f]) porFecha[f] = []
    porFecha[f].push(r)
  }
  return Object.keys(porFecha)
    .sort()
    .map((fecha) => {
      const lista = porFecha[fecha]
      let cargaMax = 0
      let rmMax = 0
      let mejor = null
      let vol = 0
      const rpes = []
      for (const r of lista) {
        const p = r.pesoKg != null ? Number(r.pesoKg) : 0
        const reps = parseReps(r.repeticiones)
        vol += volumenDeRegistro(r)
        const rm = estimar1RM(p, reps)
        if (p > cargaMax) {
          cargaMax = p
          mejor = r
        }
        if (rm != null && rm > rmMax) rmMax = rm
        const rpe = rpeDeRegistro(r)
        if (rpe != null) rpes.push(rpe)
      }
      return {
        fecha,
        carga: cargaMax || null,
        rm: rmMax || null,
        volumen: vol,
        reps: mejor ? parseReps(mejor.repeticiones) : null,
        rpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
        esPr: false,
      }
    })
    .filter((d) => d.carga != null || d.rm != null)
}

export function marcarPRs(puntos) {
  let maxCarga = 0
  return (puntos || []).map((p) => {
    const esPr = p.carga != null && p.carga > maxCarga
    if (p.carga != null && p.carga > maxCarga) maxCarga = p.carga
    return { ...p, esPr }
  })
}

export function resumenKpisEjercicio(puntos, puntosPrev = []) {
  const conCarga = (puntos || []).filter((p) => p.carga != null)
  const conRm = (puntos || []).filter((p) => p.rm != null)
  const cargaMax = conCarga.length ? Math.max(...conCarga.map((p) => p.carga)) : null
  const rmMax = conRm.length ? Math.max(...conRm.map((p) => p.rm)) : null
  const fechaPr = [...conCarga].reverse().find((p) => p.carga === cargaMax)?.fecha || null
  const volumen = (puntos || []).reduce((s, p) => s + (p.volumen || 0), 0)

  const rmPrev = (puntosPrev || []).filter((p) => p.rm != null)
  const rmMaxPrev = rmPrev.length ? Math.max(...rmPrev.map((p) => p.rm)) : null
  const volPrev = (puntosPrev || []).reduce((s, p) => s + (p.volumen || 0), 0)

  const deltaRm = rmMax != null && rmMaxPrev != null ? Math.round((rmMax - rmMaxPrev) * 10) / 10 : null
  const pctRm = rmMax != null && rmMaxPrev > 0 ? Math.round(((rmMax - rmMaxPrev) / rmMaxPrev) * 1000) / 10 : null
  const pctVol = volPrev > 0 ? Math.round(((volumen - volPrev) / volPrev) * 1000) / 10 : null

  let sesionesConProgreso = 0
  for (let i = 1; i < conCarga.length; i++) {
    if (conCarga[i].carga >= conCarga[i - 1].carga) sesionesConProgreso++
  }
  const sesionesComparables = Math.max(conCarga.length - 1, 0)
  const adherencia = sesionesComparables > 0
    ? Math.round((sesionesConProgreso / sesionesComparables) * 100)
    : conCarga.length > 0 ? 100 : null

  return {
    rmMax,
    deltaRm,
    pctRm,
    cargaMax,
    fechaPr,
    volumen,
    pctVol,
    adherencia,
    sesionesConProgreso,
    sesionesComparables,
    sesiones: conCarga.length,
  }
}

export function rpePromedio(registros) {
  const vals = []
  for (const r of registros || []) {
    const v = rpeDeRegistro(r)
    if (v != null) vals.push(v)
  }
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export function sugerenciaSobrecarga(puntos, ejercicio) {
  const list = (puntos || []).filter((p) => p.carga != null)
  if (!list.length) {
    return {
      texto: 'Registrá series con peso en este ejercicio para recibir una sugerencia de sobrecarga.',
      cargaSugerida: null,
      aplicable: false,
    }
  }
  const last = list[list.length - 1]
  const rpe = last.rpe
  const carga = last.carga
  const reps = last.reps || 8
  if (rpe != null && rpe <= 8 && carga > 0) {
    const next = Math.round((carga + 2.5) * 2) / 2
    return {
      texto: `Completaste tu última sesión con ${carga} kg${reps ? ` × ${reps}` : ''} a RPE ${rpe}. Zona óptima: luz verde para subir a +2.5 kg (${next} kg) en la próxima sesión.`,
      cargaSugerida: next,
      aplicable: true,
      ejercicio,
    }
  }
  if (rpe != null && rpe >= 9.5) {
    return {
      texto: `Última sesión a RPE ${rpe} con ${carga} kg. Conviene repetir la misma carga 1–2 sesiones antes de subir.`,
      cargaSugerida: carga,
      aplicable: false,
      ejercicio,
    }
  }
  const prev = list.length >= 2 ? list[list.length - 2] : null
  if (prev && last.carga > prev.carga) {
    return {
      texto: `Subiste de ${prev.carga} kg a ${last.carga} kg. Mantené ${last.carga} kg hasta consolidar la técnica y el RPE en 7.5–8.5.`,
      cargaSugerida: last.carga,
      aplicable: false,
      ejercicio,
    }
  }
  const next = Math.round((carga + 2.5) * 2) / 2
  return {
    texto: `Última carga: ${carga} kg. Si completás las series objetivo con buen control, probá ${next} kg la próxima vez.`,
    cargaSugerida: next,
    aplicable: true,
    ejercicio,
  }
}

export function listaEjerciciosConProgreso(registros) {
  const map = {}
  for (const r of registros || []) {
    const name = r.ejercicio
    if (!name) continue
    if (!map[name]) map[name] = { nombre: name, count: 0, last: r.fecha }
    map[name].count++
    if (r.fecha > map[name].last) map[name].last = r.fecha
  }
  return Object.values(map).sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
}

export function totalSeriesRegistros(registros) {
  return (registros || []).reduce((s, r) => s + (Number(r.series) || 1), 0)
}

export function seriesPorSemana(registros, dias) {
  const total = totalSeriesRegistros(registros)
  if (!dias || dias <= 0) return total
  return Math.round((total / dias) * 7)
}

export function progresionPorEjercicio(registros, limite = 8) {
  const porEj = {}
  for (const r of registros || []) {
    const name = r.ejercicio
    if (!name) continue
    if (!porEj[name]) porEj[name] = []
    porEj[name].push(r)
  }
  const tones = ['green', 'violet', 'blue', 'amber']
  return Object.entries(porEj)
    .map(([nombre, lista], i) => {
      const pts = marcarPRs(seriesDiariasEjercicio(lista, nombre))
      const conCarga = pts.filter((p) => p.carga != null)
      if (conCarga.length < 1) return null
      const base = conCarga[0].carga
      const actual = conCarga[conCarga.length - 1]
      const pct = base > 0 ? Math.round(((actual.carga - base) / base) * 1000) / 10 : 0
      const spark = conCarga.map((p) => p.carga)
      const reps = actual.reps
      return {
        nombre,
        display: nombreDisplayPlan(nombre),
        grupo: inferirGrupoMuscular(nombre),
        base,
        actual: actual.carga,
        reps,
        fechaActual: actual.fecha,
        pct,
        spark,
        prs: pts.filter((p) => p.esPr).length,
        tone: tones[i % tones.length],
      }
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, limite)
}

export function distribucionMuscular(registros) {
  const vols = {}
  let total = 0
  for (const r of registros || []) {
    const v = volumenDeRegistro(r)
    if (!(v > 0)) continue
    const g = inferirGrupoMuscular(r.ejercicio)
    if (g === 'Calentamiento') continue
    vols[g] = (vols[g] || 0) + v
    total += v
  }
  if (!(total > 0)) return []
  const colors = {
    Pecho: '#3b82f6',
    Espalda: '#8b5cf6',
    Hombros: '#06b6d4',
    Piernas: '#f59e0b',
    Bíceps: '#a78bfa',
    Tríceps: '#60a5fa',
    Core: '#34d399',
    Otro: '#64748b',
  }
  return Object.entries(vols)
    .map(([grupo, vol]) => ({
      grupo,
      pct: Math.round((vol / total) * 100),
      color: colors[grupo] || colors.Otro,
    }))
    .sort((a, b) => b.pct - a.pct)
}

export function formatearFechaCorta(iso) {
  if (!iso) return '—'
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  try {
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return iso
    return `${String(d).padStart(2, '0')} ${MESES[m - 1]}`
  } catch {
    return iso
  }
}

export function formatearFechaMedia(iso) {
  if (!iso) return '—'
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  try {
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return iso
    return `${String(d).padStart(2, '0')} ${MESES[m - 1]} ${y}`
  } catch {
    return iso
  }
}

export function formatearFechaLarga(iso) {
  if (!iso) return '—'
  try {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return iso
  }
}

export function formatKg(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${Number(n).toFixed(digits)} kg`
}

export function formatVolumen(kg) {
  if (!(kg > 0)) return '0 kg'
  if (kg >= 10000) return `${(kg / 1000).toFixed(kg >= 100000 ? 0 : 2)} ton`
  return `${Math.round(kg).toLocaleString('es-AR')} kg`
}

/** Volumen siempre en kg con separador (estilo mock KPIs). */
export function formatVolumenKg(kg) {
  if (!(kg > 0)) return '0 kg'
  return `${Math.round(kg).toLocaleString('es-AR')} kg`
}
