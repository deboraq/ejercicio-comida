import { useMemo, useState, useId } from 'react'
import {
  PERIODOS_PROGRESO,
  rangoProgreso,
  filtrarRegistrosRango,
  listaEjerciciosConProgreso,
  seriesDiariasEjercicio,
  marcarPRs,
  resumenKpisEjercicio,
  progresionPorEjercicio,
  distribucionMuscular,
  totalSeriesRegistros,
  seriesPorSemana,
  rpePromedio,
  sugerenciaSobrecarga,
  formatearFechaCorta,
  formatearFechaLarga,
  formatearFechaMedia,
} from '../utils/progresoCargas'
import { fechaToISO } from '../utils/calorias'
import { nombreDisplayPlan } from '../utils/rutinaEjercicioDia'

function IconBolt() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 4 14h7l-1 8 10-14h-7l1-6z" />
    </svg>
  )
}

function IconTrophy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 4h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4M7 4H5a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4" strokeLinecap="round" />
    </svg>
  )
}

function IconBulb() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Sparkline({ values = [], tone = 'blue', width = 112, height = 34 }) {
  const gradId = useId().replace(/:/g, '')
  if (!values.length) return <svg width={width} height={height} className="pc-spark" aria-hidden />

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 3
  const coords = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2)
    const y = height - pad - ((v - min) / span) * (height - pad * 2)
    return { x, y }
  })

  const stroke = {
    green: '#34d399',
    violet: '#a78bfa',
    blue: '#60a5fa',
    amber: '#fbbf24',
  }[tone] || '#60a5fa'

  const fill = {
    green: '#34d399',
    violet: '#a78bfa',
    blue: '#60a5fa',
    amber: '#fbbf24',
  }[tone] || '#60a5fa'

  let lineD = `M${coords[0].x},${coords[0].y}`
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1]
    const curr = coords[i]
    const dx = (curr.x - prev.x) * 0.45
    lineD += ` C${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`
  }
  const last = coords[coords.length - 1]
  const first = coords[0]
  const areaD = `${lineD} L${last.x},${height - 1} L${first.x},${height - 1} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="pc-spark" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.35" />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </linearGradient>
        <filter id={`${gradId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path
        d={lineD}
        fill="none"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${gradId}-glow)`}
      />
    </svg>
  )
}

function IconChartLine() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="m7 14 4-5 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconChartBars() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 17V11M12 17V8M16 17v-4" strokeLinecap="round" />
    </svg>
  )
}

/** Puntos válidos {x,y,i} para una serie */
function puntosSerie(data, key, xAt, yAt) {
  return data
    .map((p, i) => (p[key] != null ? { x: xAt(i), y: yAt(p[key]), i } : null))
    .filter(Boolean)
}

/**
 * Spline cúbica (Catmull-Rom → Bezier).
 * Curvas suaves tipo mock, no segmentos rectos.
 */
function buildCurvePath(pts) {
  if (!pts.length) return ''
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`
  if (pts.length === 2) {
    const [a, b] = pts
    const dx = (b.x - a.x) * 0.45
    return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`
  }

  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

function buildCurvePathSlice(pts, fromIdx, toIdx) {
  const slice = pts.filter((p) => p.i >= fromIdx && p.i <= toIdx)
  return buildCurvePath(slice)
}

function buildSmoothArea(data, key, xAt, yAt, yBase) {
  const pts = puntosSerie(data, key, xAt, yAt)
  if (!pts.length) return ''
  const curve = buildCurvePath(pts)
  const last = pts[pts.length - 1]
  const first = pts[0]
  return `${curve} L${last.x},${yAt(yBase)} L${first.x},${yAt(yBase)} Z`
}

/** Relleno entre dos curvas (p. ej. 1RM → carga), como el mock. */
function buildSmoothAreaBetween(data, keyTop, keyBottom, xAt, yAt, yFloor) {
  const indices = data
    .map((p, i) => (p[keyTop] != null ? i : null))
    .filter((i) => i != null)
  if (!indices.length) return ''

  const topPts = indices.map((i) => ({
    x: xAt(i),
    y: yAt(data[i][keyTop]),
    i,
  }))
  const bottomRev = [...indices].reverse().map((i) => ({
    x: xAt(i),
    y: data[i][keyBottom] != null ? yAt(data[i][keyBottom]) : yAt(yFloor),
    i,
  }))

  const topCurve = buildCurvePath(topPts)
  const bottomCurve = buildCurvePath(bottomRev).replace(/^M/, 'L')
  return `${topCurve} ${bottomCurve} Z`
}

function ChartProgresion({ puntos = [], metaKg = null, metaSesion = null, stats = null }) {
  const [hover, setHover] = useState(null)
  const [modo, setModo] = useState('linea')
  const W = 900
  const H = 320
  const pad = { t: 22, r: 36, b: 16, l: 52 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  const data = useMemo(() => {
    const base = [...(puntos || [])]
    if (base.length < 1) return base
    const last = base[base.length - 1]
    if (last?.carga == null) return base
    const proyCarga = Math.round((last.carga + 2.5) * 2) / 2
    const proyRm = last.rm != null
      ? Math.round((last.rm + (proyCarga - last.carga)) * 10) / 10
      : null
    const d = new Date(`${last.fecha}T12:00:00`)
    d.setDate(d.getDate() + 3)
    const fechaProy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return [
      ...base,
      {
        fecha: fechaProy,
        carga: proyCarga,
        rm: proyRm,
        volumen: 0,
        reps: last.reps,
        rpe: null,
        esPr: false,
        esProyeccion: true,
      },
    ]
  }, [puntos])

  // Hover inicial en el PR (como el mock)
  const defaultHover = useMemo(() => {
    const pr = data.findIndex((p) => p.esPr && !p.esProyeccion)
    if (pr >= 0) return pr
    for (let i = data.length - 1; i >= 0; i--) {
      if (!data[i].esProyeccion) return i
    }
    return data.length ? 0 : null
  }, [data])

  const active = hover != null ? hover : defaultHover

  const ys = data.flatMap((p) => [p.carga, p.rm]).filter((v) => v != null && v > 0)
  if (metaKg) ys.push(metaKg)
  const yMaxRaw = ys.length ? Math.max(...ys) : 50
  const yMax = Math.max(10, Math.ceil((yMaxRaw * 1.08) / 10) * 10)
  const yMin = 0

  const xAt = (i) => pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const yAt = (v) => pad.t + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH

  const yTicks = []
  for (let t = 10; t <= yMax; t += 10) yTicks.push(t)

  const lastRealIdx = (() => {
    for (let i = data.length - 1; i >= 0; i--) {
      if (!data[i].esProyeccion) return i
    }
    return data.length - 1
  })()

  const onMove = (e) => {
    if (!data.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    let bestDist = Infinity
    data.forEach((_, i) => {
      const dist = Math.abs(xAt(i) - x)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    setHover(best)
  }

  const h = active != null ? data[active] : null
  const deltaRm = (() => {
    if (active == null || h?.rm == null) return null
    for (let i = active - 1; i >= 0; i--) {
      if (data[i]?.rm != null && !data[i].esProyeccion) {
        return Math.round((h.rm - data[i].rm) * 10) / 10
      }
    }
    return null
  })()

  const tipLeft = h
    ? Math.min(Math.max((xAt(active) / W) * 100 - 14, 2), 66)
    : 0

  const rpeLabel = (rpe) => {
    if (rpe == null) return null
    if (rpe >= 7.5 && rpe <= 9) return 'Óptimo'
    if (rpe < 7.5) return 'Fácil'
    return 'Alto'
  }

  const labelIndices = (() => {
    if (data.length <= 8) return data.map((_, i) => i)
    const set = new Set([0, lastRealIdx, data.length - 1])
    data.forEach((p, i) => {
      if (p.esPr || p.esProyeccion) set.add(i)
    })
    const step = Math.ceil(data.length / 6)
    for (let i = 0; i < data.length; i += step) set.add(i)
    return [...set].sort((a, b) => a - b)
  })()

  const rmPts = puntosSerie(data, 'rm', xAt, yAt)
  const cargaPts = puntosSerie(data, 'carga', xAt, yAt)

  const xAxisStyle = {
    '--pc-x-cols': data.length,
    '--pc-x-pl': `${(pad.l / W) * 100}%`,
    '--pc-x-pr': `${(pad.r / W) * 100}%`,
  }

  const legendAndModes = (
    <div className="pc-chart-head-right">
      <div className="pc-chart-legend-top">
        <span><i className="pc-leg-dot is-rm" /> 1RM Est.</span>
        <span><i className="pc-leg-dot is-carga" /> Carga Real</span>
        {metaKg != null && (
          <span><i className="pc-leg-meta" /> Meta Mes ({metaKg}kg)</span>
        )}
      </div>
      <div className="pc-chart-modes" role="group" aria-label="Tipo de gráfico">
        <button
          type="button"
          className={`pc-chart-mode${modo === 'linea' ? ' is-active' : ''}`}
          onClick={() => setModo('linea')}
          title="Líneas"
          aria-pressed={modo === 'linea'}
        >
          <IconChartLine />
        </button>
        <button
          type="button"
          className={`pc-chart-mode${modo === 'barras' ? ' is-active' : ''}`}
          onClick={() => setModo('barras')}
          title="Barras"
          aria-pressed={modo === 'barras'}
        >
          <IconChartBars />
        </button>
      </div>
    </div>
  )

  return (
    <div className="pc-chart-block">
      <div className="pc-chart-head">
        <div className="pc-chart-head-left">
          <div className="pc-title-row">
            <h2 className="pc-panel-title">Curva de Sobrecarga Progresiva &amp; 1RM Estimada</h2>
            <span className="pc-badge-live">Interactivo</span>
          </div>
          <p className="pc-panel-sub mb-0">
            Comparativa de carga efectiva levantada (kg) vs proyección teórica de fuerza máxima por sesión.
          </p>
        </div>
        {legendAndModes}
      </div>

      <div className="pc-chart-wrap">
        <svg
          className="pc-chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Curva de sobrecarga progresiva"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="pcGradRm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.22" />
              <stop offset="35%" stopColor="#3b82f6" stopOpacity="0.12" />
              <stop offset="68%" stopColor="#2563eb" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#1e40af" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="pcGradCarga" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.16" />
              <stop offset="42%" stopColor="#a78bfa" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
            <filter id="pcGlowRm" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={yAt(t)}
                y2={yAt(t)}
                className="pc-chart-grid"
              />
              <text x={pad.l - 10} y={yAt(t) + 4} className="pc-chart-axis" textAnchor="end">
                {t} kg
              </text>
            </g>
          ))}

          {metaKg != null && metaKg > 0 && metaKg <= yMax && (
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={yAt(metaKg)}
              y2={yAt(metaKg)}
              className="pc-chart-meta"
            />
          )}

          {modo === 'linea' && data.length > 0 && (
            <>
              <path
                d={buildSmoothArea(data, 'carga', xAt, yAt, yMin)}
                className="pc-chart-area-carga"
                fill="url(#pcGradCarga)"
              />
              <path
                d={buildSmoothAreaBetween(data, 'rm', 'carga', xAt, yAt, yMin)}
                className="pc-chart-area-rm"
                fill="url(#pcGradRm)"
              />

              <path
                d={buildCurvePathSlice(rmPts, 0, lastRealIdx)}
                className="pc-chart-line-rm"
                fill="none"
                filter="url(#pcGlowRm)"
              />
              {lastRealIdx < data.length - 1 && (
                <path
                  d={buildCurvePathSlice(rmPts, lastRealIdx, data.length - 1)}
                  className="pc-chart-line-rm is-proy-line"
                  fill="none"
                />
              )}

              <path
                d={buildCurvePathSlice(cargaPts, 0, lastRealIdx)}
                className="pc-chart-line-carga"
                fill="none"
              />
              {lastRealIdx < data.length - 1 && (
                <path
                  d={buildCurvePathSlice(cargaPts, lastRealIdx, data.length - 1)}
                  className="pc-chart-line-carga is-proy-line"
                  fill="none"
                />
              )}

              {data.map((p, i) =>
                p.rm != null ? (
                  <circle
                    key={`rm-${p.fecha}`}
                    cx={xAt(i)}
                    cy={yAt(p.rm)}
                    r={active === i ? 7 : 5}
                    className={`pc-chart-dot-rm${p.esProyeccion ? ' is-proy' : ''}${active === i ? ' is-hover' : ''}`}
                  />
                ) : null
              )}
              {data.map((p, i) =>
                p.carga != null ? (
                  <circle
                    key={`c-${p.fecha}`}
                    cx={xAt(i)}
                    cy={yAt(p.carga)}
                    r={active === i ? 5 : 3.5}
                    className={`pc-chart-dot-carga${p.esProyeccion ? ' is-proy' : ''}${active === i ? ' is-hover' : ''}`}
                  />
                ) : null
              )}
            </>
          )}

          {modo === 'barras' && data.length > 0 && data.map((p, i) => {
            if (p.carga == null) return null
            const bw = Math.min(24, innerW / Math.max(data.length, 1) * 0.42)
            const x = xAt(i) - bw / 2
            const y = yAt(p.carga)
            const hBar = yAt(yMin) - y
            return (
              <g key={`bar-${p.fecha}`} opacity={p.esProyeccion ? 0.45 : 1}>
                <rect x={x} y={y} width={bw} height={Math.max(hBar, 0)} rx="4" className="pc-chart-bar-carga" />
                {p.rm != null && (
                  <circle cx={xAt(i)} cy={yAt(p.rm)} r="4" className="pc-chart-dot-rm" />
                )}
              </g>
            )
          })}

          {h && (
            <line
              x1={xAt(active)}
              x2={xAt(active)}
              y1={pad.t}
              y2={H - 2}
              className="pc-chart-cross"
            />
          )}
        </svg>

        {h && (
          <div className="pc-tip" style={{ left: `${tipLeft}%` }}>
            <p className="pc-tip-title mb-0">
              <i className={h.esPr ? 'is-pr' : h.esProyeccion ? 'is-proy' : ''} />
              {formatearFechaLarga(h.fecha)}
              {h.esPr ? ' (Récord Personal)' : ''}
              {h.esProyeccion ? ' (Proyección)' : ''}
            </p>
            <p className="pc-tip-row mb-0">
              Carga levantada:{' '}
              <strong>
                {h.carga != null ? `${h.carga} kg` : '—'}
                {h.reps ? ` × ${h.reps} reps` : ''}
              </strong>
            </p>
            <p className="pc-tip-row mb-0">
              1RM Estimada:{' '}
              <strong className="is-rm">
                {h.rm != null ? `${h.rm} kg` : '—'}
              </strong>
              {deltaRm != null && deltaRm !== 0 && (
                <span className="is-delta"> ({deltaRm > 0 ? '+' : ''}{deltaRm} kg)</span>
              )}
            </p>
            {h.rpe != null && (
              <p className="pc-tip-row mb-0">
                RPE / Esfuerzo:{' '}
                <strong>
                  {h.rpe.toFixed(1)}
                  {rpeLabel(h.rpe) ? (
                    <span className="is-opt"> ({rpeLabel(h.rpe)})</span>
                  ) : null}
                </strong>
              </p>
            )}
          </div>
        )}

        {!data.length && (
          <p className="pc-chart-empty mb-0">Sin datos de carga en este período. Registrá series con peso para ver la curva.</p>
        )}
      </div>

      {data.length > 0 && (
        <div className="pc-chart-xaxis" style={xAxisStyle}>
          {data.map((p, i) => (
            <span key={`xl-${p.fecha}`} className="pc-xcell">
              {labelIndices.includes(i) ? (
                p.esPr ? (
                  <span className="pc-xchip is-pr">
                    {formatearFechaCorta(p.fecha)} (PR {p.carga} kg)
                  </span>
                ) : p.esProyeccion ? (
                  <span className="pc-xchip is-proy">
                    {formatearFechaCorta(p.fecha)} (Proyección)
                  </span>
                ) : (
                  <span className="pc-xchip">
                    {formatearFechaCorta(p.fecha)}
                    {p.carga != null ? ` (${p.carga} kg)` : ''}
                  </span>
                )
              ) : null}
            </span>
          ))}
        </div>
      )}

      {(metaSesion || stats) && (
        <div className="pc-chart-stats">
          <article className="pc-stat">
            <p className="pc-stat-label mb-0">Sobrecarga Total en {stats?.periodoLabel || '30D'}</p>
            <p className={`pc-stat-value mb-0 ${stats?.deltaCarga != null && stats.deltaCarga >= 0 ? 'is-up' : 'is-down'}`}>
              {stats?.deltaCarga != null
                ? `${stats.deltaCarga >= 0 ? '↑ +' : '↓ '}${Math.abs(stats.deltaCarga).toFixed(1)} kg${stats.pctCarga != null ? ` (${stats.pctCarga >= 0 ? '+' : ''}${stats.pctCarga}%)` : ''}`
                : '—'}
            </p>
          </article>
          <article className="pc-stat">
            <p className="pc-stat-label mb-0">Volumen por Sesión</p>
            <p className="pc-stat-value mb-0">
              {stats?.volSesion != null
                ? `${Math.round(stats.volSesion).toLocaleString('es-AR')} kg avg`
                : '—'}
            </p>
          </article>
          <article className="pc-stat">
            <p className="pc-stat-label mb-0">Repeticiones en RIR 2</p>
            <p className="pc-stat-value mb-0 is-blue">
              {stats?.pctEfectivas != null ? `${stats.pctEfectivas}% Efectivas` : '—'}
            </p>
          </article>
          <article className="pc-stat pc-stat--meta">
            <p className="pc-stat-label mb-0">Meta Siguiente Sesión</p>
            <p className="pc-stat-value mb-0 is-gold">
              {metaSesion
                ? `${metaSesion.carga} kg × ${metaSesion.reps || 6} reps`
                : '—'}
            </p>
          </article>
        </div>
      )}
    </div>
  )
}

/**
 * Dashboard Titanium: Progreso & Cargas
 */
export default function ProgresoCargasTitanium({
  registros = [],
  ejerciciosPlan = [],
  onAplicarSugerencia,
}) {
  const hoy = fechaToISO(new Date())
  const ejerciciosDisponibles = useMemo(() => {
    const fromRegs = listaEjerciciosConProgreso(registros)
    const names = new Set(fromRegs.map((e) => e.nombre))
    for (const n of ejerciciosPlan || []) {
      if (n && !names.has(n)) {
        fromRegs.push({ nombre: n, count: 0, last: '' })
        names.add(n)
      }
    }
    return fromRegs
  }, [registros, ejerciciosPlan])

  const [ejercicio, setEjercicio] = useState(() => ejerciciosDisponibles[0]?.nombre || '')
  const [periodo, setPeriodo] = useState('30d')

  // Si cambia la lista y el seleccionado desaparece, re-seleccionar
  const ejercicioActivo = useMemo(() => {
    if (ejercicio && ejerciciosDisponibles.some((e) => e.nombre === ejercicio)) return ejercicio
    return ejerciciosDisponibles[0]?.nombre || ''
  }, [ejercicio, ejerciciosDisponibles])

  const { desde, hasta, dias } = useMemo(() => rangoProgreso(periodo, hoy), [periodo, hoy])
  const prevRango = useMemo(() => {
    const d = new Date(`${desde}T12:00:00`)
    d.setDate(d.getDate() - 1)
    const hastaPrev = fechaToISO(d)
    const d2 = new Date(`${hastaPrev}T12:00:00`)
    d2.setDate(d2.getDate() - (dias - 1))
    return { desde: fechaToISO(d2), hasta: hastaPrev }
  }, [desde, dias])

  const regsPeriodo = useMemo(() => filtrarRegistrosRango(registros, desde, hasta), [registros, desde, hasta])
  const regsPrev = useMemo(
    () => filtrarRegistrosRango(registros, prevRango.desde, prevRango.hasta),
    [registros, prevRango]
  )
  const regsEj = useMemo(
    () => regsPeriodo.filter((r) => r.ejercicio === ejercicioActivo),
    [regsPeriodo, ejercicioActivo]
  )
  const regsEjPrev = useMemo(
    () => regsPrev.filter((r) => r.ejercicio === ejercicioActivo),
    [regsPrev, ejercicioActivo]
  )

  const puntos = useMemo(
    () => marcarPRs(seriesDiariasEjercicio(regsEj, ejercicioActivo)),
    [regsEj, ejercicioActivo]
  )
  const puntosPrev = useMemo(
    () => seriesDiariasEjercicio(regsEjPrev, ejercicioActivo),
    [regsEjPrev, ejercicioActivo]
  )
  const kpis = useMemo(() => resumenKpisEjercicio(puntos, puntosPrev), [puntos, puntosPrev])
  const metaKg = useMemo(() => {
    if (kpis.cargaMax == null) return null
    return Math.round((kpis.cargaMax + 2.5) * 2) / 2
  }, [kpis.cargaMax])

  const [verTodosProg, setVerTodosProg] = useState(false)

  const progresionAll = useMemo(() => progresionPorEjercicio(regsPeriodo, 50), [regsPeriodo])
  const progresion = useMemo(
    () => (verTodosProg ? progresionAll : progresionAll.slice(0, 4)),
    [progresionAll, verTodosProg]
  )
  const dist = useMemo(() => distribucionMuscular(regsPeriodo), [regsPeriodo])
  const rpeAvg = useMemo(() => rpePromedio(regsPeriodo), [regsPeriodo])
  const seriesSemana = useMemo(() => seriesPorSemana(regsPeriodo, dias), [regsPeriodo, dias])
  const totalProgramados = useMemo(() => {
    if ((ejerciciosPlan || []).length) return ejerciciosPlan.length
    return ejerciciosDisponibles.length
  }, [ejerciciosPlan, ejerciciosDisponibles])
  const ejerciciosConPr = useMemo(
    () => progresionAll.filter((p) => p.pct > 0).length,
    [progresionAll]
  )
  const sug = useMemo(
    () => sugerenciaSobrecarga(puntos, ejercicioActivo),
    [puntos, ejercicioActivo]
  )

  const metaSesion = useMemo(() => {
    const last = [...puntos].reverse().find((p) => p.carga != null)
    const carga = sug.cargaSugerida ?? (last?.carga != null
      ? Math.round((last.carga + 2.5) * 2) / 2
      : null)
    if (carga == null) return null
    return { carga, reps: last?.reps || 6 }
  }, [puntos, sug])

  const chartStats = useMemo(() => {
    const conCarga = puntos.filter((p) => p.carga != null)
    const first = conCarga[0]
    const last = conCarga[conCarga.length - 1]
    let deltaCarga = null
    let pctCarga = null
    if (first?.carga != null && last?.carga != null && conCarga.length >= 2) {
      deltaCarga = Math.round((last.carga - first.carga) * 10) / 10
      pctCarga = first.carga > 0
        ? Math.round(((last.carga - first.carga) / first.carga) * 100)
        : null
    }
    const volSesion = conCarga.length
      ? conCarga.reduce((s, p) => s + (p.volumen || 0), 0) / conCarga.length
      : null
    const conRpe = puntos.filter((p) => p.rpe != null)
    const efectivas = conRpe.filter((p) => p.rpe >= 7 && p.rpe <= 9).length
    const pctEfectivas = conRpe.length
      ? Math.round((efectivas / conRpe.length) * 100)
      : (kpis.adherencia != null ? kpis.adherencia : null)
    const periodoLabel = ({
      '7d': '7D',
      '30d': '30D',
      '3m': '3M',
      '6m': '6M',
      '1y': '1A',
    })[periodo] || '30D'
    return { deltaCarga, pctCarga, volSesion, pctEfectivas, periodoLabel }
  }, [puntos, periodo, kpis.adherencia])

  const chips = useMemo(() => {
    const planSet = new Set(ejerciciosPlan || [])
    const preferidos = ejerciciosDisponibles.filter((e) => planSet.has(e.nombre))
    const base = (preferidos.length ? preferidos : ejerciciosDisponibles)
      .filter((e) => e.nombre !== ejercicioActivo)
      .slice(0, 2)
    return base.map((e) => {
      const full = nombreDisplayPlan(e.nombre)
      const short = full
        .replace(/\s*\(.*?\)\s*/g, '')
        .replace(/^Superseriado con:\s*/i, '')
        .split(/[:–-]/)[0]
        .trim()
      return {
        ...e,
        label: short.length > 16 ? `${short.slice(0, 14)}…` : short || full,
      }
    })
  }, [ejerciciosDisponibles, ejerciciosPlan, ejercicioActivo])

  const rangoLabel = `${formatearFechaMedia(desde)} — ${formatearFechaMedia(hasta)}`

  const adherenciaLabel = (() => {
    if (kpis.adherencia == null) return 'Sin datos aún'
    if (kpis.adherencia >= 85) return 'Excelente ritmo de adaptación neuromuscular'
    if (kpis.adherencia >= 60) return 'Buen ritmo; mantené la constancia'
    return 'Hay huecos: priorizá no bajar la carga'
  })()

  const lastPt = useMemo(
    () => [...puntos].reverse().find((p) => p.carga != null),
    [puntos]
  )

  const sugDelta = useMemo(() => {
    if (sug.cargaSugerida == null || lastPt?.carga == null) return null
    return Math.round((sug.cargaSugerida - lastPt.carga) * 10) / 10
  }, [sug, lastPt])

  return (
    <div className="pc-dash">
      <div className="pc-toolbar">
        <div className="pc-tb-left">
          <div className="pc-ex-line">
            <span className="pc-label-inline">Ejercicio analizado:</span>
            <div className="pc-select-wrap">
              <select
                id="pc-ex"
                className="pc-select"
                value={ejercicioActivo}
                onChange={(e) => setEjercicio(e.target.value)}
                aria-label="Ejercicio analizado"
              >
                {ejerciciosDisponibles.length === 0 && <option value="">Sin ejercicios</option>}
                {ejerciciosDisponibles.map((e) => (
                  <option key={e.nombre} value={e.nombre}>
                    {nombreDisplayPlan(e.nombre)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pc-rapidos">
            <span className="pc-rapidos-label">Rápidos:</span>
            {chips.map((c) => (
              <button
                key={c.nombre}
                type="button"
                className="pc-chip"
                onClick={() => setEjercicio(c.nombre)}
                title={nombreDisplayPlan(c.nombre)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pc-tb-right">
          <div className="pc-periods" role="group" aria-label="Período">
            {PERIODOS_PROGRESO.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`pc-period${periodo === p.value ? ' is-active' : ''}`}
                onClick={() => setPeriodo(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="pc-rango mb-0">{rangoLabel}</p>
        </div>
      </div>

      <div className="pc-kpis">
        <article className="pc-kpi pc-kpi--rm">
          <div className="pc-kpi-top">
            <p className="pc-kpi-label mb-0">1RM Estimada (PR)</p>
            <span className="pc-kpi-ico is-blue"><IconBolt /></span>
          </div>
          <div className="pc-kpi-value-row">
            <p className="pc-kpi-value mb-0">
              {kpis.rmMax != null ? (
                <>
                  <span>{Number(kpis.rmMax).toFixed(1)}</span>
                  <span className="pc-kpi-unit">kg</span>
                </>
              ) : '—'}
            </p>
            {kpis.deltaRm != null && kpis.deltaRm !== 0 ? (
              <span className={`pc-badge ${kpis.deltaRm > 0 ? 'is-up' : 'is-down'}`}>
                {kpis.deltaRm > 0 ? '↑ +' : '↓ '}{Math.abs(kpis.deltaRm)} kg
              </span>
            ) : null}
          </div>
          <p className="pc-kpi-foot-line mb-0">
            {kpis.pctRm != null ? (
              <>
                <span className={kpis.pctRm >= 0 ? 'is-up' : 'is-down'}>
                  {kpis.pctRm > 0 ? '+' : ''}{kpis.pctRm}%
                </span>
                {' '}vs mes anterior (fórmula Brzycki)
              </>
            ) : kpis.rmMax != null ? (
              'vs mes anterior (fórmula Brzycki)'
            ) : (
              'Sin baseline · vs mes anterior (fórmula Brzycki)'
            )}
          </p>
        </article>

        <article className="pc-kpi pc-kpi--carga">
          <div className="pc-kpi-top">
            <p className="pc-kpi-label mb-0">Carga máx. levantada</p>
            <span className="pc-kpi-ico is-violet"><IconTrophy /></span>
          </div>
          <div className="pc-kpi-value-row">
            <p className="pc-kpi-value mb-0">
              {kpis.cargaMax != null ? (
                <>
                  <span>{Number(kpis.cargaMax).toFixed(1)}</span>
                  <span className="pc-kpi-unit">kg</span>
                </>
              ) : '—'}
            </p>
            {kpis.cargaMax != null ? (
              <span className="pc-badge is-pr">PR ACTUAL</span>
            ) : null}
          </div>
          <p className="pc-kpi-foot-line mb-0">
            {kpis.fechaPr
              ? `Alcanzado el ${formatearFechaLarga(kpis.fechaPr)}`
              : 'Sin registros'}
          </p>
        </article>

        <article className="pc-kpi pc-kpi--vol">
          <div className="pc-kpi-top">
            <p className="pc-kpi-label mb-0">Volumen acumulado</p>
            <span className="pc-kpi-ico is-green" aria-hidden>↗</span>
          </div>
          <div className="pc-kpi-value-row">
            <p className="pc-kpi-value mb-0">
              <span>
                {kpis.volumen > 0
                  ? Math.round(kpis.volumen).toLocaleString('es-AR')
                  : '0'}
              </span>
              <span className="pc-kpi-unit">kg</span>
            </p>
            {kpis.pctVol != null && (
              <span className={`pc-badge-round ${kpis.pctVol >= 0 ? 'is-up' : 'is-down'}`}>
                <span className="pc-badge-arrow" aria-hidden>{kpis.pctVol >= 0 ? '↑' : '↓'}</span>
                <span>{kpis.pctVol > 0 ? '+' : ''}{Math.abs(kpis.pctVol)}%</span>
              </span>
            )}
          </div>
          <p className="pc-kpi-foot-line mb-0">Sobrecarga progresiva de tonelaje total</p>
        </article>

        <article className="pc-kpi pc-kpi--adh">
          <div className="pc-kpi-top">
            <p className="pc-kpi-label mb-0">Adherencia de sobrecarga</p>
            <span className="pc-kpi-ico is-amber" aria-hidden>✓</span>
          </div>
          <div className="pc-kpi-value-row">
            <p className="pc-kpi-value mb-0">
              {kpis.adherencia != null ? (
                <>
                  <span>{kpis.adherencia}</span>
                  <span className="pc-kpi-unit">%</span>
                </>
              ) : '—'}
            </p>
            <span className="pc-kpi-side">
              {kpis.sesionesComparables > 0
                ? `${kpis.sesionesConProgreso} de ${kpis.sesionesComparables} Sesiones`
                : `${kpis.sesiones || 0} Sesiones`}
            </span>
          </div>
          <p className="pc-kpi-foot-line mb-0">
            <span className="is-up">{adherenciaLabel.split(' ')[0]}</span>
            {' '}{adherenciaLabel.split(' ').slice(1).join(' ')}
          </p>
        </article>
      </div>

      <section className="pc-panel pc-panel--chart">
        <ChartProgresion
          puntos={puntos}
          metaKg={metaKg}
          metaSesion={metaSesion}
          stats={chartStats}
        />
      </section>

      <div className="pc-grid">
        <section className="pc-panel pc-panel--prog">
          <div className="pc-panel-head pc-panel-head--stack">
            <div>
              <h2 className="pc-panel-title">Progresión por Ejercicio en tu Rutina</h2>
              <p className="pc-panel-sub mb-0">
                Historial comparativo de carga inicial vs carga récord (PR).
              </p>
            </div>
            {ejerciciosConPr > 0 && (
              <span className="pc-badge is-up">
                {ejerciciosConPr} Ejercicio{ejerciciosConPr === 1 ? '' : 's'} con PR
              </span>
            )}
          </div>
          {progresionAll.length === 0 ? (
            <p className="pc-empty mb-0">Todavía no hay progresión medible en este período.</p>
          ) : (
            <>
              <ul className="pc-pr-list">
                {progresion.map((p) => (
                  <li key={p.nombre}>
                    <button
                      type="button"
                      className={`pc-pr-row${p.nombre === ejercicioActivo ? ' is-active' : ''}`}
                      onClick={() => setEjercicio(p.nombre)}
                    >
                      <div className="pc-pr-main">
                        <div className="pc-pr-title-row">
                          <strong>{p.display}</strong>
                          <span className={`pc-tag pc-tag--${p.tone}`}>{p.grupo}</span>
                        </div>
                        <p className="pc-pr-meta mb-0">
                          Base: {p.base} kg → Actual:{' '}
                          <strong className="pc-pr-actual">{p.actual} kg</strong>
                          {p.reps ? ` (${p.reps} reps)` : ''}
                        </p>
                      </div>
                      <Sparkline values={p.spark} tone={p.tone} />
                      <div className="pc-pr-stat">
                        <span className={`pc-pct pc-pct--${p.tone}`}>
                          {p.pct > 0 ? '+' : ''}{p.pct.toFixed(1)}%
                        </span>
                        <span className="pc-pr-stat-label">Sobrecarga</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="pc-pr-foot">
                <span className="pc-pr-foot-note">
                  Mostrando {progresion.length} de {totalProgramados || progresionAll.length} ejercicios programados
                </span>
                {progresionAll.length > 4 && (
                  <button
                    type="button"
                    className="pc-link-btn"
                    onClick={() => setVerTodosProg((v) => !v)}
                  >
                    {verTodosProg ? 'Ver menos' : 'Ver todos los ejercicios ›'}
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        <div className="pc-side">
          <section className="pc-panel pc-panel--dist">
            <div className="pc-panel-head">
              <h2 className="pc-panel-title">Distribución de Series Efectivas</h2>
              {seriesSemana > 0 && (
                <span className="pc-panel-meta">{seriesSemana} series/semana</span>
              )}
            </div>
            {dist.length === 0 ? (
              <p className="pc-empty mb-0">Sin series con peso en el período.</p>
            ) : (
              <>
                <div className="pc-dist-bar" aria-hidden>
                  {dist.map((d) => (
                    <span key={d.grupo} style={{ width: `${d.pct}%`, background: d.color }} title={`${d.grupo}: ${d.pct}%`} />
                  ))}
                </div>
                <ul className="pc-dist-legend">
                  {dist.map((d) => (
                    <li key={d.grupo}>
                      <i style={{ background: d.color }} />
                      <span>{d.grupo}</span>
                      <strong>{d.pct}%</strong>
                    </li>
                  ))}
                </ul>
                <div className="pc-rpe-box">
                  <div className="pc-rpe-head">
                    <span className="pc-rpe-title">Intensidad Media de Esfuerzo (RPE)</span>
                    {rpeAvg != null && (
                      <span className="pc-badge is-rpe">{rpeAvg} / 10 RPE</span>
                    )}
                  </div>
                  <p className="pc-rpe-note mb-0">
                    RIR 2 mapeado en zona óptima de progresión. Mantené el esfuerzo percibido entre 7.5 y 8.5 para maximizar la hipertrofia sin quemar el SNC.
                  </p>
                </div>
              </>
            )}
          </section>

          <section className="pc-panel pc-suggest">
            <div className="pc-suggest-layout">
              <span className="pc-suggest-ico" aria-hidden><IconBulb /></span>
              <div className="pc-suggest-body">
                <h2 className="pc-suggest-title">Sugerencia de Sobrecarga Inteligente</h2>
                <p className="pc-suggest-text mb-0">
                  {lastPt?.carga != null && sug.cargaSugerida != null && sugDelta != null ? (
                    <>
                      Completaste tu objetivo en el{' '}
                      <strong>{nombreDisplayPlan(ejercicioActivo)}</strong> con{' '}
                      <strong>{lastPt.carga} kg</strong>. Zona óptima de hipertrofia (RIR 2): sube a{' '}
                      <span className="pc-suggest-pill">
                        +{sugDelta} kg ({sug.cargaSugerida} kg)
                      </span>
                      {' '}en la próxima sesión.
                    </>
                  ) : (
                    sug.texto
                  )}
                </p>
                {sug.aplicable && sug.cargaSugerida != null && (
                  <button
                    type="button"
                    className="pc-suggest-link"
                    onClick={() => onAplicarSugerencia?.({
                      ejercicio: ejercicioActivo,
                      carga: sug.cargaSugerida,
                    })}
                  >
                    Aplicar a la próxima sesión →
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
