import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useStorage } from '../hooks/useStorage'
import {
  caloriasEjercicioRegistro,
  caloriasQuemadasRegistroRutina,
  caloriasQuemadasRutinaDia,
  formatearFecha,
  fechaToISO,
  fechaSoloDia,
  getCategoriaTipo,
  minutosRutinaDia,
  etiquetaTipo,
} from '../utils/calorias'
import { getConsejosDelDia, OBJETIVOS } from '../utils/consejos'
import { getRachaDias, PERIODOS, getRangoPorPeriodo, getFechasEnRango, getUltimosNDias } from '../utils/estadisticas'
import { SUPLEMENTOS, getSuplementoLabel } from '../utils/suplementos'
import StatMiniCard from '../components/StatMiniCard'

function InicioActividadGrupo({ titulo, cantidad, kcalTotal, abierto, onToggle, children }) {
  const etiquetaCantidad = cantidad === 1 ? '1 ejercicio' : `${cantidad} ejercicios`
  return (
    <div className={`inicio-actividad-grupo${abierto ? ' is-open' : ''}`}>
      <button
        type="button"
        className="inicio-actividad-grupo-head"
        onClick={onToggle}
        aria-expanded={abierto}
      >
        <span className="inicio-actividad-grupo-chevron" aria-hidden="true">
          {abierto ? '▼' : '▶'}
        </span>
        <span className="inicio-actividad-grupo-texto">
          <span className="inicio-actividad-grupo-titulo">{titulo}</span>
          <span className="inicio-actividad-grupo-resumen">
            {etiquetaCantidad} · <strong>~{kcalTotal} kcal</strong>
          </span>
        </span>
      </button>
      {abierto && (
        <div className="inicio-actividad-grupo-body">
          {children}
        </div>
      )}
    </div>
  )
}

export default function Inicio() {
  const { user, isConfigured } = useAuth()
  const [ejercicios] = useStorage('ejercicios', [])
  const [comida] = useStorage('comida', [])
  const [suplementos, setSuplementos] = useStorage('suplementos', [])
  const [registrosRutina] = useStorage('rutinaPesos', [])
  const [historialPeso] = useStorage('pesoHistorial', [])
  const [config] = useStorage('config', { objetivo: 'mantener_peso', pesoKg: 70 })

  const hoy = fechaToISO(new Date())
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [fechaCalendarioSeleccionada, setFechaCalendarioSeleccionada] = useState(null)
  const [periodo, setPeriodo] = useState('semana')
  const [desdeCustom, setDesdeCustom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return fechaToISO(d)
  })
  const [hastaCustom, setHastaCustom] = useState(hoy)
  const [diaGraficoSeleccionado, setDiaGraficoSeleccionado] = useState(null)
  const [calendarioRutinaAbierta, setCalendarioRutinaAbierta] = useState(false)
  const [calendarioEjerciciosAbierta, setCalendarioEjerciciosAbierta] = useState(false)
  const refZonaGrafico = useRef(null)
  const refCuadroDetalle = useRef(null)
  const [barrasAnimadas, setBarrasAnimadas] = useState(false)
  useEffect(() => {
    setBarrasAnimadas(false)
    const t = setTimeout(() => setBarrasAnimadas(true), 200)
    return () => clearTimeout(t)
  }, [periodo, desdeCustom, hastaCustom])

  useEffect(() => {
    setDiaGraficoSeleccionado(null)
  }, [periodo, desdeCustom, hastaCustom])

  useEffect(() => {
    if (!diaGraficoSeleccionado) return
    const handleClickOutside = (e) => {
      if (refCuadroDetalle.current?.contains(e.target)) return
      if (refZonaGrafico.current?.contains(e.target)) return
      setDiaGraficoSeleccionado(null)
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [diaGraficoSeleccionado])

  const handlePeriodoChange = (value) => {
    setPeriodo(value)
    if (value === 'personalizado' && !desdeCustom) {
      const d = new Date((hastaCustom || hoy) + 'T12:00:00')
      d.setDate(d.getDate() - 30)
      setDesdeCustom(fechaToISO(d))
    }
  }

  useEffect(() => {
    setCalendarioRutinaAbierta(false)
    setCalendarioEjerciciosAbierta(false)
  }, [fechaCalendarioSeleccionada])

  const diaEnVista = fechaCalendarioSeleccionada || hoy
  const ejerciciosDelDia = ejercicios.filter((e) => fechaSoloDia(e.fecha) === diaEnVista)
  const comidasDelDia = comida.filter((c) => fechaSoloDia(c.fecha) === diaEnVista)
  const suplementosDelDia = suplementos.find((s) => fechaSoloDia(s.fecha) === diaEnVista)?.items ?? []

  const suplementosActivos = config?.suplementosActivos ?? SUPLEMENTOS.map((s) => s.id)
  const listaParaMarcar = SUPLEMENTOS.filter((s) => suplementosActivos.includes(s.id))

  const toggleSuplementoDia = (id) => {
    setSuplementos((prev) => {
      const rest = prev.filter((s) => fechaSoloDia(s.fecha) !== diaEnVista)
      const current = prev.find((s) => fechaSoloDia(s.fecha) === diaEnVista)?.items ?? []
      const has = current.includes(id)
      const newItems = has ? current.filter((x) => x !== id) : [...current, id]
      if (newItems.length === 0) return rest
      return [...rest, { fecha: diaEnVista, items: newItems }]
    })
  }

  const pesoCfg = config?.pesoKg || 70

  const resumenPesoCorporal = useMemo(() => {
    const h = historialPeso
    if (!Array.isArray(h) || h.length === 0) return null
    const o = [...h].sort((a, b) => fechaSoloDia(b.fecha).localeCompare(fechaSoloDia(a.fecha)))
    const ult = o[0]
    const pen = o[1]
    const delta = pen != null ? Math.round((Number(ult.pesoKg) - Number(pen.pesoKg)) * 10) / 10 : null
    return { ult, pen, delta }
  }, [historialPeso])
  const minutosEjercicioDia = ejerciciosDelDia.reduce((s, e) => s + e.duracion, 0)
  const minutosRutinaEstDia = minutosRutinaDia(registrosRutina, diaEnVista)
  const minutosDia = minutosEjercicioDia + minutosRutinaEstDia
  const calQuemEjercicioDia = ejerciciosDelDia.reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoCfg), 0)
  const calQuemRutinaDia = caloriasQuemadasRutinaDia(registrosRutina, diaEnVista, pesoCfg)
  const caloriasQuemadasDia = calQuemEjercicioDia + calQuemRutinaDia
  const caloriasConsumidasDia = comidasDelDia.reduce((s, r) => s + (Number(r.calorias) || 0), 0)
  const proteinasDia = comidasDelDia.reduce((s, r) => s + (Number(r.proteinas) || 0), 0)
  const carbosDia = comidasDelDia.reduce((s, r) => s + (Number(r.carbohidratos) || 0), 0)

  const diasUltimos7 = getUltimosNDias(7)
  const ejerciciosUltimos7 = ejercicios.filter((e) => diasUltimos7.includes(fechaSoloDia(e.fecha)))
  const minutosUltimos7Ej = ejerciciosUltimos7.reduce((s, e) => s + e.duracion, 0)
  const minutosUltimos7Rut = diasUltimos7.reduce((s, f) => s + minutosRutinaDia(registrosRutina, f), 0)
  const minutosUltimos7 = minutosUltimos7Ej + minutosUltimos7Rut
  const calQuemUltimos7Ej = ejerciciosUltimos7.reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoCfg), 0)
  const calQuemUltimos7Rut = diasUltimos7.reduce((s, f) => s + caloriasQuemadasRutinaDia(registrosRutina, f, pesoCfg), 0)
  const calQuemUltimos7 = calQuemUltimos7Ej + calQuemUltimos7Rut
  const comidasUltimos7 = comida.filter((c) => diasUltimos7.includes(fechaSoloDia(c.fecha)))
  const calConsumidasUltimos7 = comidasUltimos7.reduce((s, r) => s + (Number(r.calorias) || 0), 0)

  const ejerciciosPorTipo = ejerciciosDelDia.reduce((acc, ex) => {
    const cat = getCategoriaTipo(ex.tipo)
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  const diaData = {
    caloriasConsumidas: caloriasConsumidasDia,
    caloriasQuemadas: caloriasQuemadasDia,
    proteinas: proteinasDia,
    carbohidratos: carbosDia,
    ejerciciosPorTipo,
  }
  const consejos = getConsejosDelDia(config?.objetivo, diaData, pesoCfg)

  const objetivoLabel = OBJETIVOS.find((o) => o.value === config?.objetivo)?.label || 'Mantener peso'

  const racha = getRachaDias(
    [
      ...ejercicios.map((e) => ({ fecha: fechaSoloDia(e.fecha) })),
      ...comida.map((c) => ({ fecha: fechaSoloDia(c.fecha) })),
      ...registrosRutina.map((r) => ({ fecha: fechaSoloDia(r.fecha) })),
    ],
    hoy
  )

  const { desde, hasta } = getRangoPorPeriodo(periodo, desdeCustom, hastaCustom)
  const fechasEnPeriodo = getFechasEnRango(desde, hasta)
  const caloriasPorDiaEnPeriodo = fechasEnPeriodo.map((f) => ({
    fecha: f,
    cal: comida.filter((c) => fechaSoloDia(c.fecha) === f).reduce((s, r) => s + (Number(r.calorias) || 0), 0),
    quemadas:
      ejercicios.filter((e) => fechaSoloDia(e.fecha) === f).reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoCfg), 0) +
      caloriasQuemadasRutinaDia(registrosRutina, f, pesoCfg),
    pro: comida.filter((c) => fechaSoloDia(c.fecha) === f).reduce((s, r) => s + (Number(r.proteinas) || 0), 0),
  }))
  const totalCalPeriodo = caloriasPorDiaEnPeriodo.reduce((s, d) => s + d.cal, 0)
  const totalQuemadasPeriodo = caloriasPorDiaEnPeriodo.reduce((s, d) => s + d.quemadas, 0)
  const diasConEjercicioPeriodo = caloriasPorDiaEnPeriodo.filter((d) => d.quemadas > 0).length
  const diasConComidaPeriodo = caloriasPorDiaEnPeriodo.filter((d) => d.cal > 0).length
  const maxGrafico = Math.max(
    1,
    ...caloriasPorDiaEnPeriodo.flatMap((d) => [d.cal, d.quemadas])
  )
  const numDiasPeriodo = caloriasPorDiaEnPeriodo.length
  const graficoAnchoCompleto = numDiasPeriodo > 0 && numDiasPeriodo <= 15

  const diasConSuplementosPeriodo = caloriasPorDiaEnPeriodo.filter((d) => {
    const items = suplementos.find((s) => fechaSoloDia(s.fecha) === d.fecha)?.items ?? []
    return items.length > 0
  }).length
  const suplementosPorTipoPeriodo = (config?.suplementosActivos ?? SUPLEMENTOS.map((s) => s.id)).reduce((acc, id) => {
    acc[id] = caloriasPorDiaEnPeriodo.filter((d) => {
      const items = suplementos.find((s) => fechaSoloDia(s.fecha) === d.fecha)?.items ?? []
      return items.includes(id)
    }).length
    return acc
  }, {})

  function getDetalleDia(fecha) {
    const comidasDelDiaF = comida.filter((c) => fechaSoloDia(c.fecha) === fecha)
    const cal = comidasDelDiaF.reduce((s, r) => s + (Number(r.calorias) || 0), 0)
    const minutosEj = ejercicios.filter((e) => fechaSoloDia(e.fecha) === fecha).reduce((s, e) => s + e.duracion, 0)
    const minutosRut = minutosRutinaDia(registrosRutina, fecha)
    const quemadasEj = ejercicios.filter((e) => fechaSoloDia(e.fecha) === fecha).reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoCfg), 0)
    const quemadasRut = caloriasQuemadasRutinaDia(registrosRutina, fecha, pesoCfg)
    const quemadas = quemadasEj + quemadasRut
    const pro = comidasDelDiaF.reduce((s, r) => s + (Number(r.proteinas) || 0), 0)
    const carbos = comidasDelDiaF.reduce((s, r) => s + (Number(r.carbohidratos) || 0), 0)
    const numComidas = comidasDelDiaF.length
    const minutos = minutosEj + minutosRut
    const sups = suplementos.find((s) => fechaSoloDia(s.fecha) === fecha)?.items ?? []
    const itemsComida = comidasDelDiaF.map((r) => ({ tipo: r.comida || 'Comida', descripcion: r.descripcion || '', kcal: r.calorias }))
    return {
      fecha,
      cal,
      quemadas,
      quemadasEj,
      quemadasRut,
      minutosEj,
      minutosRut,
      pro,
      carbos,
      numComidas,
      minutos,
      suplementos: sups,
      itemsComida,
    }
  }

  function getDiasDelMes(yearMonth) {
    const [y, m] = yearMonth.split('-').map(Number)
    const primerDia = new Date(y, m - 1, 1)
    const ultimoDia = new Date(y, m, 0)
    const diasEnMes = ultimoDia.getDate()
    const inicioSemana = primerDia.getDay()
    const celdasVaciasInicio = inicioSemana === 0 ? 6 : inicioSemana - 1
    const totalCeldas = Math.ceil((celdasVaciasInicio + diasEnMes) / 7) * 7
    const dias = []
    for (let i = 0; i < celdasVaciasInicio; i++) dias.push({ vacio: true })
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      dias.push({ fecha, vacio: false, dia: d })
    }
    while (dias.length < totalCeldas) dias.push({ vacio: true })
    return dias
  }

  const diasDelMes = getDiasDelMes(mesCalendario)
  const fechasConActividad = new Set([
    ...ejercicios.map((e) => fechaSoloDia(e.fecha)),
    ...registrosRutina.map((r) => fechaSoloDia(r.fecha)),
    ...comida.map((c) => fechaSoloDia(c.fecha)),
  ])
  const fechasConComida = new Set(comida.map((c) => fechaSoloDia(c.fecha)))
  const fechasConEjercicio = new Set(ejercicios.map((e) => fechaSoloDia(e.fecha)))
  const fechasConRutina = new Set(registrosRutina.map((r) => fechaSoloDia(r.fecha)))
  const rutinaDelDiaCalendario = registrosRutina.filter((r) => fechaSoloDia(r.fecha) === diaEnVista)
  const ejerciciosDelDiaCalendario = ejercicios.filter((e) => fechaSoloDia(e.fecha) === diaEnVista)
  const kcalRutinaDiaCalendario = rutinaDelDiaCalendario.reduce(
    (s, r) => s + caloriasQuemadasRegistroRutina(r, pesoCfg),
    0
  )
  const kcalEjerciciosDiaCalendario = ejerciciosDelDiaCalendario.reduce(
    (s, e) => s + caloriasEjercicioRegistro(e, pesoCfg),
    0
  )

  return (
    <section className="section" style={{ paddingBottom: '2rem' }}>
      <div className="container app-page-container" style={{ paddingBottom: '1.5rem' }}>
        <header className="app-page-hero inicio-hero has-text-centered mb-4">
          <div className="app-page-hero-icon inicio-hero-diamond" aria-hidden="true">💎</div>
          <h1 className="title is-4">Mi rutina</h1>
          <p className="subtitle is-6 has-text-grey">Resumen por día y consejos según tu objetivo</p>
          <div className="app-hero-metrics">
            <span><strong>{caloriasConsumidasDia || 0}</strong> kcal</span>
            <span><strong>{minutosDia}</strong> min</span>
            <span><strong>{racha}</strong> racha</span>
          </div>
        </header>

        {isConfigured && !user && (
          <div className="box mb-4">
            <p className="is-size-7 mb-2 has-text-grey">
              Iniciá sesión para guardar tu progreso en la nube y usarlo en el celular u otra PC.
            </p>
            <Link to="/login" className="button is-link is-small">
              Iniciar sesión o crear cuenta
            </Link>
          </div>
        )}

        <div className="inicio-stats-row mb-4">
          <StatMiniCard icon="🥗" iconTone="green" label="Calorías consumidas" value={caloriasConsumidasDia || '—'} />
          <StatMiniCard icon="🔥" iconTone="orange" label="Calorías quemadas" value={caloriasQuemadasDia || '—'} />
          <StatMiniCard icon="💪" iconTone="green" label="Proteínas (g)" value={proteinasDia || '—'} />
          <StatMiniCard icon="⚡" iconTone="purple" label="Carbohidratos (g)" value={carbosDia || '—'} />
        </div>

        {consejos.length > 0 && (
          <div className="mb-4">
            {consejos.slice(0, 1).map((c, i) => (
              <article key={i} className="ti-tip-bar">
                <span className="ti-tip-icon" aria-hidden="true">💡</span>
                <p className="mb-0">{c.texto}</p>
              </article>
            ))}
          </div>
        )}

        <div className="inicio-dashboard-grid mb-4">
        <div className="box mb-0 calendario-card">
          <h2 className="title is-6 mb-2">Calendario</h2>
          <p className="is-size-7 has-text-grey mb-2">Toca un día para ver ese día. Vuelve a tocar el mismo día para quitar la selección.</p>
          {fechaCalendarioSeleccionada && (
            <button type="button" className="button is-small is-light mb-3" onClick={() => setFechaCalendarioSeleccionada(null)}>
              Ver hoy
            </button>
          )}
          <div className="cal-mes-nav mb-3">
            <button
              type="button"
              className="button is-small is-light cal-mes-nav-prev"
              onClick={() => {
                const [y, m] = mesCalendario.split('-').map(Number)
                const prev = new Date(y, m - 2, 1)
                setMesCalendario(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`)
              }}
            >
              ← Anterior
            </button>
            <span className="is-size-6 has-text-weight-medium cal-mes-nav-mes">
              {(() => {
                const [y, m] = mesCalendario.split('-').map(Number)
                return new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())
              })()}
            </span>
            <button
              type="button"
              className="button is-small is-light cal-mes-nav-next"
              onClick={() => {
                const [y, m] = mesCalendario.split('-').map(Number)
                const next = new Date(y, m, 1)
                setMesCalendario(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
              }}
            >
              Siguiente →
            </button>
          </div>
          <div className="app-calendar-grid">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
              <div key={d} className="app-calendar-weekday has-text-centered has-text-grey is-size-7">
                {d}
              </div>
            ))}
            {diasDelMes.map((celda, idx) => {
              if (celda.vacio) {
                return <div key={`v-${idx}`} className="app-calendar-empty" />
              }
              const tieneActividad = fechasConActividad.has(celda.fecha)
              const seleccionado = fechaCalendarioSeleccionada === celda.fecha
              return (
                <button
                  key={celda.fecha}
                  type="button"
                  className={`button is-small has-text-weight-semibold app-calendar-day ${seleccionado ? 'is-link is-selected' : tieneActividad ? 'has-activity' : 'is-light'}`}
                  onClick={() => setFechaCalendarioSeleccionada(celda.fecha === fechaCalendarioSeleccionada ? null : celda.fecha)}
                >
                  <span>{celda.dia}</span>
                  {tieneActividad && (
                    <span className="app-calendar-dots" aria-hidden="true">
                      {fechasConComida.has(celda.fecha) && <i className="dot-food" />}
                      {fechasConEjercicio.has(celda.fecha) && <i className="dot-ex" />}
                      {fechasConRutina.has(celda.fecha) && <i className="dot-rut" />}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-4 pt-4 inicio-calendario-detalle">
              <h3 className="title is-6 mb-3">{diaEnVista === hoy ? 'Hoy' : formatearFecha(diaEnVista)} — Lo que hiciste</h3>
              {rutinaDelDiaCalendario.length > 0 && (
                <InicioActividadGrupo
                  titulo="Rutina / Gimnasio"
                  cantidad={rutinaDelDiaCalendario.length}
                  kcalTotal={kcalRutinaDiaCalendario}
                  abierto={calendarioRutinaAbierta}
                  onToggle={() => setCalendarioRutinaAbierta((v) => !v)}
                >
                  <ul className="inicio-actividad-lista">
                    {rutinaDelDiaCalendario.map((r) => (
                      <li key={r.id} className="box py-2 px-3 mb-2 inicio-actividad-card">
                        <strong className="inicio-actividad-card-titulo">{r.ejercicio}</strong>
                        <span className="inicio-actividad-chip inicio-actividad-chip-plan ml-2">
                          {r.series}×{r.repeticiones}
                        </span>
                        {r.pesoKg != null && r.pesoKg > 0 && (
                          <span className="inicio-actividad-chip inicio-actividad-chip-peso ml-1">{r.pesoKg} kg</span>
                        )}
                        <span className="inicio-actividad-chip inicio-actividad-chip-kcal ml-1">
                          ~{caloriasQuemadasRegistroRutina(r, pesoCfg)} kcal
                          {r.kcalManual != null && Number(r.kcalManual) > 0 && (
                            <span> (manual)</span>
                          )}
                        </span>
                        {r.notas && <p className="is-size-7 mt-1 mb-0 inicio-actividad-card-notas">— {r.notas}</p>}
                      </li>
                    ))}
                  </ul>
                </InicioActividadGrupo>
              )}
              {ejerciciosDelDiaCalendario.length > 0 && (
                <InicioActividadGrupo
                  titulo="Ejercicios (cardio, etc.)"
                  cantidad={ejerciciosDelDiaCalendario.length}
                  kcalTotal={kcalEjerciciosDiaCalendario}
                  abierto={calendarioEjerciciosAbierta}
                  onToggle={() => setCalendarioEjerciciosAbierta((v) => !v)}
                >
                  <ul className="inicio-actividad-lista">
                    {ejerciciosDelDiaCalendario.map((e) => (
                      <li key={e.id} className="box py-2 px-3 mb-2 inicio-actividad-card">
                        <strong className="inicio-actividad-card-titulo">{e.nombre}</strong>
                        <span className="tag is-link is-light is-size-7 ml-2">{etiquetaTipo(e.tipo)}</span>
                        <span className="inicio-actividad-chip inicio-actividad-chip-plan ml-1">
                          {e.distanciaKm != null && Number(e.distanciaKm) > 0 ? `${e.distanciaKm} km · ` : ''}
                          {e.duracion} min
                        </span>
                        <span className="inicio-actividad-chip inicio-actividad-chip-kcal ml-1">
                          ~{caloriasEjercicioRegistro(e, pesoCfg)} kcal
                        </span>
                        {e.notas && <p className="is-size-7 mt-1 mb-0 inicio-actividad-card-notas">— {e.notas}</p>}
                      </li>
                    ))}
                  </ul>
                </InicioActividadGrupo>
              )}
              {rutinaDelDiaCalendario.length === 0 && ejerciciosDelDiaCalendario.length === 0 && (
                <p className="is-size-7 has-text-grey">No hay rutina ni ejercicios registrados para este día.</p>
              )}
            </div>
        </div>

        <div className="inicio-quick-stack">
          <Link to="/ejercicios" className="box inicio-quick-card mb-3">
            <div className="inicio-quick-icon inicio-quick-icon--blue" aria-hidden="true">🏃</div>
            <div>
              <h3 className="inicio-quick-title">Ejercicios</h3>
              <p className="inicio-quick-desc">Registra actividad y calorías quemadas.</p>
              <p className="inicio-quick-stat mb-0">
                Hoy: <strong>{minutosDia}</strong> min | <strong className="has-text-success">{caloriasQuemadasDia}</strong> kcal
              </p>
            </div>
          </Link>
          <Link to="/comida" className="box inicio-quick-card mb-0">
            <div className="inicio-quick-icon inicio-quick-icon--green" aria-hidden="true">🥗</div>
            <div>
              <h3 className="inicio-quick-title">Comida</h3>
              <p className="inicio-quick-desc">Calorías, proteínas, carbos, porciones.</p>
              <p className="inicio-quick-stat mb-0">
                Hoy: <strong className="has-text-info">{caloriasConsumidasDia || '—'}</strong> kcal | <strong className="has-text-success">{comidasDelDia.length}</strong> comidas
              </p>
            </div>
          </Link>
        </div>
        </div>

        <div className="inicio-more-section">
        {listaParaMarcar.length > 0 && (
          <div className="box mb-4">
            <h2 className="title is-6 mb-3">Suplementos del {diaEnVista === hoy ? 'día' : formatearFecha(diaEnVista)}</h2>
            <p className="is-size-7 has-text-grey mb-3">Marca los que tomaste.</p>
            <div className="buttons are-small are-flex-wrap-wrap">
              {listaParaMarcar.map((s) => {
                const tomado = suplementosDelDia.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`button ${tomado ? 'is-success' : 'is-light'}`}
                    onClick={() => toggleSuplementoDia(s.id)}
                  >
                    {tomado ? '✓ ' : ''}{s.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {racha > 0 && (
          <div className="box mb-4">
            <p className="is-size-7 has-text-grey mb-1">Racha</p>
            <p className="title is-5 mb-0">🔥 {racha} día{racha !== 1 ? 's' : ''} seguido{racha !== 1 ? 's' : ''} registrando</p>
          </div>
        )}

        {resumenPesoCorporal && (
          <div className="box mb-4">
            <h2 className="title is-6 mb-2">Peso corporal</h2>
            <p className="mb-1">
              Última medición:{' '}
              <strong className="has-text-link">{resumenPesoCorporal.ult.pesoKg} kg</strong>
              <span className="is-size-7 has-text-grey ml-2">{formatearFecha(resumenPesoCorporal.ult.fecha)}</span>
            </p>
            {resumenPesoCorporal.pen != null && resumenPesoCorporal.delta != null && (
              <p className="is-size-7 has-text-grey mb-2">
                vs. medición anterior ({resumenPesoCorporal.pen.pesoKg} kg, {formatearFecha(resumenPesoCorporal.pen.fecha)}):{' '}
                <strong className={resumenPesoCorporal.delta <= 0 ? 'has-text-success' : 'has-text-warning'}>
                  {resumenPesoCorporal.delta > 0 ? '+' : ''}
                  {resumenPesoCorporal.delta} kg
                </strong>
              </p>
            )}
            <Link to="/config#peso-seguimiento" className="is-size-7">
              Registrar medición o ver historial →
            </Link>
          </div>
        )}

        {(config?.metaCalorias || config?.metaProteina) && diaEnVista === hoy && (
          <div className="box mb-4">
            <p className="is-size-7 has-text-grey mb-2">Progreso hoy hacia tu meta</p>
            {config.metaCalorias && (
              <div className="mb-3">
                <p className="is-size-7 mb-1">Calorías: {caloriasConsumidasDia || 0} / {config.metaCalorias}</p>
                <progress className="progress is-info" value={Math.min(Number(caloriasConsumidasDia) || 0, Number(config.metaCalorias))} max={config.metaCalorias} />
              </div>
            )}
            {config.metaProteina && (
              <div>
                <p className="is-size-7 mb-1">Proteína: {proteinasDia || 0} / {config.metaProteina} g</p>
                <progress className="progress is-success" value={Math.min(Number(proteinasDia) || 0, Number(config.metaProteina))} max={config.metaProteina} />
              </div>
            )}
          </div>
        )}

        <div className="box mb-4">
          <p className="is-size-7 has-text-grey mb-2">Tu objetivo en Config</p>
          <p className="title is-6">{objetivoLabel}</p>
        </div>

        <h2 className="title is-6 mb-3 app-section-title">Más detalles</h2>
        <div className="box mb-3">
          <label className="label is-size-7">Elige el período</label>
          <div className="select is-fullwidth mb-2">
            <select value={periodo} onChange={(e) => handlePeriodoChange(e.target.value)}>
              {PERIODOS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          {periodo === 'personalizado' && (
            <div className="columns">
              <div className="column">
                <label className="label is-size-7">Desde</label>
                <input className="input" type="date" value={desdeCustom} onChange={(e) => setDesdeCustom(e.target.value)} />
              </div>
              <div className="column">
                <label className="label is-size-7">Hasta</label>
                <input className="input" type="date" value={hastaCustom} onChange={(e) => setHastaCustom(e.target.value)} />
              </div>
            </div>
          )}
          <p className="is-size-7 has-text-grey mt-2 mb-0">
            Del {desde} al {hasta}
            {numDiasPeriodo > 0 && (
              <span className="graf-cal-rango-dias"> · {numDiasPeriodo} día{numDiasPeriodo !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <div className="box mb-4" style={{ overflow: 'visible' }}>
          <div className="columns is-mobile is-multiline">
            <div className="column is-half">
              <p className="is-size-7 has-text-grey">Calorías consumidas</p>
              <p className="title is-6">{totalCalPeriodo}</p>
            </div>
            <div className="column is-half">
              <p className="is-size-7 has-text-grey">Calorías quemadas</p>
              <p className="title is-6 has-text-success">{totalQuemadasPeriodo}</p>
            </div>
            <div className="column is-half">
              <p className="is-size-7 has-text-grey">Días con ejercicio</p>
              <p className="title is-6">{diasConEjercicioPeriodo} / {numDiasPeriodo}</p>
            </div>
            <div className="column is-half">
              <p className="is-size-7 has-text-grey">Días con comidas</p>
              <p className="title is-6">{diasConComidaPeriodo} / {numDiasPeriodo}</p>
            </div>
            <div className="column is-half">
              <p className="is-size-7 has-text-grey">Días con suplementos</p>
              <p className="title is-6">{diasConSuplementosPeriodo} / {numDiasPeriodo}</p>
            </div>
          </div>
          {Object.keys(suplementosPorTipoPeriodo).filter((id) => suplementosPorTipoPeriodo[id] > 0).length > 0 && (
            <>
              <p className="is-size-7 has-text-grey mt-2 mb-1">Suplementos en el período</p>
              <div className="tags are-small mt-1">
              {(config?.suplementosActivos ?? SUPLEMENTOS.map((s) => s.id)).map((id) => {
                const count = suplementosPorTipoPeriodo[id] ?? 0
                if (count === 0) return null
                return (
                  <span key={id} className="tag is-success is-light">
                    {getSuplementoLabel(id)}: {count} día{count !== 1 ? 's' : ''}
                  </span>
                )
              })}
            </div>
            </>
          )}
          <div className="graf-cal-section mt-3">
            <div className="graf-cal-header mb-3">
              <h3 className="graf-cal-title mb-1">Calorías por día</h3>
              <p className="graf-cal-subtitle mb-0">
                Comparación diaria de consumidas (azul) y quemadas (verde). Tocá un día para ver el detalle.
              </p>
            </div>
          <div ref={refZonaGrafico}>
          {numDiasPeriodo > 14 && (
            <p className="graf-cal-scroll-hint mb-2">Deslizá horizontalmente para ver todos los días del período.</p>
          )}
          <div className={`graf-cal-chart-wrap${graficoAnchoCompleto ? ' graf-cal-chart-wrap--fluid' : ''}`}>
            <div
              className={`graf-cal-grid${graficoAnchoCompleto ? ' graf-cal-grid--fluid' : ''}`}
              style={
                graficoAnchoCompleto
                  ? { gridTemplateColumns: `repeat(${numDiasPeriodo}, minmax(0, 1fr))` }
                  : {
                      gridTemplateColumns: `repeat(${numDiasPeriodo}, 2.85rem)`,
                      minWidth: `${Math.max(numDiasPeriodo * 46, 280)}px`,
                    }
              }
            >
            {caloriasPorDiaEnPeriodo.map((d) => {
              const pctCal = maxGrafico > 0 ? Math.round((d.cal / maxGrafico) * 100) : 0
              const pctQuem = maxGrafico > 0 ? Math.round((d.quemadas / maxGrafico) * 100) : 0
              const diaSem = new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short' })
              const txtCal = d.cal >= 1000 ? `${(d.cal / 1000).toFixed(1)}k` : String(d.cal)
              const txtQuem = d.quemadas >= 1000 ? `${(d.quemadas / 1000).toFixed(1)}k` : String(d.quemadas)
              const selected = diaGraficoSeleccionado === d.fecha
              const toggleDiaGrafico = () => {
                setDiaGraficoSeleccionado((prev) => (prev === d.fecha ? null : d.fecha))
              }
              return (
                <div
                  key={d.fecha}
                  className={`graf-cal-col${selected ? ' is-selected' : ''}`}
                  onClick={toggleDiaGrafico}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`${d.fecha}: ${d.cal} consumidas, ${d.quemadas} quemadas`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleDiaGrafico()
                    }
                  }}
                >
                  <div className="graf-cal-plot" aria-hidden="true">
                    <div className="graf-cal-bar-pair">
                      <div
                        className="graf-cal-bar graf-cal-bar--consumed"
                        style={{ height: barrasAnimadas && pctCal > 0 ? `${Math.max(pctCal, 4)}%` : '0%' }}
                        title={`Consumidas: ${d.cal} kcal`}
                      />
                      <div
                        className="graf-cal-bar graf-cal-bar--burned"
                        style={{ height: barrasAnimadas && pctQuem > 0 ? `${Math.max(pctQuem, 4)}%` : '0%' }}
                        title={`Quemadas: ${d.quemadas} kcal`}
                      />
                    </div>
                  </div>
                  <div className="graf-cal-meta">
                    <span className="graf-cal-fecha">{d.fecha.slice(8)}/{d.fecha.slice(5, 7)}</span>
                    <span className="graf-cal-dia">{diaSem}</span>
                    <span className="graf-cal-num graf-cal-num-consumidas">{txtCal}</span>
                    <span className="graf-cal-num graf-cal-num-quemadas">{txtQuem}</span>
                  </div>
                </div>
              )
            })}
            </div>
          </div>
          <p className="graf-cal-leyenda mt-2 mb-0">
            <span className="graf-cal-leyenda-swatch graf-cal-bar--consumed" /> Consumidas
            <span className="graf-cal-leyenda-swatch graf-cal-bar--burned ml-3" /> Quemadas
            <span className="graf-cal-leyenda-hint"> · Máx. del período: {maxGrafico} kcal</span>
          </p>
          {diaGraficoSeleccionado && (() => {
            const det = getDetalleDia(diaGraficoSeleccionado)
            return (
              <div
                ref={refCuadroDetalle}
                className="box inicio-detalle-dia mt-3 is-pinned"
                role="region"
                aria-label={`Detalle del día ${diaGraficoSeleccionado}`}
              >
                <div className="inicio-detalle-dia-head">
                  <p className="inicio-detalle-dia-titulo mb-0">{formatearFecha(det.fecha)}</p>
                  <button
                    type="button"
                    className="button is-small is-light"
                    onClick={() => setDiaGraficoSeleccionado(null)}
                    aria-label="Cerrar detalle"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="inicio-detalle-dia-grid">
                  <div className="inicio-detalle-stat">
                    <span className="inicio-detalle-label">Calorías consumidas</span>
                    <strong className="inicio-detalle-val inicio-detalle-val--blue">{det.cal} kcal</strong>
                  </div>
                  <div className="inicio-detalle-stat">
                    <span className="inicio-detalle-label">Calorías quemadas</span>
                    <strong className="inicio-detalle-val inicio-detalle-val--green">{det.quemadas} kcal</strong>
                    {(det.quemadasEj > 0 || det.quemadasRut > 0) && (
                      <span className="inicio-detalle-sub">Ejercicios ~{det.quemadasEj} · Rutina ~{det.quemadasRut}</span>
                    )}
                  </div>
                  <div className="inicio-detalle-stat">
                    <span className="inicio-detalle-label">Proteínas</span>
                    <strong className="inicio-detalle-val">{det.pro} g</strong>
                  </div>
                  <div className="inicio-detalle-stat">
                    <span className="inicio-detalle-label">Carbohidratos</span>
                    <strong className="inicio-detalle-val">{det.carbos} g</strong>
                  </div>
                  <div className="inicio-detalle-stat">
                    <span className="inicio-detalle-label">Comidas registradas</span>
                    <strong className="inicio-detalle-val">{det.numComidas}</strong>
                  </div>
                  <div className="inicio-detalle-stat">
                    <span className="inicio-detalle-label">Minutos (aprox.)</span>
                    <strong className="inicio-detalle-val">{det.minutos}</strong>
                    {(det.minutosEj > 0 || det.minutosRut > 0) && (
                      <span className="inicio-detalle-sub">Ejercicio {det.minutosEj} · Rutina estim. {det.minutosRut}</span>
                    )}
                  </div>
                  {det.suplementos.length > 0 && (
                    <div className="inicio-detalle-stat inicio-detalle-stat--full">
                      <span className="inicio-detalle-label">Suplementos</span>
                      <span className="inicio-detalle-val">{det.suplementos.map(getSuplementoLabel).join(', ')}</span>
                    </div>
                  )}
                  {det.itemsComida && det.itemsComida.length > 0 && (
                    <div className="inicio-detalle-stat inicio-detalle-stat--full inicio-detalle-comidas">
                      <span className="inicio-detalle-label">Comidas</span>
                      <ul className="inicio-detalle-comidas-list">
                        {det.itemsComida.map((it, i) => (
                          <li key={i}>
                            <strong>{it.tipo}</strong>
                            {it.descripcion ? ` — ${it.descripcion}` : ''}
                            {it.kcal != null ? ` (${it.kcal} kcal)` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
          </div>
          </div>
        </div>
        </div>

        <p className="has-text-centered has-text-grey is-size-7 mt-4">
          Configura tu <Link to="/config">objetivo y peso</Link> para consejos y calorías quemadas más precisas.
        </p>
      </div>
    </section>
  )
}
