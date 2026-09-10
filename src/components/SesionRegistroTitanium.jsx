import { useMemo, useState, useEffect } from 'react'
import {
  itemEjercicioDiaNormalizado,
  agruparPlanEnBloques,
  parseNumSeriesPlan,
  parseCargaMediaKg,
  nombresEjercicioCoinciden,
} from '../utils/rutinaEjercicioDia'
import { caloriasQuemadasRegistroRutina } from '../utils/calorias'

const RPE_OPTS = [6, 7, 8, 9, 10]

function etiquetaMusculo(nombre) {
  const n = String(nombre || '').toLowerCase()
  // Cardio / calentamiento primero (evita que "remo" en un combo de bici marque Espalda)
  if (/bici|el[ií]ptic[oa]|cinta|cardio|calentamiento|spinning|movilidad/.test(n)) return 'Calentamiento'
  if (/pecho|banca|apertura|pectoral/.test(n) && !/jal[oó]n/.test(n)) return 'Pecho'
  if (/jal[oó]n|espalda|dorsal|dominada|pull.?up|remo(?!\s*erg)/.test(n)) return 'Espalda / Dorsal'
  if (/hombro|militar|elevaci[oó]n\s*lateral|delto/.test(n)) return 'Hombros'
  if (/sentadilla|prensa|femoral|zancada|gl[uú]teo|goblet/.test(n)) return 'Piernas'
  if (/b[ií]ceps|curl/.test(n)) return 'Bíceps'
  if (/tr[ií]ceps/.test(n)) return 'Tríceps'
  if (/abdomen|plancha|core|elevaciones? de piernas/.test(n)) return 'Core'
  return 'Fuerza'
}

function rpeDeRegistro(r) {
  if (r?.rpe != null && r.rpe !== '') return Number(r.rpe)
  const m = String(r?.notas || '').match(/RPE\s*(\d+)/i)
  return m ? Number(m[1]) : null
}

function anteriorPorSerie(historialEjercicio, serieNum) {
  if (!historialEjercicio?.length) return null
  const conSerie = historialEjercicio.find((r) => Number(r.serieNum) === serieNum && r.pesoKg != null)
  if (conSerie) return conSerie
  return historialEjercicio.find((r) => r.pesoKg != null) || historialEjercicio[0] || null
}

function historialDe(historialPorEjercicio, nombre) {
  if (historialPorEjercicio[nombre]?.length) return historialPorEjercicio[nombre]
  for (const [key, rows] of Object.entries(historialPorEjercicio || {})) {
    if (nombresEjercicioCoinciden(key, nombre) && rows?.length) return rows
  }
  return []
}

function pesoKgSugerido(it, hist, serieNum) {
  const ant = anteriorPorSerie(hist, serieNum)
  if (ant?.pesoKg != null) return String(ant.pesoKg)
  const fromPlan = parseCargaMediaKg(it.carga)
  if (fromPlan > 0) return String(Math.round(fromPlan * 10) / 10)
  return ''
}

function resumenRondasSs(ya) {
  const rows = [...(ya || [])].filter((r) => r.serieNum != null)
  if (!rows.length) return ''

  const porPeso = new Map()
  for (const r of rows) {
    const pesoKey = r.pesoKg != null ? String(r.pesoKg) : '—'
    porPeso.set(pesoKey, (porPeso.get(pesoKey) || 0) + 1)
  }

  const partes = [...porPeso.entries()]
    .sort(([a], [b]) => {
      if (a === '—') return 1
      if (b === '—') return -1
      return Number(b) - Number(a)
    })
    .map(([peso, count]) => `${count}×${peso}`)

  const reps = [...new Set(rows.map((r) => String(r.repeticiones || '').trim()).filter(Boolean))]
  const repsTxt = reps.length === 1 ? ` × ${reps[0]} reps` : ''
  const tieneKg = partes.some((p) => !p.includes('—'))
  return `${partes.join(', ')}${tieneKg ? ' kg' : ''}${repsTxt}`
}

function registroHechoParaSerie(ya, serieNum) {
  const porNum = ya.find((r) => Number(r.serieNum) === serieNum)
  if (porNum) return porNum
  const sinNums = !ya.some((r) => r.serieNum != null)
  if (sinNums) return ya[serieNum - 1] || null
  return null
}

function buildPayloadSerie(it, serieNum, d, notaEjercicio = '') {
  const reps = String(d.repeticiones || '').trim()
  if (!reps) return null
  const nota = String(notaEjercicio || '').trim()
  const notaParts = []
  if (d.rpe) notaParts.push(`RPE ${d.rpe}`)
  if (nota) notaParts.push(nota)
  return {
    ejercicio: it.nombre,
    series: 1,
    serieNum,
    repeticiones: reps,
    pesoKg: d.pesoKg,
    rpe: d.rpe !== '' && d.rpe != null ? Number(d.rpe) : undefined,
    notas: notaParts.join(' · '),
  }
}

function seriesPendientes(ya, nSeries) {
  return Array.from({ length: nSeries }, (_, i) => i + 1).filter((s) => !registroHechoParaSerie(ya, s))
}

function seriesHechasDe(ya, nSeries) {
  let count = 0
  for (let s = 1; s <= nSeries; s += 1) {
    if (registroHechoParaSerie(ya, s)) count = s
    else break
  }
  return count
}

function esPesoCorporalNombre(nombre) {
  return /plancha|elevaciones? de piernas|peso\s*corporal|abdominal|core/i.test(nombre)
    && !/mancuerna|barra|kg/i.test(nombre)
}

function esCalentamientoItem(it) {
  const musculo = it?.grupoMuscular || etiquetaMusculo(it?.nombre)
  return musculo === 'Calentamiento'
}

/** Reps/segundos embebidos en el nombre del ejercicio (p. ej. "…: 45 a 60 segundos"). */
function repsDesdeNombre(nombre) {
  const n = String(nombre || '')
  const rangoSeg = n.match(/(\d+\s*(?:a|–|-)\s*\d+\s*seg(?:undos?)?)/i)
  if (rangoSeg) return rangoSeg[1].trim()
  const rangoReps = n.match(/(\d+\s*(?:a|–|-)\s*\d+)\s*rep(?:eticiones?)?/i)
  if (rangoReps) return rangoReps[1].trim()
  const soloSeg = n.match(/:\s*(\d+\s*seg(?:undos?)?)/i)
  if (soloSeg) return soloSeg[1].trim()
  const soloReps = n.match(/:\s*(\d+)\s*rep(?:eticiones?)?/i)
  if (soloReps) return soloReps[1].trim()
  return ''
}

function repsPlanDefault(it, ant, esWarm = false) {
  const fromPlan = it.repeticiones?.trim()
  if (fromPlan) return fromPlan.replace(/\s*reps?/i, '').trim()
  if (ant?.repeticiones) {
    return String(ant.repeticiones).replace(/\s*reps?/i, '').trim()
  }
  const fromNombre = repsDesdeNombre(it.nombre)
  if (fromNombre) return fromNombre
  if (esWarm) return '1'
  return '10'
}

function draftEfectivoEjercicio(it, serieNum, drafts, historialPorEjercicio) {
  const key = `${it.nombre}::${serieNum}`
  const stored = drafts[key] || {}
  const hist = historialDe(historialPorEjercicio, it.nombre)
  const ant = anteriorPorSerie(hist, serieNum)
  const esWarm = esCalentamientoItem(it)
  const repsDefault = repsPlanDefault(it, ant, esWarm)
  return {
    pesoKg: stored.pesoKg != null && stored.pesoKg !== ''
      ? stored.pesoKg
      : pesoKgSugerido(it, hist, serieNum),
    repeticiones: String(stored.repeticiones ?? '').trim() || repsDefault,
    rpe: stored.rpe ?? '',
  }
}

function nombreDisplayEjercicio(nombre) {
  return String(nombre || '')
    .replace(/^\s*\d+\s*[-–.)]\s*/, '')
    .trim() || nombre
}

function rangoPesoHistorial(hist = [], regsHoy = []) {
  const pesos = [...hist, ...regsHoy]
    .map((r) => (r.pesoKg != null ? Number(r.pesoKg) : null))
    .filter((p) => p != null && p > 0)
  if (!pesos.length) return null
  const min = Math.min(...pesos)
  const max = Math.max(...pesos)
  if (min === max) return `${min} kg`
  return `${min} kg – ${max} kg`
}

function formatoAnterior(ant) {
  if (!ant) return '—'
  const p = ant.pesoKg != null ? ant.pesoKg : '—'
  const r = ant.repeticiones || '—'
  return `${p} × ${r}`
}

function rmEstimado(historial = [], regsHoy = []) {
  const pesos = [...historial, ...regsHoy]
    .map((r) => (r.pesoKg != null ? Number(r.pesoKg) : null))
    .filter((p) => p != null && p > 0)
  if (!pesos.length) return null
  return Math.max(...pesos)
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15l3-4 3 2 4-6" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function IconBolt() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2L4 14h7l-1 8 10-14h-7l0-6z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" />
    </svg>
  )
}

/**
 * UI idéntica al mock Titanium: tabla de series + superserie checklist.
 */
export default function SesionRegistroTitanium({
  ejercicios,
  registrosDeEstaSesion,
  historialPorEjercicio = {},
  pesoCfg,
  onGuardarSerie,
  onGuardarSeries,
  onEliminarRegistro,
  onEliminarRegistros,
  ocultarProgreso = false,
  onAnadirEjercicioExtra,
  diaTono = 0,
}) {
  const planItems = useMemo(
    () => (ejercicios || []).map(itemEjercicioDiaNormalizado).filter(Boolean),
    [ejercicios]
  )
  const bloques = useMemo(() => agruparPlanEnBloques(planItems), [planItems])

  const [drafts, setDrafts] = useState({})
  const [seriesAdj, setSeriesAdj] = useState({})
  const [notas, setNotas] = useState({})
  const [ssDrafts, setSsDrafts] = useState({})
  const [ssRondas, setSsRondas] = useState({})
  const [expandidos, setExpandidos] = useState({})
  const [ssExpandidos, setSsExpandidos] = useState({})

  const borrarRegs = (lista) => {
    const ids = (lista || []).map((r) => r.id).filter(Boolean)
    if (ids.length === 0) return
    if (onEliminarRegistros) onEliminarRegistros(ids)
    else ids.forEach((id) => onEliminarRegistro(id))
  }

  const regsDeNombre = (nombre) =>
    (registrosDeEstaSesion || []).filter((r) => nombresEjercicioCoinciden(r.ejercicio, nombre))

  useEffect(() => {
    setSeriesAdj({})
    setSsRondas({})
    setExpandidos({})
    setSsExpandidos({})
  }, [planItems])

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const it of planItems) {
        const esWarm = esCalentamientoItem(it)
        const base = esWarm ? 1 : parseNumSeriesPlan(it.series, 3)
        const nSeries = Math.max(1, base + (seriesAdj[it.nombre] || 0))
        for (let s = 1; s <= nSeries; s++) {
          const key = `${it.nombre}::${s}`
          if (!next[key]) {
            const hist = historialDe(historialPorEjercicio, it.nombre)
            const ant = anteriorPorSerie(hist, s)
            next[key] = {
              pesoKg: pesoKgSugerido(it, hist, s),
              repeticiones: repsPlanDefault(it, ant, esWarm),
              rpe: '',
            }
          }
        }
      }
      return next
    })
  }, [planItems, seriesAdj, historialPorEjercicio])

  const regsPorEjercicio = useMemo(() => {
    const map = {}
    for (const it of planItems) {
      map[it.nombre] = (registrosDeEstaSesion || []).filter((r) =>
        nombresEjercicioCoinciden(r.ejercicio, it.nombre)
      )
    }
    return map
  }, [planItems, registrosDeEstaSesion])

  const numSeriesDe = (it) => {
    if (esCalentamientoItem(it)) return 1
    const base = parseNumSeriesPlan(it.series, 3)
    return Math.max(1, base + (seriesAdj[it.nombre] || 0))
  }

  const limpiarRegistrosEjercicio = (nombre) => {
    borrarRegs(regsDeNombre(nombre))
    setExpandidos((p) => ({ ...p, [nombre]: false }))
  }

  const hechosCount = planItems.filter((it) => {
    const ya = regsPorEjercicio[it.nombre] || []
    if (it.superserie) {
      const vueltas = parseNumSeriesPlan(it.series, 3)
      if (!ya.length) return false
      for (let r = 1; r <= vueltas; r += 1) {
        if (!ya.some((reg) => Number(reg.serieNum) === r)) return false
      }
      return true
    }
    return ya.length >= numSeriesDe(it)
  }).length

  const pct = planItems.length > 0 ? Math.round((hechosCount / planItems.length) * 100) : 0
  const kcalSesion = (registrosDeEstaSesion || []).reduce(
    (s, r) => s + caloriasQuemadasRegistroRutina(r, pesoCfg),
    0
  )

  const patchDraft = (nombre, serieNum, patch) => {
    const key = `${nombre}::${serieNum}`
    setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }))
  }

  const guardarUnaOVarias = (lista) => {
    if (!lista?.length) return
    if (lista.length === 1) onGuardarSerie(lista[0])
    else if (onGuardarSeries) onGuardarSeries(lista)
    else lista.forEach((s) => onGuardarSerie(s))
  }

  const guardarSerie = (it, serieNum) => {
    const d = draftEfectivoEjercicio(it, serieNum, drafts, historialPorEjercicio)
    const payload = buildPayloadSerie(it, serieNum, d, notas[it.nombre])
    if (!payload) return
    onGuardarSerie(payload)
  }

  const guardarTodasMismoPeso = (it, pendientes, serieRef) => {
    const dRef = draftEfectivoEjercicio(it, serieRef, drafts, historialPorEjercicio)
    const repsRef = String(dRef.repeticiones || '').trim()
    if (!repsRef) return
    const nota = notas[it.nombre] || ''
    const lista = pendientes
      .map((serieNum) => {
        const d = draftEfectivoEjercicio(it, serieNum, drafts, historialPorEjercicio)
        return buildPayloadSerie(it, serieNum, {
          pesoKg: dRef.pesoKg,
          repeticiones: String(d.repeticiones || repsRef).trim(),
          rpe: dRef.rpe,
        }, nota)
      })
      .filter(Boolean)
    guardarUnaOVarias(lista)
  }

  const deshacerUltimaSerieEjercicio = (it, nSeries) => {
    const ya = regsPorEjercicio[it.nombre] || []
    const hechas = seriesHechasDe(ya, nSeries)
    if (hechas < 1) return
    const reg = registroHechoParaSerie(ya, hechas)
    if (reg?.id) onEliminarRegistro(reg.id)
  }

  const completarSerieActualEjercicio = (it, serieNum) => {
    guardarSerie(it, serieNum)
  }

  const completarTodasSeriesEjercicio = (it, nSeries) => {
    const ya = regsPorEjercicio[it.nombre] || []
    const pendientes = seriesPendientes(ya, nSeries)
    if (pendientes.length >= 2) {
      guardarTodasMismoPeso(it, pendientes, pendientes[0])
    } else if (pendientes.length === 1) {
      guardarSerie(it, pendientes[0])
    }
  }

  const renderTablaEjercicio = (it, idxNum) => {
    const esWarm = esCalentamientoItem(it)
    const nSeries = numSeriesDe(it)
    const ya = regsPorEjercicio[it.nombre] || []
    const hist = historialDe(historialPorEjercicio, it.nombre)
    const musculo = it.grupoMuscular || etiquetaMusculo(it.nombre)
    const completo = (() => {
      if (ya.length === 0) return false
      if (esWarm) return true
      const legacy = ya.find((r) => r.serieNum == null && Number(r.series) >= nSeries)
      if (legacy) return true
      return ya.length >= nSeries && nSeries > 0
    })()
    const rm = rmEstimado(hist, ya)
    const rango = rangoPesoHistorial(hist, ya)
    const titulo = nombreDisplayEjercicio(it.nombre)
    const labelTipo = esWarm ? 'Calentamiento Dinámico' : musculo
    const expandido = Boolean(expandidos[it.nombre])

    if (completo && !expandido) {
      const resumen = esWarm
        ? (it.repeticiones?.trim()
          || (ya[0]?.notas && !/^RPE\s*\d+/i.test(String(ya[0].notas)) ? ya[0].notas : '')
          || 'Calentamiento dinámico completado')
        : resumenRondasSs(ya) || ya.map((r) => (
            r.pesoKg != null ? `${r.pesoKg} kg × ${r.repeticiones}` : `${r.repeticiones} reps`
          )).join(' · ')

      return (
        <article key={it.nombre} className={`fp-ex fp-ex--done fp-ex--compact${esWarm ? ' is-warm' : ''}`}>
          <div className="fp-ex-done-inner fp-ex-done-inner--compact">
            <span className="fp-ex-done-ico" aria-hidden><IconCheck /></span>
            <div className="fp-ex-done-body">
              <div className="fp-ex-done-top">
                <span className="fp-ex-idx">{esWarm ? '0.' : `${idxNum}.`}</span>
                <strong>{titulo}</strong>
                <span className="fp-badge-done">OK</span>
                {!esWarm ? <span className="fp-badge-soft">{labelTipo}</span> : null}
              </div>
              <p className="fp-ex-done-sum mb-0">{resumen}</p>
            </div>
            <div className="fp-ex-done-actions">
              {!esWarm && (
                <button
                  type="button"
                  className="fp-ex-done-icon"
                  onClick={() => setExpandidos((p) => ({ ...p, [it.nombre]: true }))}
                  aria-label="Editar series"
                  title="Editar series"
                >
                  <IconPencil />
                </button>
              )}
              <button
                type="button"
                className="fp-ex-done-icon is-danger"
                onClick={() => limpiarRegistrosEjercicio(it.nombre)}
                aria-label="Quitar ejercicio"
                title="Quitar"
              >
                <IconTrash />
              </button>
            </div>
          </div>
        </article>
      )
    }

    // Calentamiento: una sola acción, sin tabla de series
    if (esWarm) {
      return (
        <article key={it.nombre} className="fp-ex fp-ex--warm fp-ex--compact">
          <div className="fp-ex-head fp-ex-head--compact">
            <span className="fp-ex-num">0</span>
            <div className="fp-ex-head-main">
              <div className="fp-ex-title-row">
                <h3 className="fp-ex-title">{titulo}</h3>
                <span className="fp-musculo">{musculo}</span>
              </div>
            </div>
          </div>
          <div className="fp-warm-box fp-warm-box--compact">
            <div className="fp-nota-box">
              <IconPencil />
              <input
                type="text"
                placeholder="Nota: ritmo, zona, sensaciones…"
                value={notas[it.nombre] || ''}
                onChange={(e) => setNotas((p) => ({ ...p, [it.nombre]: e.target.value }))}
              />
            </div>
            <button
              type="button"
              className="fp-btn-save fp-btn-warm"
              onClick={() => {
                onGuardarSerie({
                  ejercicio: it.nombre,
                  series: 1,
                  serieNum: 1,
                  repeticiones: '1',
                  pesoKg: '',
                  notas: (notas[it.nombre] || '').trim() || 'Calentamiento',
                })
              }}
            >
              <IconCheck /> Marcar calentamiento
            </button>
          </div>
        </article>
      )
    }

    const hechas = seriesHechasDe(ya, nSeries)
    const serieActual = Math.min(hechas + 1, nSeries)
    const completaSeries = hechas >= nSeries
    const pendientes = seriesPendientes(ya, nSeries)
    const d = draftEfectivoEjercicio(it, serieActual, drafts, historialPorEjercicio)
    const ant = anteriorPorSerie(hist, serieActual)
    const repsObjetivo = repsPlanDefault(it, ant, esWarm)
    const resumenHecho = resumenRondasSs(ya)
    const esPesoCorporal = esPesoCorporalNombre(it.nombre)
    const hechosSeries = ya.filter((r) => r.serieNum != null).length || ya.length
    const puedeQuitarSerie = nSeries > Math.max(1, hechosSeries)

    return (
      <article key={it.nombre} className="fp-ex fp-ex--compact">
        <div className="fp-ex-head fp-ex-head--compact">
          <span className="fp-ex-num">{idxNum}</span>
          <div className="fp-ex-head-main">
            <div className="fp-ex-title-row">
              <h3 className="fp-ex-title">{titulo}</h3>
              <span className="fp-musculo">{musculo}</span>
            </div>
            <p className="fp-ex-obj mb-0">
              Objetivo:{' '}
              <strong>
                {nSeries} series × {repsObjetivo} reps
                {rango ? ` con ${rango}` : rm != null ? ` · foco en ${Math.max(0, rm - 7)}–${rm} kg` : ''}
              </strong>
            </p>
          </div>
          {rm != null && (
            <div className="fp-rm">
              <IconChart />
              <span>RM: <b>{rm} kg</b></span>
            </div>
          )}
        </div>

        <div className="fp-ex-serie-block">
          <div className={`fp-ex-serie-row${completaSeries ? ' is-done' : ''}`}>
            <div className="fp-ex-serie-copy">
              <span className="fp-ex-serie-label">
                {completaSeries ? 'Series' : `Serie ${serieActual}`}
              </span>
              <span className="fp-ex-serie-ant" title="Sesión anterior">
                Ant.: {formatoAnterior(ant)}
              </span>
            </div>
            <div className="fp-ex-serie-log">
              {completaSeries ? (
                <span className="fp-ex-serie-done-txt">{resumenHecho || `${hechas} series hechas`}</span>
              ) : esPesoCorporal && !d.pesoKg ? (
                <div className="fp-ss-pill fp-ss-pill--edit">
                  <input
                    type="text"
                    value={d.repeticiones}
                    onChange={(e) => patchDraft(it.nombre, serieActual, { repeticiones: e.target.value })}
                    placeholder="reps"
                    aria-label="Repeticiones"
                  />
                  <select
                    value={d.rpe ?? ''}
                    onChange={(e) => patchDraft(it.nombre, serieActual, { rpe: e.target.value })}
                    aria-label="RPE"
                    className="fp-ex-serie-rpe"
                  >
                    <option value="">RPE</option>
                    {RPE_OPTS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="fp-ss-pill fp-ss-pill--edit">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={d.pesoKg}
                    onChange={(e) => patchDraft(it.nombre, serieActual, { pesoKg: e.target.value })}
                    placeholder="kg"
                    aria-label="Peso kg"
                  />
                  <input
                    type="text"
                    value={d.repeticiones}
                    onChange={(e) => patchDraft(it.nombre, serieActual, { repeticiones: e.target.value })}
                    placeholder="reps"
                    aria-label="Repeticiones"
                  />
                  <select
                    value={d.rpe ?? ''}
                    onChange={(e) => patchDraft(it.nombre, serieActual, { rpe: e.target.value })}
                    aria-label="RPE"
                    className="fp-ex-serie-rpe"
                  >
                    <option value="">RPE</option>
                    {RPE_OPTS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {resumenHecho && !completaSeries ? (
            <span className="fp-ss-hint fp-ss-hint--done">{resumenHecho}</span>
          ) : null}

          <div className="fp-ex-serie-foot">
            <span className="fp-ss-rondas">
              Series completadas: <strong>{hechas} de {nSeries}</strong>
            </span>
            <div className="fp-ss-foot-actions">
              {hechas > 0 && (
                <button
                  type="button"
                  className="fp-ss-undo"
                  onClick={() => deshacerUltimaSerieEjercicio(it, nSeries)}
                >
                  Deshacer última serie
                </button>
              )}
              {!completaSeries && pendientes.length >= 2 && (
                <button
                  type="button"
                  className="fp-ss-ronda-btn is-ghost"
                  onClick={() => completarTodasSeriesEjercicio(it, nSeries)}
                >
                  Completar {pendientes.length} series
                </button>
              )}
              {!completaSeries && (
                <button
                  type="button"
                  className="fp-ss-ronda-btn"
                  onClick={() => completarSerieActualEjercicio(it, serieActual)}
                >
                  Completar Serie {serieActual}
                </button>
              )}
              {expandido && completaSeries && (
                <button
                  type="button"
                  className="fp-ss-undo"
                  onClick={() => setExpandidos((p) => ({ ...p, [it.nombre]: false }))}
                >
                  Comprimir
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="fp-ex-foot fp-ex-foot--compact">
          <div className="fp-nota-box">
            <IconPencil />
            <input
              type="text"
              placeholder="Nota: técnica, agarre, sensaciones…"
              value={notas[it.nombre] || ''}
              onChange={(e) => setNotas((p) => ({ ...p, [it.nombre]: e.target.value }))}
            />
          </div>
          <div className="fp-serie-actions">
            {puedeQuitarSerie && (
              <button
                type="button"
                className="fp-add-serie is-muted"
                onClick={() => {
                  const ultima = nSeries
                  const regUltima = registroHechoParaSerie(ya, ultima)
                  if (regUltima) onEliminarRegistro(regUltima.id)
                  setSeriesAdj((prev) => ({
                    ...prev,
                    [it.nombre]: (prev[it.nombre] || 0) - 1,
                  }))
                }}
              >
                − Quitar serie
              </button>
            )}
            <button
              type="button"
              className="fp-add-serie"
              onClick={() => setSeriesAdj((prev) => ({
                ...prev,
                [it.nombre]: (prev[it.nombre] || 0) + 1,
              }))}
            >
              + Añadir serie extra
            </button>
            {expandido && (
              <button
                type="button"
                className="fp-add-serie is-muted"
                onClick={() => setExpandidos((p) => ({ ...p, [it.nombre]: false }))}
              >
                Comprimir
              </button>
            )}
          </div>
        </div>
      </article>
    )
  }

  const rondasHechasBloque = (bloque) => {
    const vueltas = parseNumSeriesPlan(bloque.items[0]?.series, 3)
    let completas = 0
    for (let r = 1; r <= vueltas; r += 1) {
      const ok = bloque.items.every((it) => {
        const ya = regsPorEjercicio[it.nombre] || []
        return ya.some((reg) => Number(reg.serieNum) === r)
      })
      if (ok) completas = r
      else break
    }
    return Math.max(ssRondas[bloque.id] || 0, completas)
  }

  const vueltasDeBloque = (bloque) => parseNumSeriesPlan(bloque.items[0]?.series, 3)

  const ejercicioSsCompleto = (it, vueltas) => {
    const ya = regsPorEjercicio[it.nombre] || []
    if (!ya.length) return false
    for (let r = 1; r <= vueltas; r += 1) {
      if (!ya.some((reg) => Number(reg.serieNum) === r)) return false
    }
    return true
  }

  const draftSsDe = (bloqueId, it, ronda = 1) => {
    const draftKey = `${bloqueId}::${it.nombre}::${ronda}`
    const ya = regsPorEjercicio[it.nombre] || []
    const regActual = ya.find((r) => Number(r.serieNum) === ronda)
    if (regActual) {
      return ssDrafts[draftKey] || {
        pesoKg: regActual.pesoKg != null ? String(regActual.pesoKg) : '',
        repeticiones: String(regActual.repeticiones || repsPlanDefault(it, null, false)).replace(/\s*reps?/i, ''),
      }
    }
    const hist = historialDe(historialPorEjercicio, it.nombre)
    const ant = anteriorPorSerie(hist, ronda)
    return ssDrafts[draftKey] || {
      pesoKg: pesoKgSugerido(it, hist, ronda),
      repeticiones: repsPlanDefault(it, ant, false),
    }
  }

  const limpiarSuperserie = (bloque) => {
    const todos = []
    for (const it of bloque.items) {
      todos.push(...regsDeNombre(it.nombre))
    }
    borrarRegs(todos)
    setSsRondas((p) => ({ ...p, [bloque.id]: 0 }))
    setSsExpandidos((p) => ({ ...p, [bloque.id]: false }))
  }

  const deshacerUltimaRonda = (bloque) => {
    const hechas = rondasHechasBloque(bloque)
    if (hechas < 1) return
    const aBorrar = []
    for (const it of bloque.items) {
      const ya = regsDeNombre(it.nombre)
      const reg = ya.find((r) => Number(r.serieNum) === hechas)
      if (reg) aBorrar.push(reg)
    }
    borrarRegs(aBorrar)
    setSsRondas((p) => ({ ...p, [bloque.id]: Math.max(0, hechas - 1) }))
  }

  /** Un click marca/desmarca TODAS las vueltas de ese ejercicio en la superserie. */
  const toggleEjercicioSs = (bloque, it, label) => {
    const vueltas = vueltasDeBloque(bloque)
    const ya = regsDeNombre(it.nombre)
    if (ejercicioSsCompleto(it, vueltas)) {
      // Al desmarcar uno, limpiamos toda la superserie para no dejar rondas huérfanas
      limpiarSuperserie(bloque)
      return
    }
    const pendientes = []
    for (let r = 1; r <= vueltas; r += 1) {
      if (ya.some((reg) => Number(reg.serieNum) === r)) continue
      const d = draftSsDe(bloque.id, it, r)
      pendientes.push({
        ejercicio: it.nombre,
        series: 1,
        serieNum: r,
        repeticiones: String(d.repeticiones || it.repeticiones || '10').trim(),
        pesoKg: d.pesoKg,
        notas: `Superserie ${label} · Ronda ${r}`,
      })
    }
    guardarUnaOVarias(pendientes)
  }

  const completarRonda = (bloque) => {
    const vueltas = vueltasDeBloque(bloque)
    const hechas = rondasHechasBloque(bloque)
    if (hechas >= vueltas) return
    const next = hechas + 1
    const pendientes = []
    for (const it of bloque.items) {
      const ya = regsPorEjercicio[it.nombre] || []
      if (ya.some((r) => Number(r.serieNum) === next)) continue
      const d = draftSsDe(bloque.id, it, next)
      pendientes.push({
        ejercicio: it.nombre,
        series: 1,
        serieNum: next,
        repeticiones: String(d.repeticiones || '10').trim(),
        pesoKg: d.pesoKg,
        notas: `Superserie ${bloque.label} · Ronda ${next}`,
      })
    }
    guardarUnaOVarias(pendientes)
    setSsRondas((p) => ({ ...p, [bloque.id]: next }))
  }

  const completarSuperserieEntera = (bloque) => {
    const vueltas = vueltasDeBloque(bloque)
    const pendientes = []
    for (let i = 0; i < bloque.items.length; i += 1) {
      const it = bloque.items[i]
      const label = `${bloque.label}${i + 1}`
      const ya = regsPorEjercicio[it.nombre] || []
      for (let r = 1; r <= vueltas; r += 1) {
        if (ya.some((reg) => Number(reg.serieNum) === r)) continue
        const d = draftSsDe(bloque.id, it, r)
        pendientes.push({
          ejercicio: it.nombre,
          series: 1,
          serieNum: r,
          repeticiones: String(d.repeticiones || it.repeticiones || '10').trim(),
          pesoKg: d.pesoKg,
          notas: `Superserie ${label} · Ronda ${r}`,
        })
      }
    }
    guardarUnaOVarias(pendientes)
    setSsRondas((p) => ({ ...p, [bloque.id]: vueltas }))
  }

  const renderSuperserieItem = (it, label, idx, bloque, rondaActual) => {
    const vueltas = vueltasDeBloque(bloque)
    const ya = regsPorEjercicio[it.nombre] || []
    const draftKey = `${bloque.id}::${it.nombre}::${rondaActual}`
    const d = draftSsDe(bloque.id, it, rondaActual)
    const checked = ejercicioSsCompleto(it, vueltas)
    const parcial = !checked && ya.length > 0
    const esPesoCorporal = esPesoCorporalNombre(it.nombre)
    const rondasHechasTxt = resumenRondasSs(ya)

    return (
      <div key={it.nombre} className={`fp-ss-item fp-ss-item--compact${checked ? ' is-done' : ''}${parcial ? ' is-partial' : ''}`}>
        {idx > 0 && <p className="fp-ss-join">↓ Sin pausa</p>}
        <div className="fp-ss-row fp-ss-row--compact">
          <span className="fp-ss-dot" aria-hidden />
          <div className="fp-ss-copy fp-ss-copy--compact">
            <span className="fp-ss-label-inline">{label}</span>
            <strong className="fp-ss-name">{nombreDisplayEjercicio(it.nombre)}</strong>
          </div>
          <div className="fp-ss-log fp-ss-log--compact">
            {esPesoCorporal && !d.pesoKg ? (
              <span className="fp-ss-pill">PC</span>
            ) : (
              <div className="fp-ss-pill fp-ss-pill--edit">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={d.pesoKg}
                  onChange={(e) => setSsDrafts((p) => ({
                    ...p,
                    [draftKey]: { ...d, pesoKg: e.target.value },
                  }))}
                  placeholder="kg"
                  aria-label="Peso kg"
                />
                <input
                  type="text"
                  value={d.repeticiones}
                  onChange={(e) => setSsDrafts((p) => ({
                    ...p,
                    [draftKey]: { ...d, repeticiones: e.target.value },
                  }))}
                  placeholder="reps"
                  aria-label="Repeticiones"
                />
              </div>
            )}
            <button
              type="button"
              className={`fp-ss-check${checked ? ' is-on' : ''}`}
              aria-pressed={checked}
              aria-label={checked ? 'Quitar ejercicio de la superserie' : 'Marcar ejercicio (todas las vueltas)'}
              title={checked ? 'Quitar' : 'Marcar todas las vueltas'}
              onClick={() => toggleEjercicioSs(bloque, it, label)}
            >
              {checked ? <IconCheck /> : null}
            </button>
          </div>
        </div>
        {rondasHechasTxt ? <span className="fp-ss-hint fp-ss-hint--done">{rondasHechasTxt}</span> : null}
      </div>
    )
  }

  const idxPorNombre = (() => {
    const map = {}
    let n = 0
    for (const it of planItems) {
      if (esCalentamientoItem(it)) {
        map[it.nombre] = 0
      } else {
        n += 1
        map[it.nombre] = n
      }
    }
    return map
  })()

  return (
    <div className={`fp-sesion fp-sesion--compact fp-sesion--tone-${Number(diaTono) % 6}`}>
      {!ocultarProgreso && (
        <div className="fp-progress">
          <div className="fp-progress-top">
            <span>
              Progreso de la sesión:{' '}
              <strong>{hechosCount} de {planItems.length} ejercicios completados</strong>
              {' '}({pct}%)
            </span>
            <span className="fp-progress-kcal">
              Estimado: ~{Math.max(kcalSesion, hechosCount * 45)} kcal gastadas
            </span>
          </div>
          <div className="fp-progress-bar">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {bloques.map((bloque) => {
        if (bloque.tipo === 'superserie') {
          const vueltas = vueltasDeBloque(bloque)
          const hechas = rondasHechasBloque(bloque)
          const rondaActual = Math.min(hechas + 1, vueltas)
          const completa = hechas >= vueltas
          const expandido = Boolean(ssExpandidos[bloque.id])
          const nombres = bloque.items.map((it) => nombreDisplayEjercicio(it.nombre)).join(' + ')

          if (completa && !expandido) {
            return (
              <article key={bloque.id} className="fp-ex fp-ex--done fp-ex--compact fp-ss--done">
                <div className="fp-ex-done-inner fp-ex-done-inner--compact">
                  <span className="fp-ex-done-ico" aria-hidden><IconCheck /></span>
                  <div className="fp-ex-done-body">
                    <div className="fp-ex-done-top">
                      <span className="fp-ss-badge fp-ss-badge--sm"><IconBolt /> SS {bloque.label}</span>
                      <strong>{nombres}</strong>
                      <span className="fp-badge-done">OK</span>
                    </div>
                    <p className="fp-ex-done-sum mb-0">
                      {vueltas} vueltas · {bloque.items.map((it) => {
                        const ya = regsPorEjercicio[it.nombre] || []
                        const resumen = resumenRondasSs(ya)
                        if (!resumen) return null
                        return `${nombreDisplayEjercicio(it.nombre)} (${resumen})`
                      }).filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="fp-ex-done-actions">
                    <button
                      type="button"
                      className="fp-ex-done-icon"
                      onClick={() => setSsExpandidos((p) => ({ ...p, [bloque.id]: true }))}
                      aria-label="Editar superserie"
                      title="Editar"
                    >
                      <IconPencil />
                    </button>
                    <button
                      type="button"
                      className="fp-ex-done-icon is-danger"
                      onClick={() => limpiarSuperserie(bloque)}
                      aria-label="Quitar superserie"
                      title="Quitar"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              </article>
            )
          }

          return (
            <div key={bloque.id} className="fp-ss fp-ss--compact">
              <div className="fp-ss-head fp-ss-head--compact">
                <span className="fp-ss-badge"><IconBolt /> SS {bloque.label}</span>
                <span className="fp-ss-rest">{vueltas} vueltas · descanso {bloque.descansoPostRonda || 90}s</span>
              </div>
              <div className="fp-ss-track">
                {bloque.items.map((it, idx) =>
                  renderSuperserieItem(it, `${bloque.label}${idx + 1}`, idx, bloque, rondaActual)
                )}
              </div>
              <div className="fp-ss-foot">
                <span className="fp-ss-rondas">
                  Rondas completadas: <strong>{hechas} de {vueltas}</strong>
                </span>
                <div className="fp-ss-foot-actions">
                  {hechas > 0 && (
                    <button
                      type="button"
                      className="fp-ss-undo"
                      onClick={() => deshacerUltimaRonda(bloque)}
                    >
                      Deshacer última ronda
                    </button>
                  )}
                  {!completa && (
                    <button
                      type="button"
                      className="fp-ss-ronda-btn is-ghost"
                      onClick={() => completarSuperserieEntera(bloque)}
                    >
                      Completar superserie
                    </button>
                  )}
                  <button
                    type="button"
                    className="fp-ss-ronda-btn"
                    disabled={completa}
                    onClick={() => completarRonda(bloque)}
                  >
                    {completa ? 'Superserie completa' : `Completar Ronda ${rondaActual}`}
                  </button>
                  {expandido && (
                    <button
                      type="button"
                      className="fp-ex-done-icon is-danger"
                      onClick={() => limpiarSuperserie(bloque)}
                      aria-label="Quitar superserie"
                      title="Quitar"
                    >
                      <IconTrash />
                    </button>
                  )}
                  {expandido && completa && (
                    <button
                      type="button"
                      className="fp-ss-undo"
                      onClick={() => setSsExpandidos((p) => ({ ...p, [bloque.id]: false }))}
                    >
                      Comprimir
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        }
        const it = bloque.items[0]
        return renderTablaEjercicio(it, idxPorNombre[it.nombre] || 1)
      })}

      <div className="fp-sesion-foot">
        <p className="fp-sesion-autosave mb-0">
          Se guarda automáticamente al marcar cada serie o ronda.
          {(registrosDeEstaSesion || []).length > 0
            ? ` · ${(registrosDeEstaSesion || []).length} registro${(registrosDeEstaSesion || []).length === 1 ? '' : 's'} hoy`
            : ''}
        </p>
        <button
          type="button"
          className="fp-sesion-btn-ghost"
          onClick={() => onAnadirEjercicioExtra?.()}
        >
          + Añadir ejercicio extra a la sesión
        </button>
      </div>
    </div>
  )
}

export { IconDownload, IconCheck }
