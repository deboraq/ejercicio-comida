import { useState, useEffect, useCallback } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { listAssignmentsForStudent, assignmentsToRutinasItems, deleteRoutineAssignment } from '../lib/profeDb'
import { formatearFecha, fechaToISO, caloriasQuemadasRegistroRutina } from '../utils/calorias'
import { EJERCICIOS_RUTINA, buscarEjercicios } from '../utils/rutinaEjercicios'
import { exportarRutinaAJson, rutinaDesdeJsonAsignada } from '../utils/rutinaShare'

export { exportarRutinaAJson, rutinaDesdeJsonAsignada } from '../utils/rutinaShare'

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

function clonarRutinaParaMisRutinas(orig) {
  const base = Date.now()
  const dias = (orig.dias || []).map((d, i) => ({
    id: `d${base}_${i}_${Math.random().toString(36).slice(2, 7)}`,
    nombre: d.nombre || `Día ${i + 1}`,
    ejercicios: [...(d.ejercicios || [])],
  }))
  return {
    id: `r${base}_${Math.random().toString(36).slice(2, 9)}`,
    nombre: orig.nombre || 'Rutina',
    dias,
  }
}

export default function Rutina() {
  const { user, isConfigured } = useAuth()
  const syncRutinasNube = Boolean(user && isConfigured)
  const [rutinas, setRutinas] = useStorage('rutinas', [])
  const [rutinasAsignadas, setRutinasAsignadas] = useStorage('rutinasAsignadas', [])
  const [rutinaActivaId, setRutinaActivaId] = useStorage('rutinaActivaId', '')
  const [registros, setRegistros] = useStorage('rutinaPesos', [])
  const [config] = useStorage('config', { pesoKg: 70 })

  const [origenRutinas, setOrigenRutinas] = useState('propias')
  const [assignmentsRefreshTick, setAssignmentsRefreshTick] = useState(0)
  const [vista, setVista] = useState('calendario') // 'calendario' | 'registrar' | 'configurar' | 'progreso'
  const [diaEditando, setDiaEditando] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaInput, setFechaInput] = useState(() => fechaToISO(new Date()))
  const [diaSeleccionado, setDiaSeleccionado] = useState('')
  const [nombreNuevaRutina, setNombreNuevaRutina] = useState('')
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [fechaCalendarioSeleccionada, setFechaCalendarioSeleccionada] = useState(null)
  const [periodProgreso, setPeriodProgreso] = useState('mes')
  const [desdeProgresoCustom, setDesdeProgresoCustom] = useState('')
  const [hastaProgresoCustom, setHastaProgresoCustom] = useState(() => fechaToISO(new Date()))
  /** Edición de un registro de pesos: { id, ejercicio, series, repeticiones, pesoKg, notas } */
  const [editandoRegistro, setEditandoRegistro] = useState(null)
  /** Fechas ISO con el bloque del historial plegado (Registrar → Historial por fecha). */
  const [historialFechasPlegadas, setHistorialFechasPlegadas] = useState(() => new Set())

  const hoy = fechaToISO(new Date())
  const pesoCfg = config?.pesoKg || 70

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

  useEffect(() => {
    setEditandoRegistro(null)
  }, [vista])

  useEffect(() => {
    if (origenRutinas === 'asignadas') setVista('calendario')
  }, [origenRutinas])

  const quitarAsignadaHandler = useCallback(async (r) => {
    if (!window.confirm('¿Quitar esta rutina de la lista de asignadas?')) return
    const aid = r._asignacion?.assignmentId
    if (aid && supabase) {
      const { error } = await deleteRoutineAssignment(aid)
      if (error) {
        window.alert(error.message || 'No se pudo borrar en el servidor.')
        return
      }
    }
    setRutinasAsignadas((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== r.id) : []))
  }, [setRutinasAsignadas])

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    if (!user?.id) {
      setRutinasAsignadas((prev) => {
        const arr = Array.isArray(prev) ? prev : []
        return arr.filter((x) => !x._asignacion?.assignmentId)
      })
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await listAssignmentsForStudent(user.id)
      if (cancelled) return
      if (error) return
      const rows = data || []
      if (rows.length === 0) {
        setRutinasAsignadas((prev) => {
          const arr = Array.isArray(prev) ? prev : []
          return arr.filter((x) => !x._asignacion?.assignmentId)
        })
        return
      }
      const tids = [...new Set(rows.map((d) => d.teacher_id))]
      const { data: profs } = await supabase.from('profiles').select('id, email, full_name').in('id', tids)
      if (cancelled) return
      const map = Object.fromEntries(
        (profs || []).map((p) => [p.id, (p.full_name && String(p.full_name).trim()) || p.email || 'Entrenador'])
      )
      const cloudItems = assignmentsToRutinasItems(rows, map)
      setRutinasAsignadas((prev) => {
        const arr = Array.isArray(prev) ? prev : []
        const localOnly = arr.filter((x) => !x._asignacion?.assignmentId)
        return [...cloudItems, ...localOnly]
      })
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, setRutinasAsignadas, assignmentsRefreshTick])

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

  const agregarRegistrosVarios = (lista) => {
    const fecha = fechaInput || hoy
    const validos = lista.filter(({ ejercicio, series, repeticiones }) => {
      const repsStr = typeof repeticiones === 'string' ? repeticiones.trim() : String(repeticiones ?? '').trim()
      return ejercicio && series !== '' && series != null && repsStr
    })
    if (validos.length === 0) return
    const nuevos = validos.map(({ ejercicio, series, repeticiones, pesoKg, notas, kcalManual }) => {
      const repsStr = typeof repeticiones === 'string' ? repeticiones.trim() : String(repeticiones ?? '').trim()
      const kcalM = kcalManual !== '' && kcalManual != null && Number(kcalManual) > 0 ? Math.round(Number(kcalManual)) : undefined
      const row = {
        id: crypto.randomUUID(),
        fecha,
        rutinaId: rutinaIdActual,
        diaRutinaId: diaSeleccionado,
        ejercicio,
        series: Number(series) || 1,
        repeticiones: repsStr,
        pesoKg: pesoKg !== '' && pesoKg != null ? Number(pesoKg) : undefined,
        notas: (notas || '').trim(),
      }
      if (kcalM != null) row.kcalManual = kcalM
      return row
    })
    setRegistros([...nuevos, ...registros])
  }

  const eliminarRegistro = (id) => {
    setEditandoRegistro((d) => (d?.id === id ? null : d))
    setRegistros((regs) => regs.filter((r) => r.id !== id))
  }

  const patchEditandoRegistro = (patch) => {
    setEditandoRegistro((d) => (d ? { ...d, ...patch } : null))
  }

  const iniciarEdicionRegistro = (r) => {
    setEditandoRegistro({
      id: r.id,
      ejercicio: r.ejercicio || '',
      series: String(r.series ?? ''),
      repeticiones: String(r.repeticiones ?? ''),
      pesoKg: r.pesoKg != null && Number(r.pesoKg) > 0 ? String(r.pesoKg) : '',
      notas: r.notas || '',
      kcalManual: r.kcalManual != null && Number(r.kcalManual) > 0 ? String(r.kcalManual) : '',
    })
  }

  const guardarEdicionRegistro = (d) => {
    const repsStr = String(d.repeticiones ?? '').trim()
    if (!d.ejercicio?.trim() || !repsStr || d.series === '' || d.series == null) return
    const kcalM = d.kcalManual !== '' && d.kcalManual != null && Number(d.kcalManual) > 0 ? Math.round(Number(d.kcalManual)) : undefined
    setRegistros((regs) =>
      regs.map((x) => {
        if (x.id !== d.id) return x
        const next = {
          ...x,
          ejercicio: d.ejercicio.trim(),
          series: Number(d.series) || 1,
          repeticiones: repsStr,
          pesoKg: d.pesoKg !== '' && d.pesoKg != null ? Number(d.pesoKg) : undefined,
          notas: (d.notas || '').trim(),
        }
        if (kcalM != null) next.kcalManual = kcalM
        else delete next.kcalManual
        return next
      })
    )
    setEditandoRegistro(null)
  }

  const cancelarEdicionRegistro = () => setEditandoRegistro(null)

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
      return { desde: fechaToISO(d), hasta: hoy }
    }
    if (periodProgreso === 'mes') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      return { desde: fechaToISO(d), hasta: hoy }
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
    <section className="section py-4">
      <div className="container" style={{ maxWidth: '560px' }}>
        <header className="mb-4">
          <h1 className="title is-5 mb-2">Rutina de gimnasio</h1>
          <p className="is-size-7 has-text-grey mb-0">
            En <strong>Mis rutinas</strong> creás y registrás entrenos. En <strong>Asignadas</strong> ves lo que te mandó tu entrenador desde Profe (por la nube).
          </p>
        </header>

        <div className="tabs is-toggle is-fullwidth mb-3 rutina-origen-tabs">
          <ul>
            <li className={origenRutinas === 'propias' ? 'is-active' : ''}>
              <a
                role="tab"
                aria-selected={origenRutinas === 'propias'}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setOrigenRutinas('propias')
                }}
              >
                Mis rutinas
              </a>
            </li>
            <li className={origenRutinas === 'asignadas' ? 'is-active' : ''}>
              <a
                role="tab"
                aria-selected={origenRutinas === 'asignadas'}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setOrigenRutinas('asignadas')
                }}
              >
                Asignadas
              </a>
            </li>
          </ul>
        </div>

        {origenRutinas === 'propias' ? (
        <>
        <div className="box mb-4 py-3">
          <label className="label is-size-7">Rutina activa</label>
          <div className="field has-addons">
            <div className="control is-expanded">
              <div className="select is-fullwidth is-small">
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
                className="input is-small"
                type="text"
                value={nombreNuevaRutina}
                onChange={(e) => setNombreNuevaRutina(e.target.value)}
                placeholder="Nombre de nueva rutina"
              />
            </div>
            <div className="control">
              <button type="button" className="button is-link is-small" onClick={crearRutina}>
                Crear rutina
              </button>
            </div>
          </div>
          <p className="is-size-7 has-text-grey mb-2 mt-2">Compartir con un alumno o entrenador (copia JSON de la rutina activa):</p>
          <button
            type="button"
            className="button is-light is-small is-fullwidth"
            onClick={() => {
              const s = exportarRutinaAJson(rutinaActiva)
              navigator.clipboard.writeText(s).then(() => {
                window.alert('JSON copiado. Pegalo en un mensaje o guardalo; quien reciba puede importarlo en Rutina → Asignadas.')
              }).catch(() => {
                window.prompt('Copiá manualmente este JSON:', s)
              })
            }}
          >
            Exportar rutina activa (JSON)
          </button>
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
          <div className="box mb-4 py-3">
            <h2 className="title is-6 mb-2">Días que entrenaste</h2>
            <p className="is-size-7 has-text-grey mb-3">Toca un día marcado para ver la rutina que hiciste.</p>
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
                      <FilaRegistroRutinaEditable
                        key={r.id}
                        registro={r}
                        draft={editandoRegistro}
                        pesoCfg={pesoCfg}
                        onPatch={patchEditandoRegistro}
                        onEditar={iniciarEdicionRegistro}
                        onGuardar={guardarEdicionRegistro}
                        onCancelar={cancelarEdicionRegistro}
                        onEliminar={eliminarRegistro}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {vista === 'progreso' && (
          <>
          <div className="box mb-4 py-3">
            <h2 className="title is-6 mb-2">Tu avance</h2>
            <label className="label is-size-7 mb-2">Período</label>
            <div className="select is-fullwidth is-small mb-2">
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
                  <input className="input is-small" type="date" value={desdeProgresoCustom} onChange={(e) => setDesdeProgresoCustom(e.target.value)} />
                </div>
                <div className="column">
                  <label className="label is-size-7">Hasta</label>
                  <input className="input is-small" type="date" value={hastaProgresoCustom} onChange={(e) => setHastaProgresoCustom(e.target.value)} />
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
                  <div className="box has-background-light py-2">
                    <p className="is-size-7 has-text-grey mb-0">Sesiones</p>
                    <p className="title is-6 mb-0 has-text-weight-bold">{sesionesEnPeriodo}</p>
                    <p className="is-size-7 has-text-grey mt-0">días entrenados</p>
                  </div>
                </div>
                <div className="column is-half">
                  <div className="box has-background-light py-2">
                    <p className="is-size-7 has-text-grey mb-0">Registros</p>
                    <p className="title is-6 mb-0 has-text-weight-bold">{totalRegistrosPeriodo}</p>
                    <p className="is-size-7 has-text-grey mt-0">series/ejercicios</p>
                  </div>
                </div>
                <div className="column is-half">
                  <div className="box has-background-light py-2">
                    <p className="is-size-7 has-text-grey mb-0">Ejercicios distintos</p>
                    <p className="title is-6 mb-0 has-text-weight-bold">{ejerciciosEnPeriodo}</p>
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

          <div className="box mb-4 py-3">
            <h2 className="title is-6 mb-2">Avance por ejercicio</h2>
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
          <div className="box mb-4 py-3">
            <h2 className="title is-6 mb-2">Ejercicios por día</h2>
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
                  className="input is-small"
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
                  <li key={ex} className="is-flex is-justify-content-space-between is-align-items-center py-2 subtle-divider-b">
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
            <div className="box mb-4 py-3">
              <h2 className="title is-6 mb-2">Cargar pesos del día</h2>
              <div className="field">
                <label className="label is-size-7">Fecha de la sesión</label>
                <div className="control">
                  <input className="input is-small" type="date" value={fechaInput} onChange={(e) => setFechaInput(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label className="label is-size-7">¿Qué día de la rutina hiciste?</label>
                <div className="control">
                  <div className="select is-fullwidth is-small">
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
                  Plan de <strong>{diaParaRegistrar?.nombre}</strong> (lo armás en Configurar). Marcá los que hiciste, completá series y reps — en reps podés escribir números, espacios o texto (ej. <strong>12+12</strong>, <strong>max</strong>). En <strong>Kcal</strong> podés dejar vacío (estimación automática) o un número para usar solo ese valor. Podés <strong>guardar varias tandas</strong> del mismo ejercicio el mismo día: después de guardar, volvé a marcar y completar.
                </p>
                <RegistrarPlanDelDia
                  key={`${diaSeleccionado}-${fechaInput}`}
                  ejercicios={ejerciciosParaCargar}
                  registrosDeEstaSesion={registrosDeEstaSesion}
                  pesoCfg={pesoCfg}
                  onGuardarMarcados={agregarRegistrosVarios}
                  onEliminarRegistro={eliminarRegistro}
                />
              </div>
            )}

            {registrosDeEstaSesion.length > 0 && (
              <div className="box mb-4">
                <p className="is-size-7 has-text-grey mb-2">
                  Registros de {fechaInput || hoy} — {diaParaRegistrar?.nombre}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {registrosDeEstaSesion.map((r) => (
                    <FilaRegistroRutinaEditable
                      key={r.id}
                      registro={r}
                      draft={editandoRegistro}
                      pesoCfg={pesoCfg}
                      onPatch={patchEditandoRegistro}
                      onEditar={iniciarEdicionRegistro}
                      onGuardar={guardarEdicionRegistro}
                      onCancelar={cancelarEdicionRegistro}
                      onEliminar={eliminarRegistro}
                      variant="compacto"
                    />
                  ))}
                </ul>
              </div>
            )}

            <h2 className="title is-6 mb-2">Historial por fecha</h2>
            {fechasOrdenadas.length === 0 ? (
              <div className="box has-text-centered has-text-grey is-size-7 py-3">Aún no hay registros.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {fechasOrdenadas.map((fecha) => {
                  const lista = porFecha[fecha]
                  const diaId = lista[0]?.diaRutinaId
                  const nombreDia = dias.find((d) => d.id === diaId)?.nombre || 'Día'
                  const historialAbierto = !historialFechasPlegadas.has(fecha)
                  return (
                    <li key={fecha} className="mb-3">
                      <button
                        type="button"
                        className="is-flex is-align-items-center is-justify-content-space-between mb-2"
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          padding: '0.35rem 0',
                          cursor: 'pointer',
                          color: 'inherit',
                          font: 'inherit',
                          textAlign: 'left',
                        }}
                        aria-expanded={historialAbierto}
                        onClick={() => {
                          setHistorialFechasPlegadas((prev) => {
                            const n = new Set(prev)
                            if (n.has(fecha)) n.delete(fecha)
                            else n.add(fecha)
                            return n
                          })
                        }}
                      >
                        <span className="is-size-7 has-text-grey" style={{ textTransform: 'capitalize' }}>
                          {formatearFecha(fecha)} — {nombreDia}
                        </span>
                        <span className="is-size-7 has-text-grey ml-2" aria-hidden>
                          {historialAbierto ? '▼' : '▶'}
                        </span>
                      </button>
                      {historialAbierto && (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {lista.map((r) => (
                            <FilaRegistroRutinaEditable
                              key={r.id}
                              registro={r}
                              draft={editandoRegistro}
                              pesoCfg={pesoCfg}
                              onPatch={patchEditandoRegistro}
                              onEditar={iniciarEdicionRegistro}
                              onGuardar={guardarEdicionRegistro}
                              onCancelar={cancelarEdicionRegistro}
                              onEliminar={eliminarRegistro}
                            />
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
        </>
        ) : (
          <VistaRutinasAsignadas
            rutinasAsignadas={Array.isArray(rutinasAsignadas) ? rutinasAsignadas : []}
            setRutinasAsignadas={setRutinasAsignadas}
            setRutinas={setRutinas}
            setRutinaActivaId={setRutinaActivaId}
            setOrigenRutinas={setOrigenRutinas}
            syncRutinasNube={syncRutinasNube}
            onQuitarAsignada={quitarAsignadaHandler}
            onRefreshAssignments={() => setAssignmentsRefreshTick((n) => n + 1)}
          />
        )}
      </div>
    </section>
  )
}

function VistaRutinasAsignadas({
  rutinasAsignadas,
  setRutinasAsignadas,
  setRutinas,
  setRutinaActivaId,
  setOrigenRutinas,
  syncRutinasNube,
  onQuitarAsignada,
  onRefreshAssignments,
}) {
  const [jsonText, setJsonText] = useState('')
  const [importError, setImportError] = useState(null)

  const importarDesdeJson = () => {
    setImportError(null)
    try {
      const nueva = rutinaDesdeJsonAsignada(jsonText)
      setRutinasAsignadas((prev) => [nueva, ...(Array.isArray(prev) ? prev : [])])
      setJsonText('')
      window.alert(`Se agregó «${nueva.nombre}» a tus rutinas asignadas.`)
    } catch (err) {
      setImportError(err?.message || 'No se pudo leer el JSON.')
    }
  }

  const copiarAMisRutinas = (r) => {
    const clon = clonarRutinaParaMisRutinas(r)
    setRutinas((list) => [...(list || []), clon])
    setRutinaActivaId(clon.id)
    setOrigenRutinas('propias')
    window.alert(`«${clon.nombre}» quedó en Mis rutinas y está activa. Ahí podés registrar pesos y editarla.`)
  }

  return (
    <>
      <div className="box mb-4 py-3">
        <h2 className="title is-6 mb-2">Rutinas que te mandó tu entrenador</h2>
        <p className="is-size-7 has-text-grey mb-3">
          Acá solo ves <strong>plantillas</strong> que te envió tu entrenador desde <strong>Profe</strong> (con tu cuenta
          iniciada). Para anotar pesos y entrenos, usá <strong>Copiar a mis rutinas</strong> y después andá a{' '}
          <strong>Mis rutinas → Registrar</strong>.
        </p>
        {syncRutinasNube && (
          <button type="button" className="button is-light is-small mb-0" onClick={() => onRefreshAssignments?.()}>
            Actualizar desde la nube
          </button>
        )}
      </div>

      {rutinasAsignadas.length === 0 ? (
        <div className="box py-4 mb-4 has-text-centered">
          <p className="is-size-7 has-text-grey mb-2">
            Todavía no hay rutinas acá.
            {syncRutinasNube
              ? ' Tu entrenador tiene que tenerte vinculado por correo y enviarte una rutina desde su pestaña Profe.'
              : ' Iniciá sesión para sincronizar con la nube.'}
          </p>
          {syncRutinasNube && (
            <p className="is-size-7 has-text-grey mb-0">Podés tocar «Actualizar desde la nube» arriba si acaban de enviarte una.</p>
          )}
        </div>
      ) : (
        <ul className="mb-4" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rutinasAsignadas.map((r) => (
            <li key={r.id} className="box py-3 mb-3 rutina-asignada-card">
              <div className="is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
                <div>
                  <h3 className="title is-6 mb-1">{r.nombre}</h3>
                  {r._asignacion && (
                    <p className="is-size-7 has-text-grey mb-0">
                      Asignada por <strong>{r._asignacion.por}</strong>
                      {r._asignacion.fecha ? ` · ${r._asignacion.fecha}` : ''}
                    </p>
                  )}
                  {!r._asignacion && (
                    <p className="is-size-7 has-text-grey mb-0">Importada a mano (no viene del servidor).</p>
                  )}
                </div>
                <div className="is-flex is-flex-wrap-wrap" style={{ gap: '0.35rem' }}>
                  <button type="button" className="button is-link is-small" onClick={() => copiarAMisRutinas(r)}>
                    Copiar a mis rutinas
                  </button>
                  <button type="button" className="button is-small is-light" onClick={() => onQuitarAsignada(r)}>
                    Quitar
                  </button>
                </div>
              </div>
              <ul className="mt-3 mb-0 pl-4" style={{ listStyle: 'disc' }}>
                {(r.dias || []).map((d) => (
                  <li key={d.id} className="mb-2">
                    <strong className="is-size-7">{d.nombre}</strong>
                    {(d.ejercicios || []).length === 0 ? (
                      <p className="is-size-7 has-text-grey mb-0">Sin ejercicios en la plantilla.</p>
                    ) : (
                      <ul className="mt-1 mb-0 pl-3" style={{ listStyle: 'circle' }}>
                        {(d.ejercicios || []).map((ex) => (
                          <li key={ex} className="is-size-7">
                            {ex}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <details className="box py-3 mb-4" style={{ background: 'rgba(0,0,0,0.15)' }}>
        <summary className="is-size-7" style={{ cursor: 'pointer', fontWeight: 600 }}>
          Opcional: importar JSON a mano
        </summary>
        <p className="is-size-7 has-text-grey mt-2 mb-3">
          Solo si alguien te pasó un archivo o texto JSON (caso raro). Lo normal es que las rutinas lleguen solas desde
          Profe.
        </p>
        <div className="field mb-0">
          <label className="label is-size-7">JSON (campo opcional &quot;asignadaPor&quot;: nombre del entrenador)</label>
          <textarea
            className="textarea is-small"
            rows={3}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value)
              setImportError(null)
            }}
            placeholder='{"nombre":"Semana 1","asignadaPor":"Profe Ana","dias":[{"nombre":"Día 1","ejercicios":["Press banca"]}]}'
          />
          {importError && <p className="is-size-7 has-text-danger mt-1 mb-0">{importError}</p>}
          <button type="button" className="button is-link is-small mt-2" onClick={importarDesdeJson}>
            Añadir a asignadas
          </button>
        </div>
      </details>
    </>
  )
}

function FilaRegistroRutinaEditable({
  registro,
  draft,
  pesoCfg,
  onPatch,
  onEditar,
  onGuardar,
  onCancelar,
  onEliminar,
  variant,
}) {
  const editando = draft?.id === registro.id
  const compacto = variant === 'compacto'

  const botonesAccion = (
    <div className="is-flex is-align-items-flex-start" style={{ gap: '0.15rem' }}>
      <button type="button" className="button is-small is-text" onClick={() => onEditar(registro)}>
        Editar
      </button>
      <button type="button" className="button is-small is-text has-text-grey" onClick={() => onEliminar(registro.id)} aria-label="Eliminar">
        ×
      </button>
    </div>
  )

  if (!editando) {
    if (compacto) {
      return (
        <li className="py-2 subtle-divider-b">
          <div className="is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
            <span>
              <strong>{registro.ejercicio}</strong> — {registro.series}×{registro.repeticiones}
              {registro.pesoKg != null && registro.pesoKg > 0 && <span className="has-text-grey"> · {registro.pesoKg} kg</span>}
              <span className="has-text-success"> · ~{caloriasQuemadasRegistroRutina(registro, pesoCfg)} kcal</span>
              {registro.kcalManual != null && Number(registro.kcalManual) > 0 && (
                <span className="has-text-grey is-size-7"> (manual)</span>
              )}
              {registro.notas && <span className="has-text-grey"> — {registro.notas}</span>}
            </span>
            {botonesAccion}
          </div>
        </li>
      )
    }
    return (
      <li className="box py-2 px-3 mb-2">
        <div className="is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
          <div>
            <strong>{registro.ejercicio}</strong>
            <p className="is-size-7 mt-1 mb-0">
              {registro.series}×{registro.repeticiones}
              {registro.pesoKg != null && registro.pesoKg > 0 && <span> · <strong>{registro.pesoKg} kg</strong></span>}
              <span className="has-text-success"> · ~{caloriasQuemadasRegistroRutina(registro, pesoCfg)} kcal</span>
              {registro.kcalManual != null && Number(registro.kcalManual) > 0 && (
                <span className="has-text-grey"> (manual)</span>
              )}
            </p>
            {registro.notas && <p className="is-size-7 has-text-grey mt-1 mb-0">— {registro.notas}</p>}
          </div>
          {botonesAccion}
        </div>
      </li>
    )
  }

  const formulario = (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onGuardar(draft)
      }}
    >
      <div className="field mb-2">
        <label className="label is-size-7">Ejercicio</label>
        <input className="input is-small" type="text" value={draft.ejercicio} onChange={(e) => onPatch({ ejercicio: e.target.value })} />
      </div>
      <div className="columns is-mobile mb-2">
        <div className="column">
          <label className="label is-size-7">Series</label>
          <input className="input is-small" type="number" min="1" value={draft.series} onChange={(e) => onPatch({ series: e.target.value })} />
        </div>
        <div className="column">
          <label className="label is-size-7">Reps</label>
          <input className="input is-small" type="text" value={draft.repeticiones} onChange={(e) => onPatch({ repeticiones: e.target.value })} />
        </div>
        <div className="column">
          <label className="label is-size-7">Peso (kg)</label>
          <input
            className="input is-small"
            type="number"
            min="0"
            step="0.5"
            value={draft.pesoKg}
            onChange={(e) => onPatch({ pesoKg: e.target.value })}
            placeholder="Opcional"
          />
        </div>
        <div className="column">
          <label className="label is-size-7">Kcal (opc.)</label>
          <input
            className="input is-small"
            type="number"
            min="1"
            step="1"
            value={draft.kcalManual}
            onChange={(e) => onPatch({ kcalManual: e.target.value })}
            placeholder="Auto"
          />
        </div>
      </div>
      <div className="field mb-2">
        <label className="label is-size-7">Notas</label>
        <input className="input is-small" type="text" value={draft.notas} onChange={(e) => onPatch({ notas: e.target.value })} />
      </div>
      <div className="is-flex is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
        <button type="submit" className="button is-link is-small">
          Guardar
        </button>
        <button type="button" className="button is-light is-small" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )

  if (compacto) {
    return (
      <li className="mb-2">
        <div className="box py-2 px-3">{formulario}</div>
      </li>
    )
  }
  return <li className="box py-2 px-3 mb-2">{formulario}</li>
}

function filasIniciales(ejercicios) {
  return Object.fromEntries(
    ejercicios.map((ex) => [ex, { incluir: false, series: '3', repeticiones: '', pesoKg: '', kcalManual: '', notas: '' }])
  )
}

function RegistrarPlanDelDia({ ejercicios, registrosDeEstaSesion, pesoCfg, onGuardarMarcados, onEliminarRegistro }) {
  const hayRegistrosHoy = registrosDeEstaSesion.length > 0
  const [filas, setFilas] = useState(() => filasIniciales(ejercicios))
  const [errorLote, setErrorLote] = useState(null)

  useEffect(() => {
    setFilas(filasIniciales(ejercicios))
    setErrorLote(null)
  }, [ejercicios.join('\u0001')])

  const setFila = (nombre, patch) => {
    setFilas((prev) => ({ ...prev, [nombre]: { ...prev[nombre], ...patch } }))
  }

  const regsPorEjercicio = ejercicios.reduce((acc, ex) => {
    acc[ex] = registrosDeEstaSesion.filter((r) => r.ejercicio === ex)
    return acc
  }, {})

  const pendientesGuardar = ejercicios.filter((ex) => {
    const f = filas[ex]
    if (!f?.incluir) return false
    const reps = (f.repeticiones || '').trim()
    return f.series !== '' && f.series != null && reps
  })

  const guardarLote = () => {
    setErrorLote(null)
    const marcadosSinReps = ejercicios.filter((ex) => {
      const f = filas[ex]
      return f?.incluir && (!(f.repeticiones || '').trim() || f.series === '' || f.series == null)
    })
    if (marcadosSinReps.length > 0) {
      setErrorLote('En los marcados como hechos, completá series y reps (reps puede ser texto, ej. 10 o 8+8).')
      return
    }
    const payload = pendientesGuardar.map((ex) => {
      const f = filas[ex]
      return {
        ejercicio: ex,
        series: f.series,
        repeticiones: f.repeticiones,
        pesoKg: f.pesoKg,
        kcalManual: f.kcalManual,
        notas: f.notas,
      }
    })
    if (payload.length === 0) {
      setErrorLote('Marcá al menos un ejercicio con el tilde y completá series y reps.')
      return
    }
    onGuardarMarcados(payload)
    setFilas((prev) => {
      const next = { ...prev }
      for (const ex of pendientesGuardar) {
        next[ex] = { incluir: false, series: '3', repeticiones: '', pesoKg: '', kcalManual: '', notas: '' }
      }
      return next
    })
  }

  return (
    <div>
      {errorLote && (
        <div className="notification is-warning is-light is-size-7 py-2 px-3 mb-3">{errorLote}</div>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {ejercicios.map((ex) => {
          const ya = regsPorEjercicio[ex] || []
          const f = filas[ex] || { incluir: false, series: '3', repeticiones: '', pesoKg: '', kcalManual: '', notas: '' }
          return (
            <li key={ex} className="mb-4 pb-3 subtle-divider-b">
              <p className="is-size-7 has-text-weight-semibold mb-2">{ex}</p>
              {ya.length > 0 && (
                <div className="mb-2">
                  {ya.map((r) => (
                    <div key={r.id} className="is-flex is-justify-content-space-between is-align-items-center is-size-7 has-text-success mb-1">
                      <span>
                        ✓ {r.series}×{r.repeticiones}
                        {r.pesoKg != null && r.pesoKg > 0 && <span className="has-text-grey"> · {r.pesoKg} kg</span>}
                        <span className="has-text-success"> · ~{caloriasQuemadasRegistroRutina(r, pesoCfg)} kcal</span>
                        {r.notas && <span className="has-text-grey"> — {r.notas}</span>}
                      </span>
                      <button type="button" className="button is-small is-text has-text-grey" onClick={() => onEliminarRegistro(r.id)} aria-label="Quitar registro">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="field mb-0">
                <label className="checkbox is-size-7">
                  <input
                    type="checkbox"
                    checked={f.incluir}
                    onChange={(e) => setFila(ex, { incluir: e.target.checked })}
                  />
                  <span className="ml-2">Lo hice (registrar ahora)</span>
                </label>
              </div>
              {f.incluir && (
                <div className="columns is-mobile is-multiline mt-2 mb-0">
                  <div className="column is-narrow">
                    <label className="label is-size-7 mb-1">Series</label>
                    <input
                      className="input is-small"
                      type="number"
                      min="1"
                      max="99"
                      value={f.series}
                      onChange={(e) => setFila(ex, { series: e.target.value })}
                      style={{ width: '4.5rem' }}
                    />
                  </div>
                  <div className="column">
                    <label className="label is-size-7 mb-1">Reps</label>
                    <input
                      className="input is-small"
                      type="text"
                      value={f.repeticiones}
                      onChange={(e) => setFila(ex, { repeticiones: e.target.value })}
                      placeholder="Ej: 10, 8+8, max, 12 cada lado…"
                      autoComplete="off"
                    />
                  </div>
                  <div className="column is-narrow">
                    <label className="label is-size-7 mb-1">Peso (kg)</label>
                    <input
                      className="input is-small"
                      type="number"
                      min="0"
                      step="0.5"
                      value={f.pesoKg}
                      onChange={(e) => setFila(ex, { pesoKg: e.target.value })}
                      placeholder="—"
                      style={{ width: '5rem' }}
                    />
                  </div>
                  <div className="column is-narrow">
                    <label className="label is-size-7 mb-1">Kcal</label>
                    <input
                      className="input is-small"
                      type="number"
                      min="1"
                      step="1"
                      value={f.kcalManual}
                      onChange={(e) => setFila(ex, { kcalManual: e.target.value })}
                      placeholder="Auto"
                      style={{ width: '4.5rem' }}
                      title="Opcional: si lo cargás, reemplaza la estimación por series"
                    />
                  </div>
                </div>
              )}
              {f.incluir && (
                <input
                  className="input is-small is-size-7 mt-2"
                  type="text"
                  value={f.notas}
                  onChange={(e) => setFila(ex, { notas: e.target.value })}
                  placeholder="Notas (opcional)"
                />
              )}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="button is-link is-fullwidth is-small mt-2"
        onClick={guardarLote}
        disabled={pendientesGuardar.length === 0}
      >
        Guardar lo marcado{pendientesGuardar.length > 0 ? ` (${pendientesGuardar.length})` : ''}
      </button>
      {hayRegistrosHoy && (
        <p className="is-size-7 has-text-grey mt-2 mb-0">
          ¿Otra tanda del mismo día? Volvé a marcar &quot;Lo hice&quot;, completá series/reps y tocá Guardar.
        </p>
      )}
    </div>
  )
}
