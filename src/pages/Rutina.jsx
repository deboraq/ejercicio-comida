import { useState, useEffect } from 'react'
import { useStorage } from '../hooks/useStorage'
import { formatearFecha } from '../utils/calorias'
import { EJERCICIOS_RUTINA, buscarEjercicios } from '../utils/rutinaEjercicios'

function crearDia(num) {
  return { id: `d${Date.now()}_${num}`, nombre: `Día ${num}`, ejercicios: [] }
}

function rutinaVacia(id = null) {
  return {
    id: id || `r${Date.now()}`,
    nombre: 'Nueva rutina',
    dias: [crearDia(1), crearDia(2), crearDia(3)],
  }
}

const RUTINA_INICIAL = [
  { id: 'r_default', nombre: 'Rutina principal', dias: [{ id: 'd1', nombre: 'Día 1', ejercicios: [] }, { id: 'd2', nombre: 'Día 2', ejercicios: [] }, { id: 'd3', nombre: 'Día 3', ejercicios: [] }] },
]

function migrarPlantillaAntigua(plantilla) {
  if (!plantilla || !plantilla.dias) return null
  return {
    id: 'r1',
    nombre: 'Rutina principal',
    dias: plantilla.dias.map((d) => ({ ...d, id: d.id || `d_${d.nombre}` })),
  }
}

export default function Rutina() {
  const [rutinas, setRutinas] = useStorage('rutinas', [])
  const [rutinaActivaId, setRutinaActivaId] = useStorage('rutinaActivaId', '')
  const [registros, setRegistros] = useStorage('rutinaPesos', [])

  const [vista, setVista] = useState('calendario') // 'calendario' | 'registrar' | 'configurar' | 'progreso'
  const [diaEditando, setDiaEditando] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaInput, setFechaInput] = useState(new Date().toISOString().slice(0, 10))
  const [diaSeleccionado, setDiaSeleccionado] = useState('')
  const [nombreNuevaRutina, setNombreNuevaRutina] = useState('')
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [fechaCalendarioSeleccionada, setFechaCalendarioSeleccionada] = useState(null)
  const [periodProgreso, setPeriodProgreso] = useState('mes')
  const [desdeProgresoCustom, setDesdeProgresoCustom] = useState('')
  const [hastaProgresoCustom, setHastaProgresoCustom] = useState(() => new Date().toISOString().slice(0, 10))

  const hoy = new Date().toISOString().slice(0, 10)

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

  useEffect(() => {
    if (!Array.isArray(rutinas) || rutinas.length > 0) return
    try {
      const old = localStorage.getItem('rutinaPlantilla')
      if (old) {
        const plantilla = JSON.parse(old)
        const migrada = migrarPlantillaAntigua(plantilla)
        if (migrada) {
          setRutinas([migrada])
          setRutinaActivaId(migrada.id)
          return
        }
      }
    } catch (_) {}
    setRutinas(RUTINA_INICIAL)
    setRutinaActivaId('r_default')
  }, [])

  const listaRutinas = Array.isArray(rutinas) && rutinas.length > 0 ? rutinas : RUTINA_INICIAL
  const rutinaActiva = listaRutinas.find((r) => r.id === (rutinaActivaId || listaRutinas[0]?.id)) || listaRutinas[0]
  const rutinaIdActual = rutinaActiva?.id || listaRutinas[0]?.id
  const dias = rutinaActiva?.dias || []
  const diaActual = dias.find((d) => d.id === diaEditando) || dias[0]
  const diaParaRegistrar = dias.find((d) => d.id === diaSeleccionado) || dias[0]
  const ejerciciosDelDia = diaActual?.ejercicios || []
  const ejerciciosParaCargar = diaParaRegistrar?.ejercicios || []

  useEffect(() => {
    if (dias.length > 0) {
      const idPrimero = dias[0].id
      if (!dias.some((d) => d.id === diaEditando)) setDiaEditando(idPrimero)
      if (!dias.some((d) => d.id === diaSeleccionado)) setDiaSeleccionado(idPrimero)
    }
  }, [rutinaIdActual])

  const resultadosBusqueda = busqueda.trim() ? buscarEjercicios(busqueda) : []

  const actualizarRutina = (fn) => {
    setRutinas((list) =>
      list.map((r) => (r.id === rutinaIdActual ? fn(r) : r))
    )
  }

  const añadirDia = () => {
    const num = dias.length + 1
    actualizarRutina((r) => ({
      ...r,
      dias: [...(r.dias || []), crearDia(num)],
    }))
  }

  const quitarDia = (idDia) => {
    if (dias.length <= 1) return
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.filter((d) => d.id !== idDia),
    }))
    if (diaEditando === idDia) setDiaEditando(dias.find((d) => d.id !== idDia)?.id || '')
    if (diaSeleccionado === idDia) setDiaSeleccionado(dias.find((d) => d.id !== idDia)?.id || '')
  }

  const añadirEjercicioAlDia = (nombre) => {
    if (!nombre || (diaActual?.ejercicios || []).includes(nombre)) return
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) =>
        d.id === diaEditando
          ? { ...d, ejercicios: [...(d.ejercicios || []), nombre] }
          : d
      ),
    }))
    setBusqueda('')
  }

  const quitarEjercicioDelDia = (nombre) => {
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) =>
        d.id === diaEditando
          ? { ...d, ejercicios: (d.ejercicios || []).filter((e) => e !== nombre) }
          : d
      ),
    }))
  }

  const crearRutina = () => {
    const nombre = nombreNuevaRutina.trim() || 'Nueva rutina'
    const nueva = { ...rutinaVacia(), id: `r${Date.now()}`, nombre }
    setRutinas((list) => [...(list || []), nueva])
    setRutinaActivaId(nueva.id)
    setNombreNuevaRutina('')
  }

  const eliminarRutina = (id) => {
    if (listaRutinas.length <= 1) return
    setRutinas((list) => list.filter((r) => r.id !== id))
    setRegistros((regs) => regs.filter((r) => r.rutinaId !== id))
    if (rutinaActivaId === id) setRutinaActivaId(listaRutinas.find((r) => r.id !== id)?.id || '')
  }

  const agregarRegistro = (ejercicio, series, repeticiones, pesoKg, notas) => {
    if (!ejercicio || !series || !repeticiones) return
    const fecha = fechaInput || hoy
    setRegistros([
      {
        id: crypto.randomUUID(),
        fecha,
        rutinaId: rutinaIdActual,
        diaRutinaId: diaSeleccionado,
        ejercicio,
        series: Number(series),
        repeticiones: Number(repeticiones),
        pesoKg: pesoKg ? Number(pesoKg) : undefined,
        notas: (notas || '').trim(),
      },
      ...registros,
    ])
  }

  const eliminarRegistro = (id) => {
    setRegistros(registros.filter((r) => r.id !== id))
  }

  const registrosDeEstaSesion = registros.filter(
    (r) =>
      r.fecha === (fechaInput || hoy) &&
      r.diaRutinaId === diaSeleccionado &&
      (r.rutinaId || r.diaRutinaId) && (r.rutinaId === rutinaIdActual || !r.rutinaId)
  )
  const registrosRutina = registros.filter((r) => !r.rutinaId || r.rutinaId === rutinaIdActual)
  const porFecha = registrosRutina.reduce((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = []
    acc[r.fecha].push(r)
    return acc
  }, {})
  const fechasOrdenadas = Object.keys(porFecha).sort((a, b) => b.localeCompare(a))
  const fechasConEntreno = new Set(registrosRutina.map((r) => r.fecha))
  const registrosDiaSeleccionado = fechaCalendarioSeleccionada
    ? (porFecha[fechaCalendarioSeleccionada] || [])
    : []

  const progresoPorEjercicio = registrosRutina.reduce((acc, r) => {
    const name = r.ejercicio || 'Sin nombre'
    if (!acc[name]) acc[name] = []
    acc[name].push({ ...r, fecha: r.fecha, pesoKg: r.pesoKg != null ? Number(r.pesoKg) : null })
    return acc
  }, {})
  const progresoOrdenado = Object.entries(progresoPorEjercicio)
    .map(([ejercicio, lista]) => {
      const ordenada = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha))
      const ultima = ordenada[0]
      const anterior = ordenada[1]
      const pesos = ordenada.map((x) => x.pesoKg).filter((p) => p != null && p > 0)
      const mejorPeso = pesos.length > 0 ? Math.max(...pesos) : null
      let tendencia = '—'
      if (ultima?.pesoKg != null && anterior?.pesoKg != null) {
        if (ultima.pesoKg > anterior.pesoKg) tendencia = '↑'
        else if (ultima.pesoKg < anterior.pesoKg) tendencia = '↓'
      }
      return { ejercicio, ultima, anterior, mejorPeso, tendencia, totalSesiones: ordenada.length }
    })
    .filter((p) => p.ultima)
    .sort((a, b) => (b.ultima?.fecha || '').localeCompare(a.ultima?.fecha || ''))

  const getDesdeHastaProgreso = () => {
    if (periodProgreso === 'semana') {
      const d = new Date()
      d.setDate(d.getDate() - 6)
      return { desde: d.toISOString().slice(0, 10), hasta: hoy }
    }
    if (periodProgreso === 'mes') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      return { desde: d.toISOString().slice(0, 10), hasta: hoy }
    }
    return { desde: desdeProgresoCustom || hoy, hasta: hastaProgresoCustom || hoy }
  }
  const { desde: desdeProgreso, hasta: hastaProgreso } = getDesdeHastaProgreso()
  const registrosEnPeriodo = registrosRutina.filter((r) => r.fecha >= desdeProgreso && r.fecha <= hastaProgreso)
  const sesionesEnPeriodo = new Set(registrosEnPeriodo.map((r) => r.fecha)).size
  const totalRegistrosPeriodo = registrosEnPeriodo.length
  const ejerciciosEnPeriodo = new Set(registrosEnPeriodo.map((r) => r.ejercicio)).size
  const progresoPorEjercicioPeriodo = registrosEnPeriodo.reduce((acc, r) => {
    const name = r.ejercicio || 'Sin nombre'
    if (!acc[name]) acc[name] = []
    acc[name].push({ ...r, fecha: r.fecha, pesoKg: r.pesoKg != null ? Number(r.pesoKg) : null })
    return acc
  }, {})
  const progresoOrdenadoEnPeriodo = Object.entries(progresoPorEjercicioPeriodo)
    .map(([ejercicio, lista]) => {
      const ordenada = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha))
      const ultima = ordenada[0]
      const anterior = ordenada[1]
      const pesos = ordenada.map((x) => x.pesoKg).filter((p) => p != null && p > 0)
      const mejorPeso = pesos.length > 0 ? Math.max(...pesos) : null
      let tendencia = '—'
      if (ultima?.pesoKg != null && anterior?.pesoKg != null) {
        if (ultima.pesoKg > anterior.pesoKg) tendencia = '↑'
        else if (ultima.pesoKg < anterior.pesoKg) tendencia = '↓'
      }
      return { ejercicio, ultima, anterior, mejorPeso, tendencia, totalSesiones: ordenada.length }
    })
    .filter((p) => p.ultima)
    .sort((a, b) => (b.ultima?.fecha || '').localeCompare(a.ultima?.fecha || ''))
  const conMejora = progresoOrdenadoEnPeriodo.filter((p) => p.tendencia === '↑').length
  const conBaja = progresoOrdenadoEnPeriodo.filter((p) => p.tendencia === '↓').length
  const sinCambio = progresoOrdenadoEnPeriodo.filter((p) => p.tendencia === '—').length

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: '560px' }}>
        <header className="mb-5">
          <h1 className="title is-4">Rutina de gimnasio</h1>
          <p className="subtitle is-6 has-text-grey">Crea varias rutinas, configura días y registra pesos.</p>
        </header>

        <div className="box mb-4">
          <label className="label">Rutina activa</label>
          <div className="field has-addons">
            <div className="control is-expanded">
              <div className="select is-fullwidth">
                <select
                  value={rutinaActivaId || rutinaIdActual}
                  onChange={(e) => setRutinaActivaId(e.target.value)}
                >
                  {listaRutinas.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            {listaRutinas.length > 1 && (
              <div className="control">
                <button
                  type="button"
                  className="button is-danger is-light"
                  onClick={() => window.confirm('¿Eliminar esta rutina?') && eliminarRutina(rutinaIdActual)}
                  title="Eliminar rutina"
                >
                  🗑
                </button>
              </div>
            )}
          </div>
          <div className="field has-addons mt-2">
            <div className="control is-expanded">
              <input
                className="input"
                type="text"
                value={nombreNuevaRutina}
                onChange={(e) => setNombreNuevaRutina(e.target.value)}
                placeholder="Nombre de nueva rutina"
              />
            </div>
            <div className="control">
              <button type="button" className="button is-link" onClick={crearRutina}>
                Crear rutina
              </button>
            </div>
          </div>
        </div>

        <div className="tabs is-boxed mb-4" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <ul style={{ flexWrap: 'nowrap' }}>
            <li className={vista === 'calendario' ? 'is-active' : ''}>
              <a onClick={() => setVista('calendario')} role="tab" aria-selected={vista === 'calendario'}>Calendario</a>
            </li>
            <li className={vista === 'registrar' ? 'is-active' : ''}>
              <a onClick={() => setVista('registrar')} role="tab" aria-selected={vista === 'registrar'}>Registrar</a>
            </li>
            <li className={vista === 'configurar' ? 'is-active' : ''}>
              <a onClick={() => setVista('configurar')} role="tab" aria-selected={vista === 'configurar'}>Configurar</a>
            </li>
            <li className={vista === 'progreso' ? 'is-active' : ''}>
              <a onClick={() => setVista('progreso')} role="tab" aria-selected={vista === 'progreso'}>Progreso</a>
            </li>
          </ul>
        </div>

        {vista === 'calendario' && (
          <div className="box mb-4">
            <h2 className="title is-6 mb-3">Días que entrenaste</h2>
            <p className="is-size-7 has-text-grey mb-3">Toca un día marcado para ver la rutina que hiciste.</p>
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
                const tieneEntreno = fechasConEntreno.has(celda.fecha)
                const seleccionado = fechaCalendarioSeleccionada === celda.fecha
                return (
                  <button
                    key={celda.fecha}
                    type="button"
                    className={`button is-small has-text-weight-semibold ${seleccionado ? 'is-link' : `has-text-dark ${tieneEntreno ? 'has-background-success-light' : 'is-light'}`}`}
                    style={{ width: 'calc(14.28% - 2px)', minWidth: '32px', height: '36px', padding: 0 }}
                    onClick={() => setFechaCalendarioSeleccionada(celda.fecha)}
                  >
                    {celda.dia}
                  </button>
                )
              })}
            </div>
            {fechaCalendarioSeleccionada && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid #eee' }}>
                <h3 className="title is-6 mb-2">
                  Rutina del {formatearFecha(fechaCalendarioSeleccionada)}
                </h3>
                {registrosDiaSeleccionado.length === 0 ? (
                  <p className="is-size-7 has-text-grey">No hay registros para este día.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {registrosDiaSeleccionado.map((r) => (
                      <li key={r.id} className="box py-3 px-4 mb-2">
                        <div className="is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
                          <div>
                            <strong>{r.ejercicio}</strong>
                            <p className="is-size-7 mt-1 mb-0">
                              {r.series}×{r.repeticiones}
                              {r.pesoKg != null && r.pesoKg > 0 && <span> · <strong>{r.pesoKg} kg</strong></span>}
                            </p>
                            {r.notas && <p className="is-size-7 has-text-grey mt-1 mb-0">— {r.notas}</p>}
                          </div>
                          <button type="button" className="button is-small is-text has-text-grey" onClick={() => eliminarRegistro(r.id)}>×</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {vista === 'progreso' && (
          <>
          <div className="box mb-4">
            <h2 className="title is-6 mb-2">Tu avance</h2>
            <label className="label is-size-7 mb-2">Período</label>
            <div className="select is-fullwidth mb-2">
              <select value={periodProgreso} onChange={(e) => setPeriodProgreso(e.target.value)}>
                <option value="semana">Última semana (7 días)</option>
                <option value="mes">Último mes (30 días)</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
            {periodProgreso === 'personalizado' && (
              <div className="columns is-mobile mb-2">
                <div className="column">
                  <label className="label is-size-7">Desde</label>
                  <input className="input" type="date" value={desdeProgresoCustom} onChange={(e) => setDesdeProgresoCustom(e.target.value)} />
                </div>
                <div className="column">
                  <label className="label is-size-7">Hasta</label>
                  <input className="input" type="date" value={hastaProgresoCustom} onChange={(e) => setHastaProgresoCustom(e.target.value)} />
                </div>
              </div>
            )}
            <p className="is-size-7 has-text-grey mb-3">
              Del {desdeProgreso} al {hastaProgreso}.
            </p>
            {registrosEnPeriodo.length === 0 ? (
              <p className="has-text-grey is-size-7 mb-0">Aún no hay registros en este período. Cuando registres sesiones, aquí verás tu progreso.</p>
            ) : (
              <div className="columns is-mobile is-multiline">
                <div className="column is-half">
                  <div className="box has-background-light py-3">
                    <p className="is-size-7 has-text-grey mb-0">Sesiones</p>
                    <p className="title is-5 mb-0 has-text-dark" style={{ color: '#363636' }}>{sesionesEnPeriodo}</p>
                    <p className="is-size-7 has-text-grey mt-0">días entrenados</p>
                  </div>
                </div>
                <div className="column is-half">
                  <div className="box has-background-light py-3">
                    <p className="is-size-7 has-text-grey mb-0">Registros</p>
                    <p className="title is-5 mb-0 has-text-dark" style={{ color: '#363636' }}>{totalRegistrosPeriodo}</p>
                    <p className="is-size-7 has-text-grey mt-0">series/ejercicios</p>
                  </div>
                </div>
                <div className="column is-half">
                  <div className="box has-background-light py-3">
                    <p className="is-size-7 has-text-grey mb-0">Ejercicios distintos</p>
                    <p className="title is-5 mb-0 has-text-dark" style={{ color: '#363636' }}>{ejerciciosEnPeriodo}</p>
                  </div>
                </div>
                <div className="column is-half">
                  <div className="box has-background-light py-3">
                    <p className="is-size-7 has-text-grey mb-0">Tendencia general</p>
                    <p className="mb-0">
                      <span className="has-text-success" title="Subiste peso">↑ {conMejora}</span>
                      <span className="mx-2">·</span>
                      <span className="has-text-warning" title="Bajaste peso">↓ {conBaja}</span>
                      <span className="mx-2">·</span>
                      <span className="has-text-grey">— {sinCambio}</span>
                    </p>
                    <p className="is-size-7 has-text-grey mt-0">ejercicios (↑ subiste / ↓ bajaste)</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="box mb-5">
            <h2 className="title is-6 mb-3">Avance por ejercicio</h2>
            <p className="is-size-7 has-text-grey mb-4">
              Comparación: última sesión, anterior y mejor peso. ↑ subiste, ↓ bajaste.
            </p>
            {progresoOrdenadoEnPeriodo.length === 0 ? (
              <div className="has-text-grey has-text-centered py-4">
                <p className="mb-0">Aún no hay registros para medir progreso en este período.</p>
                <p className="is-size-7 mt-2 mb-0">Registra sesiones en la pestaña &quot;Registrar&quot; o elige otro período arriba.</p>
              </div>
            ) : (
              <div className="columns is-mobile is-multiline" style={{ gap: '0.75rem' }}>
                {progresoOrdenadoEnPeriodo.map(({ ejercicio, ultima, anterior, mejorPeso, tendencia, totalSesiones }) => (
                  <div key={ejercicio} className="column is-full">
                    <div className="box py-3 px-4">
                      <div className="is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
                        <div>
                          <p className="title is-6 mb-1">{ejercicio}</p>
                          <p className="is-size-7 has-text-grey mb-0">
                            {totalSesiones} sesión{totalSesiones !== 1 ? 'es' : ''} registrada{totalSesiones !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <span className={`tag is-medium ${tendencia === '↑' ? 'is-success' : tendencia === '↓' ? 'is-warning is-light' : 'is-light'}`} title={tendencia === '↑' ? 'Subiste peso' : tendencia === '↓' ? 'Bajaste peso' : 'Sin cambio'}>
                          {tendencia}
                        </span>
                      </div>
                      <div className="columns is-mobile mt-2 mb-0 is-size-7">
                        <div className="column">
                          <span className="has-text-grey">Última vez:</span>
                          <p className="mb-0 mt-1">
                            {formatearFecha(ultima.fecha)} — {ultima.series}×{ultima.repeticiones}
                            {ultima.pesoKg != null && ultima.pesoKg > 0 && <strong className="ml-1">· {ultima.pesoKg} kg</strong>}
                          </p>
                        </div>
                        {anterior && (
                          <div className="column">
                            <span className="has-text-grey">Anterior:</span>
                            <p className="mb-0 mt-1">
                              {formatearFecha(anterior.fecha)} — {anterior.series}×{anterior.repeticiones}
                              {anterior.pesoKg != null && anterior.pesoKg > 0 && <span className="ml-1">· {anterior.pesoKg} kg</span>}
                            </p>
                          </div>
                        )}
                        {mejorPeso != null && (
                          <div className="column">
                            <span className="has-text-grey">Mejor peso:</span>
                            <p className="mb-0 mt-1 has-text-success"><strong>{mejorPeso} kg</strong></p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
        )}

        {vista === 'configurar' && (
          <div className="box mb-5">
            <h2 className="title is-6 mb-3">Ejercicios por día</h2>
            <div className="is-flex is-flex-wrap-wrap is-align-items-center mb-3" style={{ gap: '0.5rem' }}>
              {dias.map((d) => (
                <span key={d.id} className="tag is-medium">
                  {d.nombre}
                  <button
                    type="button"
                    className="delete is-small ml-1"
                    onClick={() => quitarDia(d.id)}
                    disabled={dias.length <= 1}
                    aria-label={`Quitar ${d.nombre}`}
                  />
                </span>
              ))}
              <button type="button" className="button is-small is-light" onClick={añadirDia}>
                + Añadir día
              </button>
            </div>
            <div className="buttons are-small mb-3">
              {dias.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`button ${diaEditando === d.id ? 'is-link' : 'is-light'}`}
                  onClick={() => setDiaEditando(d.id)}
                >
                  {d.nombre}
                </button>
              ))}
            </div>
            <p className="is-size-7 has-text-grey mb-2">
              <strong>{diaActual?.nombre}</strong> — Busca y añade ejercicios:
            </p>
            <div className="field has-addons mb-3">
              <div className="control is-expanded">
                <input
                  className="input"
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar ejercicio..."
                />
              </div>
            </div>
            {resultadosBusqueda.length > 0 && (
              <div className="mb-3" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <p className="is-size-7 has-text-grey mb-1">Clic para añadir a {diaActual?.nombre}</p>
                {resultadosBusqueda.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className="button is-small is-light is-fullwidth has-text-left mb-1"
                    onClick={() => añadirEjercicioAlDia(ex)}
                  >
                    + {ex}
                  </button>
                ))}
              </div>
            )}
            {busqueda.trim() && resultadosBusqueda.length === 0 && (
              <div className="mb-3">
                <button
                  type="button"
                  className="button is-small is-light"
                  onClick={() => añadirEjercicioAlDia(busqueda.trim())}
                >
                  + Añadir &quot;{busqueda.trim()}&quot; a {diaActual?.nombre}
                </button>
              </div>
            )}
            <p className="is-size-7 has-text-grey mb-2">En {diaActual?.nombre} tienes:</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ejerciciosDelDia.length === 0 ? (
                <li className="is-size-7 has-text-grey">Ninguno aún. Usa el buscador.</li>
              ) : (
                ejerciciosDelDia.map((ex) => (
                  <li key={ex} className="is-flex is-justify-content-space-between is-align-items-center py-2" style={{ borderBottom: '1px solid #eee' }}>
                    <span>{ex}</span>
                    <button type="button" className="button is-small is-text has-text-grey" onClick={() => quitarEjercicioDelDia(ex)}>Quitar</button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {vista === 'registrar' && (
          <>
            <div className="box mb-4">
              <h2 className="title is-6 mb-4">Cargar pesos del día</h2>
              <div className="field">
                <label className="label">Fecha de la sesión</label>
                <div className="control">
                  <input className="input" type="date" value={fechaInput} onChange={(e) => setFechaInput(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label className="label">¿Qué día de la rutina hiciste?</label>
                <div className="control">
                  <div className="select is-fullwidth">
                    <select value={diaSeleccionado} onChange={(e) => setDiaSeleccionado(e.target.value)}>
                      {dias.map((d) => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {ejerciciosParaCargar.length === 0 ? (
              <div className="box has-text-grey">
                <p className="mb-0">No hay ejercicios en <strong>{diaParaRegistrar?.nombre}</strong>. Ve a &quot;Configurar rutina&quot; y añade ejercicios.</p>
              </div>
            ) : (
              <div className="box mb-4">
                <p className="is-size-7 has-text-grey mb-3">
                  Ejercicios de <strong>{diaParaRegistrar?.nombre}</strong> — añade series, reps y peso.
                </p>
                <RegistroRapido key={diaSeleccionado} ejercicios={ejerciciosParaCargar} onAñadir={agregarRegistro} />
              </div>
            )}

            {registrosDeEstaSesion.length > 0 && (
              <div className="box mb-4">
                <p className="is-size-7 has-text-grey mb-2">
                  Registros de {fechaInput || hoy} — {diaParaRegistrar?.nombre}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {registrosDeEstaSesion.map((r) => (
                    <li key={r.id} className="is-flex is-justify-content-space-between is-align-items-center py-2" style={{ borderBottom: '1px solid #eee' }}>
                      <span>
                        <strong>{r.ejercicio}</strong> — {r.series}×{r.repeticiones}
                        {r.pesoKg != null && r.pesoKg > 0 && <span className="has-text-grey"> · {r.pesoKg} kg</span>}
                      </span>
                      <button type="button" className="button is-small is-text has-text-grey" onClick={() => eliminarRegistro(r.id)}>×</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <h2 className="title is-6 mb-3">Historial por fecha</h2>
            {fechasOrdenadas.length === 0 ? (
              <div className="box has-text-centered has-text-grey">Aún no hay registros.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {fechasOrdenadas.map((fecha) => {
                  const lista = porFecha[fecha]
                  const diaId = lista[0]?.diaRutinaId
                  const nombreDia = dias.find((d) => d.id === diaId)?.nombre || 'Día'
                  return (
                    <li key={fecha} className="mb-4">
                      <p className="is-size-7 has-text-grey mb-2" style={{ textTransform: 'capitalize' }}>
                        {formatearFecha(fecha)} — {nombreDia}
                      </p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {lista.map((r) => (
                          <li key={r.id} className="box py-3 px-4 mb-2">
                            <div className="is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
                              <div>
                                <strong>{r.ejercicio}</strong>
                                <p className="is-size-7 mt-1 mb-0">
                                  {r.series}×{r.repeticiones}
                                  {r.pesoKg != null && r.pesoKg > 0 && <span> · <strong>{r.pesoKg} kg</strong></span>}
                                </p>
                                {r.notas && <p className="is-size-7 has-text-grey mt-1 mb-0">— {r.notas}</p>}
                              </div>
                              <button type="button" className="button is-small is-text has-text-grey" onClick={() => eliminarRegistro(r.id)}>×</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function RegistroRapido({ ejercicios, onAñadir }) {
  const [ejercicio, setEjercicio] = useState(ejercicios[0] || '')
  const [series, setSeries] = useState('')
  const [repeticiones, setRepeticiones] = useState('')
  const [pesoKg, setPesoKg] = useState('')
  const [notas, setNotas] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!ejercicio || !series || !repeticiones) return
    onAñadir(ejercicio, series, repeticiones, pesoKg, notas)
    setSeries('')
    setRepeticiones('')
    setPesoKg('')
    setNotas('')
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label className="label is-size-7">Ejercicio</label>
        <div className="control">
          <div className="select is-fullwidth">
            <select value={ejercicio} onChange={(e) => setEjercicio(e.target.value)}>
              {ejercicios.map((ex) => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="columns is-mobile">
        <div className="column">
          <div className="field">
            <label className="label is-size-7">Series</label>
            <input className="input" type="number" min="1" max="20" value={series} onChange={(e) => setSeries(e.target.value)} placeholder="3" />
          </div>
        </div>
        <div className="column">
          <div className="field">
            <label className="label is-size-7">Reps</label>
            <input className="input" type="number" min="1" max="100" value={repeticiones} onChange={(e) => setRepeticiones(e.target.value)} placeholder="10" />
          </div>
        </div>
        <div className="column">
          <div className="field">
            <label className="label is-size-7">Peso (kg)</label>
            <input className="input" type="number" min="0" step="0.5" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} placeholder="20" />
          </div>
        </div>
      </div>
      <div className="field">
        <input className="input is-size-7" type="text" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (opcional)" />
      </div>
      <button type="submit" className="button is-link is-fullwidth" disabled={!ejercicio || !series || !repeticiones}>
        Añadir registro
      </button>
    </form>
  )
}
