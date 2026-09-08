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

function esCalentamientoItem(it) {
  const musculo = it?.grupoMuscular || etiquetaMusculo(it?.nombre)
  return musculo === 'Calentamiento'
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
              repeticiones: (it.repeticiones?.trim() || ant?.repeticiones || (esWarm ? '1' : '')).replace(/\s*reps?/i, ''),
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

  const guardarSerie = (it, serieNum) => {
    const key = `${it.nombre}::${serieNum}`
    const d = drafts[key] || {}
    const reps = String(d.repeticiones || '').trim()
    if (!reps) return
    const nota = (notas[it.nombre] || '').trim()
    const notaParts = []
    if (d.rpe) notaParts.push(`RPE ${d.rpe}`)
    if (nota) notaParts.push(nota)
    onGuardarSerie({
      ejercicio: it.nombre,
      series: 1,
      serieNum,
      repeticiones: reps,
      pesoKg: d.pesoKg,
      rpe: d.rpe !== '' && d.rpe != null ? Number(d.rpe) : undefined,
      notas: notaParts.join(' · '),
    })
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
    const kcal = ya.reduce((s, r) => s + caloriasQuemadasRegistroRutina(r, pesoCfg), 0)
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
        <article key={it.nombre} className={`fp-ex fp-ex--done${esWarm ? ' is-warm' : ''}`}>
          <div className="fp-ex-done-inner">
            <span className="fp-ex-done-ico" aria-hidden><IconCheck /></span>
            <div className="fp-ex-done-body">
              <div className="fp-ex-done-top">
                <span className="fp-ex-idx">{esWarm ? '0.' : `${idxNum}.`}</span>
                <strong>{titulo}</strong>
                <span className="fp-badge-done">Completado</span>
                <span className="fp-badge-soft">{labelTipo}</span>
              </div>
              <p className="fp-ex-done-sum mb-0">{resumen}</p>
            </div>
            <div className="fp-ex-done-side">
              <div className="fp-kcal-box">~{Math.max(kcal, esWarm ? 45 : kcal || 0)} kcal quemadas</div>
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
          </div>
        </article>
      )
    }

    // Calentamiento: una sola acción, sin tabla de series
    if (esWarm) {
      return (
        <article key={it.nombre} className="fp-ex fp-ex--warm">
          <div className="fp-ex-head">
            <span className="fp-ex-num">0</span>
            <div className="fp-ex-head-main">
              <div className="fp-ex-title-row">
                <h3 className="fp-ex-title">{titulo}</h3>
                <span className="fp-musculo">{musculo}</span>
              </div>
              <p className="fp-ex-obj mb-0">
                Objetivo:{' '}
                <strong>
                  {it.repeticiones?.trim() || 'Calentamiento dinámico · zona 2 + movilidad'}
                </strong>
              </p>
            </div>
          </div>
          <div className="fp-warm-box">
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
              <IconCheck /> Marcar calentamiento hecho
            </button>
          </div>
        </article>
      )
    }

    const primeraPendiente = Array.from({ length: nSeries }, (_, i) => i + 1).find(
      (s) => !registroHechoParaSerie(ya, s)
    )
    const hechosSeries = ya.filter((r) => r.serieNum != null).length || ya.length
    const puedeQuitarSerie = nSeries > Math.max(1, hechosSeries)

    return (
      <article key={it.nombre} className="fp-ex">
        <div className="fp-ex-head">
          <span className="fp-ex-num">{idxNum}</span>
          <div className="fp-ex-head-main">
            <div className="fp-ex-title-row">
              <h3 className="fp-ex-title">{titulo}</h3>
              <span className="fp-musculo">{musculo}</span>
            </div>
            <p className="fp-ex-obj mb-0">
              Objetivo:{' '}
              <strong>
                {nSeries} series × {it.repeticiones || '8–10'} reps
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

        <div className="fp-table-wrap">
          <table className="fp-table">
            <thead>
              <tr>
                <th>Serie</th>
                <th>Anterior</th>
                <th>Carga (kg)</th>
                <th>Repeticiones</th>
                <th>RPE / Esfuerzo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: nSeries }, (_, i) => {
                const serieNum = i + 1
                const hecho = registroHechoParaSerie(ya, serieNum)
                const ant = anteriorPorSerie(hist, serieNum)
                const key = `${it.nombre}::${serieNum}`
                const d = drafts[key] || { pesoKg: '', repeticiones: '', rpe: '' }
                const esActiva = !hecho && primeraPendiente === serieNum

                if (hecho) {
                  const rpe = rpeDeRegistro(hecho)
                  return (
                    <tr key={serieNum} className="fp-row is-done">
                      <td className="fp-td-num">{serieNum}</td>
                      <td className="fp-td-prev">{formatoAnterior(ant)}</td>
                      <td>
                        <span className="fp-cell-box">{hecho.pesoKg != null ? `${hecho.pesoKg} kg` : '—'}</span>
                      </td>
                      <td>
                        <span className="fp-cell-box">{hecho.repeticiones} reps</span>
                      </td>
                      <td>
                        {rpe != null ? <span className="fp-rpe-pill">RPE {rpe}</span> : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="fp-estado-hecho"
                          onClick={() => onEliminarRegistro(hecho.id)}
                          title="Desmarcar serie"
                        >
                          <IconCheck /> Hecho
                        </button>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={serieNum} className={esActiva ? 'fp-row is-active' : 'fp-row is-pending'}>
                    <td className="fp-td-num">{serieNum}</td>
                    <td className="fp-td-prev">{formatoAnterior(ant)}</td>
                    <td>
                      {esActiva ? (
                        <label className="fp-field">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={d.pesoKg}
                            onChange={(e) => patchDraft(it.nombre, serieNum, { pesoKg: e.target.value })}
                          />
                          <em>kg</em>
                        </label>
                      ) : <span className="fp-cell-box is-empty">—</span>}
                    </td>
                    <td>
                      {esActiva ? (
                        <label className="fp-field">
                          <input
                            type="text"
                            value={d.repeticiones}
                            onChange={(e) => patchDraft(it.nombre, serieNum, { repeticiones: e.target.value })}
                          />
                          <em>reps</em>
                        </label>
                      ) : <span className="fp-cell-box is-empty">—</span>}
                    </td>
                    <td>
                      {esActiva ? (
                        <label className="fp-rpe-select">
                          <select
                            value={d.rpe ?? ''}
                            onChange={(e) => patchDraft(it.nombre, serieNum, { rpe: e.target.value })}
                          >
                            <option value="">Sin RPE</option>
                            {RPE_OPTS.map((n) => (
                              <option key={n} value={n}>RPE {n}</option>
                            ))}
                          </select>
                        </label>
                      ) : <span className="fp-td-prev">—</span>}
                    </td>
                    <td>
                      {esActiva ? (
                        <button
                          type="button"
                          className="fp-btn-save"
                          onClick={() => guardarSerie(it, serieNum)}
                          disabled={!String(d.repeticiones || '').trim()}
                        >
                          Guardar Serie
                        </button>
                      ) : (
                        <span className="fp-estado-pend">Pendiente</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="fp-ex-foot">
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
        repeticiones: String(regActual.repeticiones || it.repeticiones || '10').replace(/\s*reps?/i, ''),
      }
    }
    const hist = historialDe(historialPorEjercicio, it.nombre)
    const ant = anteriorPorSerie(hist, ronda)
    return ssDrafts[draftKey] || {
      pesoKg: pesoKgSugerido(it, hist, ronda),
      repeticiones: (it.repeticiones || ant?.repeticiones || '10').toString().replace(/\s*reps?/i, ''),
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

  const guardarUnaOVarias = (lista) => {
    if (!lista?.length) return
    if (lista.length === 1) onGuardarSerie(lista[0])
    else if (onGuardarSeries) onGuardarSeries(lista)
    else lista.forEach((s) => onGuardarSerie(s))
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
    const hist = historialDe(historialPorEjercicio, it.nombre)
    const ant = anteriorPorSerie(hist, rondaActual)
    const draftKey = `${bloque.id}::${it.nombre}::${rondaActual}`
    const d = draftSsDe(bloque.id, it, rondaActual)
    const checked = ejercicioSsCompleto(it, vueltas)
    const parcial = !checked && ya.length > 0
    const esPesoCorporal = /plancha|elevaciones? de piernas|peso\s*corporal|abdominal|core/i.test(it.nombre)
      && !/mancuerna|barra|kg/i.test(it.nombre)
    const cargaPlan = it.carga?.trim() ? ` · Sugerido: ${it.carga}` : ''
    const hintExtra = ant?.pesoKg != null ? ` (ref. sesión ant.: ${ant.pesoKg} kg)` : ''
    const rondasHechasTxt = resumenRondasSs(ya)

    return (
      <div key={it.nombre} className={`fp-ss-item${checked ? ' is-done' : ''}${parcial ? ' is-partial' : ''}`}>
        {idx > 0 && <p className="fp-ss-join">↓ Combinado de inmediato con:</p>}
        <div className="fp-ss-row">
          <span className="fp-ss-dot" aria-hidden />
          <div className="fp-ss-copy">
            <span className="fp-ss-label">Ejercicio {label}</span>
            <strong className="fp-ss-name">{nombreDisplayEjercicio(it.nombre)}</strong>
            <span className="fp-ss-hint">
              {vueltas} vueltas × {it.repeticiones || '10'} reps sugeridas{cargaPlan}{hintExtra}
            </span>
            {rondasHechasTxt ? (
              <span className="fp-ss-hint fp-ss-hint--done">{rondasHechasTxt}</span>
            ) : null}
            {!checked ? (
              <span className="fp-ss-hint fp-ss-hint--round">Ronda {rondaActual}: cargá el peso de esta vuelta</span>
            ) : null}
          </div>
          <div className="fp-ss-log">
            {esPesoCorporal && !d.pesoKg ? (
              <span className="fp-ss-pill">Peso Corporal</span>
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
                  placeholder="—"
                  aria-label="Peso kg"
                />
                <span>kg ×</span>
                <input
                  type="text"
                  value={d.repeticiones}
                  onChange={(e) => setSsDrafts((p) => ({
                    ...p,
                    [draftKey]: { ...d, repeticiones: e.target.value },
                  }))}
                  placeholder="—"
                  aria-label="Repeticiones"
                />
                <span>reps</span>
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
    <div className="fp-sesion">
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
          const labels = bloque.items.map((_, i) => `${bloque.label}${i + 1}`)
          const hechas = rondasHechasBloque(bloque)
          const rondaActual = Math.min(hechas + 1, vueltas)
          const completa = hechas >= vueltas
          const labelJoin = labels.length >= 2 ? `${labels[0]} y ${labels[1]}` : labels[0]
          const expandido = Boolean(ssExpandidos[bloque.id])
          const nombres = bloque.items.map((it) => nombreDisplayEjercicio(it.nombre)).join(' + ')
          const kcalSs = bloque.items.reduce((sum, it) => {
            const ya = regsPorEjercicio[it.nombre] || []
            return sum + ya.reduce((s, r) => s + caloriasQuemadasRegistroRutina(r, pesoCfg), 0)
          }, 0)

          if (completa && !expandido) {
            return (
              <article key={bloque.id} className="fp-ex fp-ex--done fp-ss--done">
                <div className="fp-ex-done-inner">
                  <span className="fp-ex-done-ico" aria-hidden><IconCheck /></span>
                  <div className="fp-ex-done-body">
                    <div className="fp-ex-done-top">
                      <span className="fp-ss-badge fp-ss-badge--sm"><IconBolt /> Superserie {bloque.label}</span>
                      <strong>{nombres}</strong>
                      <span className="fp-badge-done">Completado</span>
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
                  <div className="fp-ex-done-side">
                    <div className="fp-kcal-box">~{Math.max(kcalSs, 40)} kcal quemadas</div>
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
                </div>
              </article>
            )
          }

          return (
            <div key={bloque.id} className="fp-ss">
              <div className="fp-ss-head">
                <span className="fp-ss-badge"><IconBolt /> Superserie {bloque.label}</span>
                <p className="fp-ss-copy-line mb-0">
                  {vueltas} Vueltas continuas sin descanso entre {labelJoin}
                </p>
                <span className="fp-ss-rest">
                  Descanso post-ronda: {bloque.descansoPostRonda || 90} seg
                </span>
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
