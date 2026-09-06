import { useMemo } from 'react'
import { fechaSoloDia, fechaToISO, formatearFecha } from '../utils/calorias'
import { REFERENCIA_ALIMENTOS } from '../utils/referenciaComidas'
import { getUltimosNDias, PERIODOS } from '../utils/estadisticas'
import { AppNotificacionesCampana } from '../context/AppNotificationsContext'

function numeroFlexibleO(valor, fallback = 0) {
  const n = parseFloat(String(valor ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

function redondear1(n) {
  return Math.round(n * 10) / 10
}

const FAVORITOS = [
  { label: 'Pollo 150g', emoji: '🍗', match: 'pechuga de pollo' },
  { label: '2 Huevos duros', emoji: '🥚', match: 'huevo duro' },
  { label: 'Banana', emoji: '🍌', match: 'banana' },
  { label: 'Whey Protein', emoji: '🥤', match: 'whey' },
]

const META_MOMENTO = { Desayuno: 0.25, Almuerzo: 0.35, Merienda: 0.15, Cena: 0.25 }
const DIAS_CORTO = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

const ETIQUETA_CATEGORIA = {
  'Proteínas': 'Carnes magras',
  Carbohidratos: 'Carbohidratos complejos',
  Pastas: 'Carbohidratos complejos',
  Verduras: 'Verduras',
  'Comidas saludables': 'Plato balanceado',
  Almuerzo: 'Plato completo',
  'Desayuno / Lácteos': 'Desayuno',
}

function buscarReferenciaAlimento(nombre) {
  if (!nombre) return null
  const exact = REFERENCIA_ALIMENTOS.find((a) => a.nombre === nombre)
  if (exact) return exact
  const low = nombre.toLowerCase()
  return REFERENCIA_ALIMENTOS.find((a) => {
    const n = a.nombre.toLowerCase()
    return low.includes(n) || n.includes(low)
  }) || null
}

const HORA_MOMENTO = {
  Desayuno: '08:30 AM',
  Almuerzo: '13:15 PM',
  Merienda: '17:00 PM',
  Cena: '21:00 PM',
}

function horaDelMomento(items, tipo) {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (items[i].hora) return items[i].hora
  }
  if (items.length) return HORA_MOMENTO[tipo] || null
  return null
}

function subtituloAlimento(r) {
  const ref = buscarReferenciaAlimento(r.descripcion)
  const cat = r.categoria || ref?.categoria
  const parte1 = cat
    ? (ETIQUETA_CATEGORIA[cat] || cat.split('/').pop()?.trim() || cat)
    : null
  const parte2 = r.porciones || ref?.porcion
  if (parte1 && parte2) return `${parte1} • ${parte2}`
  return parte1 || parte2 || null
}

function resaltarTip(texto) {
  if (!texto) return ''
  return texto
    .replace(/(\d+g de prote[ií]na)/gi, '<strong class="cd-tip-hl">$1</strong>')
    .replace(/(\d+ kcal)/gi, '<strong class="cd-tip-hl">$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="cd-tip-hl">$1</strong>')
}

const ETIQUETA_TIPO = {
  habitos: 'HÁBITOS',
  nutricion: 'NUTRICIÓN',
  descanso: 'DESCANSO',
  balance: 'BALANCE',
  salud: 'SALUD',
}

const ETIQUETA_OBJETIVO = {
  ganar_musculo: 'Semana de hipertrofia',
  bajar_peso: 'Semana de déficit',
  mantener_peso: 'Semana de mantenimiento',
  aumentar_peso: 'Semana de volumen',
}

function formatearFechaNav(iso) {
  const hoyIso = fechaToISO(new Date())
  const d = new Date(`${iso}T12:00:00`)
  const pref = iso === hoyIso ? 'Hoy, ' : ''
  const mes = d.toLocaleDateString('es-ES', { month: 'short' }).replace(/\.$/, '')
  const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1)
  return `${pref}${d.getDate()} de ${mesCap} ${d.getFullYear()}`
}

function etiquetaInsight(consejo) {
  if (!consejo) return 'RESUMEN'
  if (consejo.tipo === 'descanso' || /fuerza|racha de \d+ días/i.test(consejo.texto || '')) {
    return 'HÁBITOS DE FUERZA'
  }
  return ETIQUETA_TIPO[consejo.tipo] || (consejo.tipo || 'resumen').toUpperCase()
}

function resaltarTextoInsight(texto) {
  if (!texto) return ''
  return texto
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(\d+g de prote[ií]na)/gi, '<strong>$1</strong>')
    .replace(/(\d+ kcal)/gi, '<strong>$1</strong>')
}

function formatearFechaCorta(iso) {
  const f = fechaSoloDia(iso)
  if (!f) return '—'
  const [, mm, dd] = f.split('-')
  return `${dd}/${mm}`
}

function tituloDiaHistorial(fecha, hoyIso) {
  const f = fechaSoloDia(fecha)
  if (f === hoyIso) {
    const d = new Date(`${f}T12:00:00`)
    const diaMes = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    return `Hoy • ${diaMes}`
  }
  return formatearFecha(f)
}

function IconHistoryClock() {
  return (
    <svg className="cd-hist-module-ico-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconHistChevron({ open }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {open ? (
        <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
      ) : (
        <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
      )}
    </svg>
  )
}

function HistorialPanel({
  hoy,
  registrosMesCount,
  periodo,
  setPeriodo,
  desdeCustom,
  setDesdeCustom,
  hastaCustom,
  setHastaCustom,
  consultarHistorial,
  historialMostrado,
  setHistorialMostrado,
  rangoDesde,
  rangoHasta,
  diasHistorial,
  diasExpandidos,
  toggleDiaHistorial,
  renderDiaHistorial,
}) {
  const diasConRegistros = diasHistorial.length

  return (
    <section id="cd-historial" className="cd-hist-module">
      <header className="cd-hist-module-head">
        <div className="cd-hist-module-head-main">
          <span className="cd-hist-module-ico" aria-hidden>
            <IconHistoryClock />
          </span>
          <div>
            <h2 className="cd-hist-module-title mb-0">Historial de Registros de Nutrición</h2>
            <p className="cd-hist-module-sub mb-0">{registrosMesCount} registros acumulados este mes</p>
          </div>
        </div>
      </header>

      <div className="cd-hist-filter-card">
        <form className="cd-hist-filtro" onSubmit={consultarHistorial}>
          <div className="cd-hist-filtro-top">
            <p className="cd-hist-filtro-label mb-0">Buscar por fechas</p>
            {historialMostrado && (
              <p className="cd-hist-rango-inline mb-0">
                Del {formatearFechaCorta(rangoDesde)} al {formatearFechaCorta(rangoHasta)}
                {diasConRegistros === 0 ? '' : ` · ${diasConRegistros} día${diasConRegistros === 1 ? '' : 's'} con registros`}
              </p>
            )}
          </div>
          <label className="cd-field cd-field--full">
            <span>Período</span>
            <div className="cd-select-wrap">
              <select
                value={periodo}
                onChange={(e) => {
                  setPeriodo?.(e.target.value)
                  setHistorialMostrado?.(false)
                }}
              >
                {PERIODOS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </label>
          {periodo === 'personalizado' && (
            <div className="cd-hist-fechas">
              <label className="cd-field">
                <span>Desde</span>
                <input
                  type="date"
                  value={desdeCustom}
                  onChange={(e) => {
                    setDesdeCustom?.(e.target.value)
                    setHistorialMostrado?.(false)
                  }}
                />
              </label>
              <label className="cd-field">
                <span>Hasta</span>
                <input
                  type="date"
                  value={hastaCustom}
                  onChange={(e) => {
                    setHastaCustom?.(e.target.value)
                    setHistorialMostrado?.(false)
                  }}
                />
              </label>
            </div>
          )}
          <button type="submit" className="cd-btn cd-btn--primary cd-hist-buscar">
            <span aria-hidden>↻</span> Ver historial actualizado
          </button>
        </form>
      </div>

      {historialMostrado && (
        <div id="cd-historial-resultados" className="cd-hist-accordion-card">
          {diasHistorial.length === 0 ? (
            <p className="cd-hist-vacio mb-0">No hay comidas en este período.</p>
          ) : (
            <ul className="cd-hist-lista mb-0">
              {diasHistorial.map(([fecha, lista]) => {
                const cal = lista.reduce((s, r) => s + numeroFlexibleO(r.calorias), 0)
                const pro = Math.round(lista.reduce((s, r) => s + numeroFlexibleO(r.proteinas), 0))
                const car = Math.round(lista.reduce((s, r) => s + numeroFlexibleO(r.carbohidratos), 0))
                const abierto = diasExpandidos.has(fecha)
                return (
                  <li key={fecha} className={`cd-hist-dia${abierto ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="cd-hist-dia-toggle"
                      onClick={() => toggleDiaHistorial?.(fecha)}
                      aria-expanded={abierto}
                    >
                      <span className="cd-hist-dia-toggle-main">
                        <span className="cd-hist-chevron" aria-hidden>
                          <IconHistChevron open={abierto} />
                        </span>
                        <span className="cd-hist-fecha" style={{ textTransform: 'capitalize' }}>
                          {tituloDiaHistorial(fecha, hoy)}
                        </span>
                      </span>
                      <span className="cd-hist-dia-tag">
                        {cal || '—'} kcal • P {pro || '—'} • C {car || '—'}
                      </span>
                    </button>
                    {abierto && (
                      <div className="cd-hist-dia-body">
                        {renderDiaHistorial?.(lista)}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function IconCalendar() {
  return (
    <svg className="cd-date-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function IconBulb() {
  return (
    <svg className="cd-insight-ico-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <path d="M12 2v1.2M8.8 3.8l.85.85M15.2 3.8l-.85.85M6.2 7.5H5M18.8 7.5H17.5" strokeLinecap="round" />
      <path d="M9 18h6M10 21h4M12 3.2a5.8 5.8 0 0 0-3.4 10.4V17h6.8v-3.4A5.8 5.8 0 0 0 12 3.2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSearchPanel() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  )
}

function IconLightning() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" />
    </svg>
  )
}

function IconWater() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2.5c2.5 4 6 7.2 6 11a6 6 0 1 1-12 0c0-3.8 3.5-7 6-11z" strokeLinejoin="round" />
    </svg>
  )
}

const LITROS_META_AGUA = 2.5

function grasasRef(a) {
  if (a.grasas != null && Number.isFinite(Number(a.grasas))) return Number(a.grasas)
  return Math.max(0, Math.round(((a.calorias - a.proteinas * 4 - a.carbohidratos * 4) / 9) * 10) / 10)
}

function CalorieRing({ consumed, goal }) {
  const pct = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0
  const rest = Math.max(0, Math.round(goal - consumed))
  const r = 78
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c

  return (
    <div className="cd-ring">
      <div className="cd-ring-chart">
        <svg viewBox="0 0 200 200" aria-hidden>
          <defs>
            <radialGradient id="cdRingGlow" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="88" fill="url(#cdRingGlow)" />
          <circle cx="100" cy="100" r={r} className="cd-ring-track" />
          <circle
            cx="100"
            cy="100"
            r={r}
            className="cd-ring-progress"
            style={{ strokeDasharray: c, strokeDashoffset: offset }}
          />
        </svg>
        <div className="cd-ring-center">
          <p className="cd-ring-kcal mb-0">{Math.round(consumed).toLocaleString('es-AR')}</p>
          <p className="cd-ring-kcal-label mb-0">KCAL CONSUMIDAS</p>
          <p className="cd-ring-rest mb-0">{rest.toLocaleString('es-AR')} kcal restantes</p>
        </div>
      </div>
    </div>
  )
}

function MacroBar({ label, value, goal, color, dotClass = '' }) {
  const num = Number(value) || 0
  const target = Number(goal) || 0
  const pct = target > 0 ? Math.min(100, (num / target) * 100) : 0
  const rest = Math.max(0, Math.round((target - num) * 10) / 10)

  return (
    <div className="cd-macro-bar">
      <div className="cd-macro-bar-head">
        <span className="cd-macro-bar-label">
          <span className={`cd-macro-dot ${dotClass}`} aria-hidden />
          {label}
        </span>
        <span className="cd-macro-bar-val">
          <strong className="cd-macro-bar-num">{num}g</strong>
          <span className="cd-macro-bar-goal"> / {target}g</span>
          {target > 0 && (
            <span className="cd-macro-bar-rest-inline"> ({rest}g restantes)</span>
          )}
        </span>
      </div>
      <div className="cd-macro-bar-track">
        <div className="cd-macro-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function MacroPills({ r, compact = false }) {
  const meal = compact ? ' cd-macros--meal' : ''
  return (
    <div className={`cd-macros${meal}`}>
      {r.calorias != null && (
        <span className="cd-pill cd-pill--kcal">
          <span className="cd-pill-val">{Math.round(Number(r.calorias))} kcal</span>
        </span>
      )}
      {r.proteinas != null && (
        <span className="cd-pill cd-pill--p">
          <span className="cd-pill-lbl">P</span>
          <span className="cd-pill-val">{r.proteinas}g</span>
        </span>
      )}
      {r.carbohidratos != null && (
        <span className="cd-pill cd-pill--c">
          <span className="cd-pill-lbl">C</span>
          <span className="cd-pill-val">{r.carbohidratos}g</span>
        </span>
      )}
      {r.grasas != null && (
        <span className="cd-pill cd-pill--g">
          <span className="cd-pill-lbl">G</span>
          <span className="cd-pill-val">{r.grasas}g</span>
        </span>
      )}
    </div>
  )
}

function TipNutricionista({ texto, className = '' }) {
  return (
    <section className={`cd-panel cd-tip${className ? ` ${className}` : ''}`}>
      <div className="cd-tip-head">
        <span className="cd-tip-ico-box" aria-hidden>
          <IconLightning />
        </span>
        <p className="cd-tip-label mb-0">
          TIP DEL NUTRICIONISTA <span className="cd-tip-label-accent">FITNESS PRO</span>
        </p>
      </div>
      <p
        className="cd-tip-text mb-0"
        dangerouslySetInnerHTML={{ __html: resaltarTip(texto) }}
      />
      <button type="button" className="cd-tip-link">Ver recetas sugeridas de cena ›</button>
    </section>
  )
}

function MealCard({
  tipo,
  icon,
  items,
  metaKcal,
  caloriasHoy,
  proteinasRest,
  onAgregar,
  onEliminar,
}) {
  const cal = items.reduce((s, r) => s + (Number(r.calorias) || 0), 0)
  const metaMomento = Math.round(metaKcal * (META_MOMENTO[tipo] || 0.25))
  const vacio = items.length === 0
  const horaConsumo = horaDelMomento(items, tipo)

  return (
    <article className={`cd-meal${vacio ? ' cd-meal--pending' : ' cd-meal--filled'}`}>
      <header className="cd-meal-head">
        <div className="cd-meal-head-top">
          <div className="cd-meal-head-row">
            <span className="cd-meal-icon" aria-hidden>{icon}</span>
            <h3 className="cd-meal-title mb-0">
              {tipo}
              {!vacio && horaConsumo && (
                <span className="cd-meal-title-sep"> • Consumido {horaConsumo}</span>
              )}
            </h3>
          </div>
          <p className="cd-meal-kcal-inline mb-0">
            <strong className="cd-meal-kcal-now">{cal}</strong>
            <span className="cd-meal-kcal-goal"> / {metaMomento} kcal</span>
          </p>
        </div>
        <p className="cd-meal-meta-rec mb-0">Meta recomendada: ~{metaMomento} kcal</p>
      </header>
      {!vacio && (
        <ul className="cd-meal-items">
          {items.map((r) => {
            const sub = subtituloAlimento(r)
            return (
              <li key={r.id} className="cd-meal-item">
                <div className="cd-meal-item-text">
                  <p className="cd-meal-item-name mb-0">{r.descripcion}</p>
                  {sub && <p className="cd-meal-item-sub mb-0">{sub}</p>}
                </div>
                <div className="cd-meal-item-right">
                  <MacroPills r={r} compact />
                  <button type="button" className="cd-meal-del" onClick={() => onEliminar(r.id)} aria-label="Eliminar">×</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <button type="button" className="cd-meal-add" onClick={() => onAgregar(tipo)}>
        + Agregar alimento a {tipo}
      </button>
    </article>
  )
}

export default function ComidaTitanium({
  hoy,
  rachaDias = 0,
  caloriasHoy,
  proteinasHoy,
  carbosHoy,
  grasasHoy,
  metaKcal,
  metaPro,
  metaCarb,
  metaGrasa,
  vasos = 0,
  metaVasos = 8,
  caloriasActivas = 0,
  onToggleVaso,
  onAdd250ml,
  comidas = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'],
  momentoIcon = {},
  hoyRegistros = [],
  comida,
  setComida,
  eliminar,
  busquedaRef,
  setBusquedaRef,
  limpiarSeleccion,
  resultadosBusqueda = [],
  referenciaActiva,
  seleccionarReferencia,
  previewSeleccion,
  cantidadPorciones,
  setCantidadPorciones,
  blurCantidadPorciones,
  items = [],
  totalesItems,
  puedeGuardar,
  añadirDesdeReferencia,
  actualizarItem,
  quitarItem,
  blurCantidadItem,
  añadirLineaVacia,
  notas,
  setNotas,
  guardarComida,
  registros = [],
  tipNutricion,
  registrosMesCount = 0,
  vistaComida = 'hoy',
  setVistaComida,
  periodo = '15_dias',
  setPeriodo,
  desdeCustom = '',
  setDesdeCustom,
  hastaCustom = '',
  setHastaCustom,
  consultarHistorial,
  historialMostrado = false,
  setHistorialMostrado,
  rangoDesde = '',
  rangoHasta = '',
  diasHistorial = [],
  diasExpandidos = new Set(),
  toggleDiaHistorial,
  renderDiaHistorial,
  bannerConsejo,
  objetivo,
}) {
  const itemsPorMomento = useMemo(() => {
    const map = {}
    for (const m of comidas) map[m] = []
    for (const r of hoyRegistros) {
      const m = r.comida === 'Snack' ? 'Merienda' : r.comida
      if (map[m]) map[m].push(r)
      else if (!map.Otros) map.Otros = [r]
    }
    return map
  }, [hoyRegistros, comidas])

  const semana = useMemo(() => {
    const dias = getUltimosNDias(7)
    return dias.map((fecha) => {
      const cal = registros
        .filter((r) => fechaSoloDia(r.fecha) === fecha)
        .reduce((s, r) => s + (Number(r.calorias) || 0), 0)
      const d = new Date(`${fecha}T12:00:00`)
      return { fecha, cal, label: DIAS_CORTO[d.getDay()], isToday: fecha === hoy }
    })
  }, [registros, hoy])

  const promedioSemana = useMemo(() => {
    const vals = semana.map((d) => d.cal).filter((c) => c > 0)
    if (!vals.length) return 0
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }, [semana])

  const adherencia = useMemo(() => {
    if (!metaKcal) return null
    const ok = semana.filter((d) => d.cal > 0 && d.cal <= metaKcal * 1.05).length
    const conDatos = semana.filter((d) => d.cal > 0).length
    if (!conDatos) return null
    return Math.round((ok / conDatos) * 100)
  }, [semana, metaKcal])

  const maxSemana = Math.max(metaKcal, ...semana.map((d) => d.cal), 1)
  const proteinasRest = Math.max(0, (Number(metaPro) || 0) - (Number(proteinasHoy) || 0))
  const litrosConsumidos = Math.min(LITROS_META_AGUA, vasos * 0.4)
  const litrosConsumidosFmt = (Math.round(litrosConsumidos * 10) / 10).toFixed(1)

  const agregarMomento = (momento) => {
    setComida(momento)
    requestAnimationFrame(() => document.getElementById('cd-buscar')?.focus())
  }

  const agregarFavorito = (match) => {
    const item = REFERENCIA_ALIMENTOS.find((a) => a.nombre.toLowerCase().includes(match))
    if (item) seleccionarReferencia(item)
  }

  const totalPreview = previewSeleccion || (puedeGuardar && items.length ? totalesItems : null)

  const verDesglose = () => {
    document.getElementById('cd-balance')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const etiquetaSecundaria = ETIQUETA_OBJETIVO[objetivo] || null

  return (
    <div className="cd-root">
      <header className="cd-header">
        <div className="cd-header-left">
          <div className="cd-title-row">
            <h1 className="cd-title mb-0">Nutrición y Comidas</h1>
            {rachaDias > 0 && (
              <span className="cd-streak-badge">Día {rachaDias} en Racha 🔥</span>
            )}
          </div>
          <p className="cd-subtitle mb-0">
            Resumen calórico, balance de macronutrientes y registro en tiempo real
          </p>
        </div>
        <div className="cd-header-actions">
          <div className="cd-date-nav" aria-label="Fecha del día">
            <button type="button" className="cd-date-arrow" aria-label="Día anterior" disabled>‹</button>
            <span className="cd-date-inner">
              <IconCalendar />
              {formatearFechaNav(hoy)}
            </span>
            <button type="button" className="cd-date-arrow" aria-label="Día siguiente" disabled>›</button>
          </div>
          <button type="button" className="cd-btn cd-btn--primary" onClick={() => agregarMomento(comida || 'Desayuno')}>
            + Registrar comida rápida
          </button>
          <div className="cd-campana">
            <AppNotificacionesCampana />
          </div>
        </div>
      </header>

      {bannerConsejo?.texto && (
        <div className="cd-insight">
          <div className="cd-insight-ico-wrap">
            <IconBulb />
          </div>
          <div className="cd-insight-body">
            <div className="cd-insight-tags">
              <span className="cd-insight-tag cd-insight-tag--gold">
                {bannerConsejo.ambito === 'semana' ? 'SEMANA' : 'HOY'} · {etiquetaInsight(bannerConsejo)}
              </span>
              {etiquetaSecundaria && (
                <span className="cd-insight-tag cd-insight-tag--muted">· {etiquetaSecundaria}</span>
              )}
            </div>
            <p
              className="cd-insight-text mb-0"
              dangerouslySetInnerHTML={{ __html: resaltarTextoInsight(bannerConsejo.texto) }}
            />
          </div>
          <button type="button" className="cd-insight-btn" onClick={verDesglose}>
            Ver desglose
          </button>
        </div>
      )}

      <nav className="cd-module-tabs" aria-label="Vista de nutrición">
        <button
          type="button"
          className={`cd-module-tab${vistaComida === 'hoy' ? ' is-active' : ''}`}
          onClick={() => setVistaComida?.('hoy')}
        >
          Registro de Hoy
        </button>
        <button
          type="button"
          className={`cd-module-tab${vistaComida === 'historial' ? ' is-active' : ''}`}
          onClick={() => setVistaComida?.('historial')}
        >
          Historial Completo
          {registrosMesCount > 0 && (
            <span className="cd-module-tab-badge">{registrosMesCount}</span>
          )}
        </button>
      </nav>

      <div className={`cd-layout${vistaComida === 'historial' ? ' cd-layout--historial' : ''}`}>
        <div className="cd-main">
          {vistaComida === 'hoy' ? (
            <>
          <section id="cd-balance" className="cd-panel cd-balance">
            <div className="cd-balance-head">
              <div>
                <h2 className="cd-panel-title mb-0">Tu Balance Diario</h2>
                <p className="cd-balance-sub mb-0">Objetivo energético personalizado y macros consumidos</p>
              </div>
              {caloriasActivas > 0 && (
                <span className="cd-balance-active">Calorías Activas: +{caloriasActivas.toLocaleString('es-AR')} kcal</span>
              )}
            </div>
            <div className="cd-balance-body">
              <div className="cd-ring-wrap">
                <CalorieRing consumed={caloriasHoy} goal={metaKcal} />
              </div>
              <div className="cd-macros-col">
                <MacroBar label="Proteínas" dotClass="cd-macro-dot--p" value={proteinasHoy} goal={metaPro} color="#38bdf8" />
                <MacroBar label="Carbohidratos" dotClass="cd-macro-dot--c" value={carbosHoy} goal={metaCarb} color="#f59e0b" />
                <MacroBar label="Grasas Totales" dotClass="cd-macro-dot--g" value={grasasHoy} goal={metaGrasa} color="#ec4899" />
              </div>
            </div>
            <div className="cd-water">
              <span className="cd-water-ico-box" aria-hidden>
                <IconWater />
              </span>
              <div className="cd-water-copy">
                <span className="cd-water-label">Hidratación Diaria</span>
                <p className="cd-water-stats mb-0">
                  {vasos} de {metaVasos} vasos consumidos ({litrosConsumidosFmt}L / {LITROS_META_AGUA}L Meta)
                </p>
              </div>
              <div className="cd-water-glasses">
                {Array.from({ length: metaVasos }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`cd-glass${i < vasos ? ' is-filled' : ''}`}
                    onClick={() => onToggleVaso(i)}
                    aria-label={i < vasos ? `Vaciar vaso ${i + 1}` : `Marcar vaso ${i + 1}`}
                    aria-pressed={i < vasos}
                  />
                ))}
              </div>
              <button type="button" className="cd-btn cd-btn--water" onClick={onAdd250ml}>+250ml</button>
            </div>
          </section>

          <div className="cd-meals">
            {comidas.map((tipo) => (
              <MealCard
                key={tipo}
                tipo={tipo}
                icon={momentoIcon[tipo] || '🍽️'}
                items={itemsPorMomento[tipo] || []}
                metaKcal={metaKcal}
                caloriasHoy={caloriasHoy}
                proteinasRest={proteinasRest}
                onAgregar={agregarMomento}
                onEliminar={eliminar}
              />
            ))}
          </div>

          <TipNutricionista texto={tipNutricion} className="cd-tip--mobile" />

          <button type="button" className="cd-hist-quick" onClick={() => setVistaComida?.('historial')}>
            <span className="cd-hist-quick-label">Historial de Registros de Nutrición</span>
            <span className="cd-hist-quick-meta">{registrosMesCount} registros acumulados este mes</span>
            <span className="cd-hist-quick-cta">Ver historial completo ›</span>
          </button>
            </>
          ) : (
            <HistorialPanel
              hoy={hoy}
              registrosMesCount={registrosMesCount}
              periodo={periodo}
              setPeriodo={setPeriodo}
              desdeCustom={desdeCustom}
              setDesdeCustom={setDesdeCustom}
              hastaCustom={hastaCustom}
              setHastaCustom={setHastaCustom}
              consultarHistorial={consultarHistorial}
              historialMostrado={historialMostrado}
              setHistorialMostrado={setHistorialMostrado}
              rangoDesde={rangoDesde}
              rangoHasta={rangoHasta}
              diasHistorial={diasHistorial}
              diasExpandidos={diasExpandidos}
              toggleDiaHistorial={toggleDiaHistorial}
              renderDiaHistorial={renderDiaHistorial}
            />
          )}
        </div>

        <aside className="cd-aside">
          <section className="cd-panel cd-search-panel">
            <div className="cd-search-head">
              <div className="cd-search-head-ico" aria-hidden>
                <IconSearchPanel />
              </div>
              <h2 className="cd-search-title mb-0">Buscador de Alimentos</h2>
              <span className="cd-search-verified">Base verificada</span>
            </div>

            <div className="cd-search-wrap">
              <span className="cd-search-ico" aria-hidden>
                <IconSearchPanel />
              </span>
              <input
                id="cd-buscar"
                type="search"
                className="cd-search-input"
                value={busquedaRef}
                onChange={(e) => setBusquedaRef(e.target.value)}
                placeholder={referenciaActiva ? 'Buscar otro alimento…' : 'Ej: tostad, pollo, arroz...'}
                autoComplete="off"
              />
              {(busquedaRef.trim() || referenciaActiva) && (
                <button
                  type="button"
                  className="cd-search-clear"
                  aria-label="Limpiar búsqueda"
                  onClick={() => {
                    setBusquedaRef('')
                    limpiarSeleccion()
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {referenciaActiva && (
              <div className="cd-ref-selected">
                <div className="cd-ref-selected-main">
                  <strong className="cd-ref-selected-name">{referenciaActiva.nombre}</strong>
                  <span className="cd-ref-selected-meta">
                    {referenciaActiva.calorias} kcal · P {referenciaActiva.proteinas}g
                  </span>
                </div>
                <button type="button" className="cd-ref-selected-del" onClick={limpiarSeleccion} aria-label="Quitar selección">×</button>
              </div>
            )}

            {busquedaRef.trim().length >= 1 && !referenciaActiva && (
              <div className="cd-ref-list">
                {resultadosBusqueda.length === 0 ? (
                  <p className="cd-search-empty mb-0">Sin resultados. Probá otra palabra.</p>
                ) : (
                  resultadosBusqueda.slice(0, 6).map((a) => {
                    const selected = referenciaActiva?._idx === a._idx
                    const gra = grasasRef(a)
                    return (
                      <button
                        key={a._idx}
                        type="button"
                        className={`cd-ref-card${selected ? ' is-selected' : ''}`}
                        onClick={() => seleccionarReferencia(a)}
                      >
                        <div className="cd-ref-card-top">
                          <strong className="cd-ref-card-name">{a.nombre}</strong>
                          <span className="cd-ref-card-kcal">{a.calorias} kcal</span>
                        </div>
                        <p className="cd-ref-card-macros mb-0">
                          P: {a.proteinas}g • C: {a.carbohidratos}g • G: {gra}g
                        </p>
                        {a.porcion && <span className="cd-ref-card-porc">{a.porcion}</span>}
                      </button>
                    )
                  })
                )}
              </div>
            )}

            <div className="cd-add-block">
              <h3 className="cd-add-title">Añadir Seleccionado</h3>
              <div className="cd-add-fields">
                <label className="cd-field cd-field--momento">
                  <span>Momento</span>
                  <div className="cd-select-wrap">
                    <select value={comida} onChange={(e) => setComida(e.target.value)}>
                      {comidas.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </label>
                <label className="cd-field">
                  <span>Porción / Cantidad</span>
                  <input
                    type="number"
                    min="0.25"
                    max="99"
                    step="0.25"
                    value={cantidadPorciones}
                    onChange={(e) => setCantidadPorciones(e.target.value)}
                    onBlur={blurCantidadPorciones}
                  />
                </label>
              </div>

              {totalPreview && (
                <div className="cd-add-total">
                  <span className="cd-add-total-lbl">Total a computar:</span>
                  <div className="cd-add-total-vals">
                    <strong>{totalPreview.cal} kcal</strong>
                    <span className="cd-add-total-sep" aria-hidden />
                    <span className="cd-add-total-pro">P {totalPreview.pro}g</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="cd-btn cd-btn--save cd-btn--full"
                disabled={!puedeGuardar}
                onClick={(e) => guardarComida(e)}
              >
                Guardar en el historial
              </button>
            </div>

            <div className="cd-fav">
              <p className="cd-fav-label mb-0">Frecuentes / Favoritos</p>
              <div className="cd-fav-chips">
                {FAVORITOS.map((f) => (
                  <button key={f.label} type="button" className="cd-fav-chip" onClick={() => agregarFavorito(f.match)}>
                    <span className="cd-fav-emoji" aria-hidden>{f.emoji}</span>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="cd-panel cd-week">
            <div className="cd-week-head">
              <h2 className="cd-panel-title mb-0">Consistencia Últimos 7 Días</h2>
              {adherencia != null && (
                <span className="cd-badge cd-badge--green">{adherencia}% adherencia</span>
              )}
            </div>
            <div className="cd-week-chart" aria-hidden>
              {semana.map((d) => (
                <div key={d.fecha} className={`cd-week-col${d.isToday ? ' is-today' : ''}`}>
                  <div
                    className="cd-week-bar"
                    style={{ height: `${Math.max(8, (d.cal / maxSemana) * 100)}%` }}
                  />
                  <span className="cd-week-lbl">{d.label}</span>
                </div>
              ))}
              <div className="cd-week-meta-line" style={{ bottom: `${(metaKcal / maxSemana) * 100}%` }} />
            </div>
            <div className="cd-week-foot">
              <span>Déficit controlado</span>
              <strong>Promedio: {promedioSemana.toLocaleString('es-AR')} kcal</strong>
            </div>
          </section>

          <TipNutricionista texto={tipNutricion} className="cd-tip--aside" />
        </aside>
      </div>
    </div>
  )
}
