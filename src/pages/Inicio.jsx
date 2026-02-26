import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useStorage } from '../hooks/useStorage'
import { caloriasQuemadas, formatearFecha, fechaToISO, getCategoriaTipo, etiquetaTipo } from '../utils/calorias'
import { getConsejosDelDia, OBJETIVOS } from '../utils/consejos'
import { getRachaDias, PERIODOS, getRangoPorPeriodo, getFechasEnRango } from '../utils/estadisticas'
import { SUPLEMENTOS, getSuplementoLabel } from '../utils/suplementos'

export default function Inicio() {
  const { user, isConfigured } = useAuth()
  const [ejercicios] = useStorage('ejercicios', [])
  const [comida] = useStorage('comida', [])
  const [suplementos, setSuplementos] = useStorage('suplementos', [])
  const [registrosRutina] = useStorage('rutinaPesos', [])
  const [config] = useStorage('config', { objetivo: 'mantener_peso', pesoKg: 70 })

  const hoy = fechaToISO(new Date())
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [fechaCalendarioSeleccionada, setFechaCalendarioSeleccionada] = useState(null)
  const [periodo, setPeriodo] = useState('semana')
  const [desdeCustom, setDesdeCustom] = useState('')
  const [hastaCustom, setHastaCustom] = useState(hoy)
  const [tooltipDia, setTooltipDia] = useState(null)
  const [detalleFijado, setDetalleFijado] = useState(false)
  const refZonaGrafico = useRef(null)
  const refCuadroDetalle = useRef(null)
  const refFijado = useRef(false) // ref para no depender del estado en mouseLeave (evita que se cierre al alejar el ratón tras el clic)
  const [barrasAnimadas, setBarrasAnimadas] = useState(false)
  useEffect(() => {
    setBarrasAnimadas(false)
    const t = setTimeout(() => setBarrasAnimadas(true), 200)
    return () => clearTimeout(t)
  }, [periodo, desdeCustom, hastaCustom])

  useEffect(() => {
    if (!tooltipDia || !detalleFijado) return
    const handleClickOutside = (e) => {
      if (refCuadroDetalle.current?.contains(e.target)) return
      if (refZonaGrafico.current?.contains(e.target)) return
      refFijado.current = false
      setTooltipDia(null)
      setDetalleFijado(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [tooltipDia, detalleFijado])

  const diaEnVista = fechaCalendarioSeleccionada || hoy
  const ejerciciosDelDia = ejercicios.filter((e) => e.fecha === diaEnVista)
  const comidasDelDia = comida.filter((c) => c.fecha === diaEnVista)
  const suplementosDelDia = suplementos.find((s) => s.fecha === diaEnVista)?.items ?? []

  const suplementosActivos = config?.suplementosActivos ?? SUPLEMENTOS.map((s) => s.id)
  const listaParaMarcar = SUPLEMENTOS.filter((s) => suplementosActivos.includes(s.id))

  const toggleSuplementoDia = (id) => {
    setSuplementos((prev) => {
      const rest = prev.filter((s) => s.fecha !== diaEnVista)
      const current = prev.find((s) => s.fecha === diaEnVista)?.items ?? []
      const has = current.includes(id)
      const newItems = has ? current.filter((x) => x !== id) : [...current, id]
      if (newItems.length === 0) return rest
      return [...rest, { fecha: diaEnVista, items: newItems }]
    })
  }

  const minutosDia = ejerciciosDelDia.reduce((s, e) => s + e.duracion, 0)
  const caloriasQuemadasDia = ejerciciosDelDia.reduce(
    (s, e) => s + caloriasQuemadas(e.tipo, e.duracion, config?.pesoKg || 70),
    0
  )
  const caloriasConsumidasDia = comidasDelDia.reduce((s, r) => s + (Number(r.calorias) || 0), 0)
  const proteinasDia = comidasDelDia.reduce((s, r) => s + (Number(r.proteinas) || 0), 0)
  const carbosDia = comidasDelDia.reduce((s, r) => s + (Number(r.carbohidratos) || 0), 0)

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
  const consejos = getConsejosDelDia(config?.objetivo, diaData, config?.pesoKg || 70)

  const objetivoLabel = OBJETIVOS.find((o) => o.value === config?.objetivo)?.label || 'Mantener peso'

  const racha = getRachaDias([...ejercicios.map((e) => ({ fecha: e.fecha })), ...comida.map((c) => ({ fecha: c.fecha }))], hoy)

  const { desde, hasta } = getRangoPorPeriodo(periodo, desdeCustom, hastaCustom)
  const fechasEnPeriodo = getFechasEnRango(desde, hasta)
  const caloriasPorDiaEnPeriodo = fechasEnPeriodo.slice(-31).map((f) => ({
    fecha: f,
    cal: comida.filter((c) => c.fecha === f).reduce((s, r) => s + (Number(r.calorias) || 0), 0),
    quemadas: ejercicios.filter((e) => e.fecha === f).reduce((s, e) => s + caloriasQuemadas(e.tipo, e.duracion, config?.pesoKg || 70), 0),
    pro: comida.filter((c) => c.fecha === f).reduce((s, r) => s + (Number(r.proteinas) || 0), 0),
  }))
  const totalCalPeriodo = caloriasPorDiaEnPeriodo.reduce((s, d) => s + d.cal, 0)
  const totalQuemadasPeriodo = caloriasPorDiaEnPeriodo.reduce((s, d) => s + d.quemadas, 0)
  const diasConEjercicioPeriodo = caloriasPorDiaEnPeriodo.filter((d) => d.quemadas > 0).length
  const diasConComidaPeriodo = caloriasPorDiaEnPeriodo.filter((d) => d.cal > 0).length
  const maxCalDiaPeriodo = Math.max(1, ...caloriasPorDiaEnPeriodo.map((d) => d.cal))
  const maxQuemadasPeriodo = Math.max(1, ...caloriasPorDiaEnPeriodo.map((d) => d.quemadas))
  const numDiasPeriodo = caloriasPorDiaEnPeriodo.length

  const diasConSuplementosPeriodo = caloriasPorDiaEnPeriodo.filter((d) => {
    const items = suplementos.find((s) => s.fecha === d.fecha)?.items ?? []
    return items.length > 0
  }).length
  const suplementosPorTipoPeriodo = (config?.suplementosActivos ?? SUPLEMENTOS.map((s) => s.id)).reduce((acc, id) => {
    acc[id] = caloriasPorDiaEnPeriodo.filter((d) => {
      const items = suplementos.find((s) => s.fecha === d.fecha)?.items ?? []
      return items.includes(id)
    }).length
    return acc
  }, {})

  function getDetalleDia(fecha) {
    const comidasDelDiaF = comida.filter((c) => c.fecha === fecha)
    const cal = comidasDelDiaF.reduce((s, r) => s + (Number(r.calorias) || 0), 0)
    const quemadas = ejercicios.filter((e) => e.fecha === fecha).reduce((s, e) => s + caloriasQuemadas(e.tipo, e.duracion, config?.pesoKg || 70), 0)
    const pro = comidasDelDiaF.reduce((s, r) => s + (Number(r.proteinas) || 0), 0)
    const carbos = comidasDelDiaF.reduce((s, r) => s + (Number(r.carbohidratos) || 0), 0)
    const numComidas = comidasDelDiaF.length
    const minutos = ejercicios.filter((e) => e.fecha === fecha).reduce((s, e) => s + e.duracion, 0)
    const sups = suplementos.find((s) => s.fecha === fecha)?.items ?? []
    const itemsComida = comidasDelDiaF.map((r) => ({ tipo: r.comida || 'Comida', descripcion: r.descripcion || '', kcal: r.calorias }))
    return { fecha, cal, quemadas, pro, carbos, numComidas, minutos, suplementos: sups, itemsComida }
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
    ...ejercicios.map((e) => e.fecha),
    ...registrosRutina.map((r) => r.fecha),
  ])
  const rutinaDelDiaCalendario = registrosRutina.filter((r) => r.fecha === diaEnVista)
  const ejerciciosDelDiaCalendario = ejercicios.filter((e) => e.fecha === diaEnVista)

  return (
    <section className="section" style={{ paddingBottom: '2rem' }}>
      <div className="container" style={{ maxWidth: '560px', paddingBottom: '1.5rem' }}>
        <header className="has-text-centered mb-5">
          <h1 className="title is-4">Mi rutina</h1>
          <p className="subtitle is-6 has-text-grey">Resumen por día y consejos según tu objetivo</p>
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

        <div className="box mb-4">
          <h2 className="title is-6 mb-2">Calendario</h2>
          <p className="is-size-7 has-text-grey mb-2">Toca un día para ver ese día. Vuelve a tocar el mismo día para quitar la selección.</p>
          {fechaCalendarioSeleccionada && (
            <button type="button" className="button is-small is-light mb-3" onClick={() => setFechaCalendarioSeleccionada(null)}>
              Ver hoy
            </button>
          )}
          <div className="is-flex is-align-items-center is-justify-content-space-between mb-3">
            <button
              type="button"
              className="button is-small is-light"
              onClick={() => {
                const [y, m] = mesCalendario.split('-').map(Number)
                const prev = new Date(y, m - 2, 1)
                setMesCalendario(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`)
              }}
            >
              ← Anterior
            </button>
            <span className="is-size-6 has-text-weight-medium">
              {new Date(mesCalendario + '-01').toLocaleDateString('es', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}
            </span>
            <button
              type="button"
              className="button is-small is-light"
              onClick={() => {
                const [y, m] = mesCalendario.split('-').map(Number)
                const next = new Date(y, m, 1)
                setMesCalendario(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
              }}
            >
              Siguiente →
            </button>
          </div>
          <div className="is-flex is-flex-wrap-wrap" style={{ gap: '2px' }}>
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
              <div key={d} className="has-text-centered has-text-grey is-size-7" style={{ width: 'calc(14.28% - 2px)', minWidth: '32px' }}>
                {d}
              </div>
            ))}
            {diasDelMes.map((celda, idx) => {
              if (celda.vacio) {
                return <div key={`v-${idx}`} style={{ width: 'calc(14.28% - 2px)', minWidth: '32px', height: '36px' }} />
              }
              const tieneActividad = fechasConActividad.has(celda.fecha)
              const seleccionado = fechaCalendarioSeleccionada === celda.fecha
              return (
                <button
                  key={celda.fecha}
                  type="button"
                  className={`button is-small has-text-weight-semibold ${seleccionado ? 'is-link' : `has-text-dark ${tieneActividad ? 'has-background-success-light' : 'is-light'}`}`}
                  style={{ width: 'calc(14.28% - 2px)', minWidth: '32px', height: '36px', padding: 0 }}
                  onClick={() => setFechaCalendarioSeleccionada(celda.fecha === fechaCalendarioSeleccionada ? null : celda.fecha)}
                >
                  {celda.dia}
                </button>
              )
            })}
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #eee' }}>
              <h3 className="title is-6 mb-3">{diaEnVista === hoy ? 'Hoy' : formatearFecha(diaEnVista)} — Lo que hiciste</h3>
              {rutinaDelDiaCalendario.length > 0 && (
                <div className="mb-4">
                  <p className="is-size-7 has-text-grey mb-2 has-text-weight-semibold">Rutina / Gimnasio</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {rutinaDelDiaCalendario.map((r) => (
                      <li key={r.id} className="box py-2 px-3 mb-2">
                        <strong>{r.ejercicio}</strong>
                        <span className="is-size-7 ml-2">
                          {r.series}×{r.repeticiones}
                          {r.pesoKg != null && r.pesoKg > 0 && ` · ${r.pesoKg} kg`}
                        </span>
                        {r.notas && <p className="is-size-7 has-text-grey mt-1 mb-0">— {r.notas}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ejerciciosDelDiaCalendario.length > 0 && (
                <div className="mb-2">
                  <p className="is-size-7 has-text-grey mb-2 has-text-weight-semibold">Ejercicios (cardio, etc.)</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {ejerciciosDelDiaCalendario.map((e) => (
                      <li key={e.id} className="box py-2 px-3 mb-2">
                        <strong>{e.nombre}</strong>
                        <span className="tag is-link is-light is-size-7 ml-2">{etiquetaTipo(e.tipo)}</span>
                        <span className="is-size-7 ml-2">{e.duracion} min</span>
                        <span className="is-size-7 has-text-success ml-1">
                          ~{caloriasQuemadas(e.tipo, e.duracion, config?.pesoKg || 70)} kcal
                        </span>
                        {e.notas && <p className="is-size-7 has-text-grey mt-1 mb-0">— {e.notas}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {rutinaDelDiaCalendario.length === 0 && ejerciciosDelDiaCalendario.length === 0 && (
                <p className="is-size-7 has-text-grey">No hay rutina ni ejercicios registrados para este día.</p>
              )}
            </div>
        </div>

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

        <h2 className="title is-6 mb-3">Resumen del día</h2>
        <div className="columns is-mobile is-multiline mb-4 resumen-dia">
          <div className="column is-half">
            <div className="box">
              <p className="is-size-7 has-text-grey">Calorías consumidas</p>
              <p className="title is-5">{caloriasConsumidasDia || '—'}</p>
            </div>
          </div>
          <div className="column is-half">
            <div className="box">
              <p className="is-size-7 has-text-grey">Calorías quemadas (ejercicio)</p>
              <p className="title is-5 has-text-success">{caloriasQuemadasDia || '—'}</p>
            </div>
          </div>
          <div className="column is-half">
            <div className="box">
              <p className="is-size-7 has-text-grey">Proteínas (g)</p>
              <p className="title is-5">{proteinasDia || '—'}</p>
            </div>
          </div>
          <div className="column is-half">
            <div className="box">
              <p className="is-size-7 has-text-grey">Carbohidratos (g)</p>
              <p className="title is-5">{carbosDia || '—'}</p>
            </div>
          </div>
          <div className="column is-half">
            <div className="box">
              <p className="is-size-7 has-text-grey">Minutos de ejercicio</p>
              <p className="title is-5">{minutosDia}</p>
            </div>
          </div>
          <div className="column is-half">
            <div className="box">
              <p className="is-size-7 has-text-grey">Comidas registradas</p>
              <p className="title is-5">{comidasDelDia.length}</p>
            </div>
          </div>
          <div className="column is-half">
            <div className="box">
              <p className="is-size-7 has-text-grey">Suplementos tomados</p>
              <p className="title is-5" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {suplementosDelDia.length === 0
                  ? 'Ninguno'
                  : suplementosDelDia.map(getSuplementoLabel).join(', ')}
              </p>
            </div>
          </div>
        </div>

        <h2 className="title is-6 mb-3">Resumen (semana o mes)</h2>
        <div className="box mb-3">
          <label className="label is-size-7">Elige el período</label>
          <div className="select is-fullwidth mb-2">
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
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
          <p className="is-size-7 has-text-grey mt-2 mb-0">Del {desde} al {hasta}</p>
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
          <p className="is-size-7 has-text-grey mt-3 mb-2">Calorías por día</p>
          <p className="is-size-7 has-text-grey mb-2">
            Referencia: máx. consumidas <strong>{maxCalDiaPeriodo}</strong> kcal · máx. quemadas <strong>{maxQuemadasPeriodo}</strong> kcal
          </p>
          <div
            ref={refZonaGrafico}
            onMouseLeave={() => { if (!refFijado.current) setTooltipDia(null) }}
            style={{ overflow: 'visible' }}
          >
          <div className="is-flex is-align-items-flex-end" style={{ gap: '4px', height: '160px' }}>
            {caloriasPorDiaEnPeriodo.map((d) => {
              const altCalPx = Math.max(4, (d.cal / maxCalDiaPeriodo) * 78)
              const altQuemPx = Math.max(4, (d.quemadas / maxQuemadasPeriodo) * 78)
              return (
                <div
                  key={d.fecha}
                  className={`is-flex-grow-1 ${tooltipDia === d.fecha ? 'has-background-light' : ''}`}
                  style={{
                    minWidth: 0,
                    cursor: 'pointer',
                    borderRadius: '6px',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    transform: tooltipDia === d.fecha ? 'scale(1.04)' : 'scale(1)',
                    transformOrigin: 'bottom',
                    boxShadow: tooltipDia === d.fecha ? '0 0 0 2px #3273dc' : 'none',
                  }}
                  onMouseEnter={() => setTooltipDia(d.fecha)}
                  onMouseLeave={() => { if (!refFijado.current) setTooltipDia(null) }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (tooltipDia === d.fecha) {
                      refFijado.current = false
                      setTooltipDia(null)
                      setDetalleFijado(false)
                    } else {
                      refFijado.current = true
                      setTooltipDia(d.fecha)
                      setDetalleFijado(true)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (tooltipDia === d.fecha) {
                        refFijado.current = false
                        setTooltipDia(null)
                        setDetalleFijado(false)
                      } else {
                        refFijado.current = true
                        setTooltipDia(d.fecha)
                        setDetalleFijado(true)
                      }
                    }
                  }}
                >
                  <div
                    className="has-background-info"
                    style={{
                      height: barrasAnimadas ? `${altCalPx}px` : '0px',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.6s ease-out',
                    }}
                  />
                  <div
                    className="has-background-success"
                    style={{
                      height: barrasAnimadas ? `${altQuemPx}px` : '0px',
                      borderRadius: '2px 2px 0 0',
                      marginTop: '2px',
                      opacity: 0.85,
                      transition: 'height 0.6s ease-out',
                    }}
                  />
                </div>
              )
            })}
          </div>
          <p className="is-size-7 has-text-grey mt-1 mb-0">
            <span className="has-background-info" style={{ padding: '0 6px', marginRight: '8px' }} /> Consumidas
            <span className="ml-3 has-background-success" style={{ padding: '0 6px', marginRight: '4px', opacity: 0.85 }} /> Quemadas
          </p>
          <div className="is-flex is-size-7 has-text-grey mt-2" style={{ gap: '2px' }}>
            {caloriasPorDiaEnPeriodo.map((d) => (
              <span key={d.fecha} className="is-flex-grow-1 has-text-centered" style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.65rem' }}>
                {d.fecha.slice(8)}/{d.fecha.slice(5, 7)}
              </span>
            ))}
          </div>
          <div className="is-flex mt-1 is-size-7" style={{ gap: '2px' }}>
            {caloriasPorDiaEnPeriodo.map((d) => (
              <div key={d.fecha} className="is-flex-grow-1 has-text-centered" style={{ minWidth: 0 }}>
                <span className="has-text-info" title={`Consumidas: ${d.cal} kcal`}>{d.cal >= 1000 ? `${(d.cal / 1000).toFixed(1)}k` : d.cal}</span>
                <span className="has-text-grey-light mx-1">/</span>
                <span className="has-text-success" title={`Quemadas: ${d.quemadas} kcal`}>{d.quemadas}</span>
              </div>
            ))}
          </div>
          <p className="is-size-7 has-text-grey mt-0 mb-0">Cada columna: <span className="has-text-info">consumidas</span> / <span className="has-text-success">quemadas</span> (kcal)</p>
          {tooltipDia && (() => {
            const det = getDetalleDia(tooltipDia)
            return (
              <div
                ref={refCuadroDetalle}
                className="box mt-3"
                style={{
                  border: '2px solid #3273dc',
                  position: 'relative',
                  zIndex: 10,
                  minHeight: 'auto',
                  maxHeight: 'min(65vh, 420px)',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  wordBreak: 'break-word',
                  marginBottom: '1rem',
                  WebkitOverflowScrolling: 'touch',
                  backgroundColor: '#fff',
                  color: '#363636',
                }}
                role="region"
                aria-label={`Detalle del día ${tooltipDia}`}
              >
                <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
                  <p className="title is-6 mb-0" style={{ fontSize: '1rem', color: '#363636' }}>{formatearFecha(det.fecha)}</p>
                  <button
                    type="button"
                    className="button is-small is-light"
                    onClick={() => { refFijado.current = false; setTooltipDia(null); setDetalleFijado(false) }}
                    aria-label="Cerrar detalle"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="columns is-mobile is-multiline" style={{ fontSize: '0.75rem' }}>
                  <div className="column is-half">
                    <span style={{ color: '#4a4a4a' }}>Calorías consumidas:</span>{' '}
                    <strong style={{ color: '#3273dc' }}>{det.cal}</strong> kcal
                  </div>
                  <div className="column is-half">
                    <span style={{ color: '#4a4a4a' }}>Calorías quemadas:</span>{' '}
                    <strong style={{ color: '#257a2a' }}>{det.quemadas}</strong> kcal
                  </div>
                  <div className="column is-half">
                    <span style={{ color: '#4a4a4a' }}>Proteínas:</span> <strong style={{ color: '#363636' }}>{det.pro}</strong> g
                  </div>
                  <div className="column is-half">
                    <span style={{ color: '#4a4a4a' }}>Carbohidratos:</span> <strong style={{ color: '#363636' }}>{det.carbos}</strong> g
                  </div>
                  <div className="column is-half">
                    <span style={{ color: '#4a4a4a' }}>Comidas registradas:</span> <strong style={{ color: '#363636' }}>{det.numComidas}</strong>
                  </div>
                  <div className="column is-half">
                    <span style={{ color: '#4a4a4a' }}>Minutos de ejercicio:</span> <strong style={{ color: '#363636' }}>{det.minutos}</strong>
                  </div>
                  {det.suplementos.length > 0 && (
                    <div className="column is-full">
                      <span style={{ color: '#4a4a4a' }}>Suplementos:</span>{' '}
                      <span style={{ color: '#363636' }}>{det.suplementos.map(getSuplementoLabel).join(', ')}</span>
                    </div>
                  )}
                  {det.itemsComida && det.itemsComida.length > 0 && (
                    <div className="column is-full mt-2 pt-2" style={{ borderTop: '1px solid #eee' }}>
                      <span style={{ color: '#4a4a4a' }}>Comidas:</span>
                      <ul className="mt-1 mb-0 pl-4 is-size-7" style={{ listStyle: 'disc', color: '#363636' }}>
                        {det.itemsComida.map((it, i) => (
                          <li key={i}>
                            <strong style={{ color: '#363636' }}>{it.tipo}</strong>
                            <span style={{ color: '#363636' }}> — {it.descripcion}</span>
                            {it.kcal != null && <span style={{ color: '#4a4a4a' }}> ({it.kcal} kcal)</span>}
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

        {consejos.length > 0 && (
          <>
            <h2 className="title is-6 mb-3">Consejos para ti</h2>
            <div className="mb-5">
              {consejos.map((c, i) => (
                <article key={i} className="message is-info is-light mb-3">
                  <div className="message-body">{c.texto}</div>
                </article>
              ))}
            </div>
          </>
        )}

        <div className="columns is-mobile is-multiline">
          <div className="column is-half">
            <Link to="/ejercicios" className="card is-block has-text-dark" style={{ height: '100%' }}>
              <div className="card-content">
                <p className="mb-2">🏃</p>
                <p className="title is-5">Ejercicios</p>
                <p className="subtitle is-7 has-text-grey">Registra actividad y calorías quemadas</p>
                <p className="mt-3">
                  <strong className="has-text-link">{minutosDia}</strong>
                  <span className="is-size-7 has-text-grey ml-1">min</span>
                  <span className="ml-2">
                    <strong className="has-text-success">{caloriasQuemadasDia}</strong>
                    <span className="is-size-7 has-text-grey ml-1">kcal</span>
                  </span>
                </p>
              </div>
            </Link>
          </div>
          <div className="column is-half">
            <Link to="/comida" className="card is-block has-text-dark" style={{ height: '100%' }}>
              <div className="card-content">
                <p className="mb-2">🥗</p>
                <p className="title is-5">Comida</p>
                <p className="subtitle is-7 has-text-grey">Calorías, proteínas, carbos, porciones</p>
                <p className="mt-3">
                  <strong className="has-text-info">{caloriasConsumidasDia || '—'}</strong>
                  <span className="is-size-7 has-text-grey ml-1">kcal</span>
                  <span className="ml-2">
                    <strong>{comidasDelDia.length}</strong>
                    <span className="is-size-7 has-text-grey ml-1">comidas</span>
                  </span>
                </p>
              </div>
            </Link>
          </div>
        </div>

        <p className="has-text-centered has-text-grey is-size-7 mt-4">
          Configura tu <Link to="/config">objetivo y peso</Link> para consejos y calorías quemadas más precisas.
        </p>
      </div>
    </section>
  )
}
