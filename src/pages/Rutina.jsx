import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { listAssignmentsForStudent, assignmentsToRutinasItems, deleteRoutineAssignment } from '../lib/profeDb'
import { formatearFecha, fechaToISO, fechaSoloDia, caloriasQuemadasRegistroRutina } from '../utils/calorias'
import { getRangoPorPeriodo } from '../utils/estadisticas'
import { EJERCICIOS_RUTINA, buscarEjercicios } from '../utils/rutinaEjercicios'
import { descargarRutinaPdf } from '../utils/rutinaPdf'
import {
  nombreDeEjercicioDiaItem,
  itemEjercicioDiaNormalizado,
  etiquetaPlanEjercicio,
  nombresEjerciciosDia,
} from '../utils/rutinaEjercicioDia'

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
    ejercicios: (d.ejercicios || [])
      .map((e) => {
        const it = itemEjercicioDiaNormalizado(e)
        if (!it) return null
        if (!it.series.trim() && !it.repeticiones.trim()) return it.nombre
        const o = { nombre: it.nombre }
        if (it.series.trim()) o.series = it.series.trim()
        if (it.repeticiones.trim()) o.repeticiones = it.repeticiones.trim()
        return o
      })
      .filter(Boolean),
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
  /** Índice del ejercicio en edición dentro del día (Configurar). */
  const [ejercicioEditandoIdx, setEjercicioEditandoIdx] = useState(null)
  const [draftEjercicio, setDraftEjercicio] = useState({ nombre: '', series: '', repeticiones: '' })
  const [dragEjercicio, setDragEjercicio] = useState(null) // { fromIdx, overIdx } | null
  const dragEjercicioRef = useRef(null)
  const planListRef = useRef(null)
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [fechaCalendarioSeleccionada, setFechaCalendarioSeleccionada] = useState(null)
  const [periodProgreso, setPeriodProgreso] = useState('mes')
  const [desdeProgresoCustom, setDesdeProgresoCustom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return fechaToISO(d)
  })
  const [hastaProgresoCustom, setHastaProgresoCustom] = useState(() => fechaToISO(new Date()))
  /** Edición de un registro de pesos: { id, ejercicio, series, repeticiones, pesoKg, notas } */
  const [editandoRegistro, setEditandoRegistro] = useState(null)
  /** Historial en Registrar: cerrado por defecto; fecha a consultar (hoy). */
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [fechaHistorial, setFechaHistorial] = useState(() => fechaToISO(new Date()))

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
  const ejerciciosParaCargar = useMemo(
    () =>
      (diaParaRegistrar?.ejercicios || [])
        .map(itemEjercicioDiaNormalizado)
        .filter(Boolean),
    [diaParaRegistrar?.id, diaParaRegistrar?.ejercicios]
  )

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
    setEjercicioEditandoIdx(null)
    setDraftEjercicio({ nombre: '', series: '', repeticiones: '' })
    setDragEjercicio(null)
    dragEjercicioRef.current = null
  }, [diaEditando, vista])

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

  useEffect(() => {
    if (!syncRutinasNube || !user?.id) return
    const onVis = () => {
      if (document.visibilityState === 'visible') setAssignmentsRefreshTick((n) => n + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [syncRutinasNube, user?.id])

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
    if (!window.confirm('¿Quitar este día y sus ejercicios del plan?')) return
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.filter((d) => d.id !== idDia),
    }))
    if (diaEditando === idDia) setDiaEditando(dias.find((d) => d.id !== idDia)?.id || '')
    if (diaSeleccionado === idDia) setDiaSeleccionado(dias.find((d) => d.id !== idDia)?.id || '')
  }

  const renombrarDia = (idDia, nombre) => {
    const n = String(nombre || '').trim()
    if (!n) return
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) => (d.id === idDia ? { ...d, nombre: n } : d)),
    }))
  }

  const moverDia = (idDia, direccion) => {
    actualizarRutina((r) => {
      const list = [...(r.dias || [])]
      const idx = list.findIndex((d) => d.id === idDia)
      if (idx < 0) return r
      const dest = idx + direccion
      if (dest < 0 || dest >= list.length) return r
      ;[list[idx], list[dest]] = [list[dest], list[idx]]
      return { ...r, dias: list }
    })
  }

  const añadirEjercicioAlDia = (nombre, series = '', repeticiones = '') => {
    const n = String(nombre || '').trim()
    if (!n) return
    const ya = nombresEjerciciosDia({ ejercicios: diaActual?.ejercicios })
    if (ya.includes(n)) return
    const s = String(series || '').trim()
    const rps = String(repeticiones || '').trim()
    const item = s || rps ? { nombre: n, ...(s ? { series: s } : {}), ...(rps ? { repeticiones: rps } : {}) } : n
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) =>
        d.id === diaEditando
          ? { ...d, ejercicios: [...(d.ejercicios || []), item] }
          : d
      ),
    }))
    setBusqueda('')
  }

  const quitarEjercicioDelDiaPorIdx = (idx) => {
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) => {
        if (d.id !== diaEditando) return d
        const ejercicios = [...(d.ejercicios || [])]
        ejercicios.splice(idx, 1)
        return { ...d, ejercicios }
      }),
    }))
    if (ejercicioEditandoIdx === idx) {
      setEjercicioEditandoIdx(null)
      setDraftEjercicio({ nombre: '', series: '', repeticiones: '' })
    } else if (ejercicioEditandoIdx != null && ejercicioEditandoIdx > idx) {
      setEjercicioEditandoIdx(ejercicioEditandoIdx - 1)
    }
  }

  const reordenarEjercicioDelDia = (fromIdx, toIdx) => {
    if (fromIdx == null || toIdx == null || fromIdx === toIdx) return
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) => {
        if (d.id !== diaEditando) return d
        const ejercicios = [...(d.ejercicios || [])]
        if (fromIdx < 0 || fromIdx >= ejercicios.length || toIdx < 0 || toIdx >= ejercicios.length) return d
        const [item] = ejercicios.splice(fromIdx, 1)
        ejercicios.splice(toIdx, 0, item)
        return { ...d, ejercicios }
      }),
    }))
    setEjercicioEditandoIdx((prev) => {
      if (prev == null) return prev
      if (prev === fromIdx) return toIdx
      if (fromIdx < prev && toIdx >= prev) return prev - 1
      if (fromIdx > prev && toIdx <= prev) return prev + 1
      return prev
    })
  }

  const idxDesdePuntero = (clientY) => {
    const list = planListRef.current
    if (!list) return null
    const rows = [...list.querySelectorAll('[data-plan-idx]')]
    if (rows.length === 0) return null
    for (const row of rows) {
      const rect = row.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      if (clientY < mid) return Number(row.dataset.planIdx)
    }
    return Number(rows[rows.length - 1].dataset.planIdx)
  }

  const onPlanPointerDown = (e, idx) => {
    if (ejercicioEditandoIdx != null) return
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    const state = { fromIdx: idx, overIdx: idx, pointerId: e.pointerId }
    dragEjercicioRef.current = state
    setDragEjercicio({ fromIdx: idx, overIdx: idx })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPlanPointerMove = (e) => {
    const state = dragEjercicioRef.current
    if (!state) return
    const overIdx = idxDesdePuntero(e.clientY)
    if (overIdx == null || overIdx === state.overIdx) return
    state.overIdx = overIdx
    setDragEjercicio({ fromIdx: state.fromIdx, overIdx })
  }

  const onPlanPointerUp = () => {
    const state = dragEjercicioRef.current
    if (!state) return
    reordenarEjercicioDelDia(state.fromIdx, state.overIdx)
    dragEjercicioRef.current = null
    setDragEjercicio(null)
  }

  const iniciarEdicionEjercicio = (idx) => {
    const it = itemEjercicioDiaNormalizado(ejerciciosDelDia[idx])
    if (!it) return
    setEjercicioEditandoIdx(idx)
    setDraftEjercicio({ nombre: it.nombre, series: it.series, repeticiones: it.repeticiones })
  }

  const cancelarEdicionEjercicio = () => {
    setEjercicioEditandoIdx(null)
    setDraftEjercicio({ nombre: '', series: '', repeticiones: '' })
  }

  const guardarEdicionEjercicio = () => {
    if (ejercicioEditandoIdx == null) return
    const nombre = String(draftEjercicio.nombre || '').trim()
    if (!nombre) return
    const series = String(draftEjercicio.series || '').trim()
    const repeticiones = String(draftEjercicio.repeticiones || '').trim()
    const item = series || repeticiones
      ? { nombre, ...(series ? { series } : {}), ...(repeticiones ? { repeticiones } : {}) }
      : nombre
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) => {
        if (d.id !== diaEditando) return d
        const ejercicios = [...(d.ejercicios || [])]
        ejercicios[ejercicioEditandoIdx] = item
        return { ...d, ejercicios }
      }),
    }))
    cancelarEdicionEjercicio()
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

  const periodoProgresoMap = periodProgreso === 'personalizado' ? 'personalizado' : periodProgreso === 'semana' ? 'semana' : 'mes'
  const { desde: desdeProgreso, hasta: hastaProgreso } = getRangoPorPeriodo(
    periodoProgresoMap,
    desdeProgresoCustom,
    hastaProgresoCustom
  )
  const registrosEnPeriodo = registrosRutina.filter((r) => {
    const f = fechaSoloDia(r.fecha)
    return f >= desdeProgreso && f <= hastaProgreso
  })
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
      <div className="container app-page-container">
        <header className="app-page-hero mb-4 rutina-page-hero">
          <div className="is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap" style={{ gap: '0.75rem' }}>
            <div>
              <div className="app-page-hero-icon" aria-hidden="true">🏋️</div>
              <h1 className="title is-5 mb-2">Rutina de gimnasio</h1>
              <p className="is-size-7 has-text-grey mb-0">
                En <strong>Mis rutinas</strong> creás y registrás entrenos. En <strong>Asignadas</strong> ves lo que te mandó tu entrenador desde Profe (por la nube).
              </p>
            </div>
            <div className="rutina-hero-badges">
              <span className="rutina-hero-badge rutina-hero-badge--blue"><i />{listaRutinas.length} rutinas</span>
              <span className="rutina-hero-badge rutina-hero-badge--green"><i />{registrosRutina.length} registros</span>
              <span className="rutina-hero-badge rutina-hero-badge--muted"><i />{rutinasAsignadas.length} asignadas</span>
            </div>
          </div>
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
        <div className="tabs is-boxed mb-3 rutina-vista-tabs">
          <ul>
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

        <div className="rutina-toolbar mb-4">
              <div className="box py-3 calendario-card rutina-toolbar-active">
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
          </div>
          <div className="box py-3 rutina-toolbar-export">
            <h2 className="title is-6 mb-2">Exportar</h2>
            <p className="is-size-7 has-text-grey mb-3">
              Descargá la rutina activa como PDF para imprimirla o compartirla.
            </p>
            <button
              type="button"
              className="button is-link is-fullwidth"
              onClick={() => {
                try {
                  descargarRutinaPdf(rutinaActiva)
                } catch (e) {
                  window.alert(e?.message || 'No se pudo generar el PDF.')
                }
              }}
            >
              Exportar PDF
            </button>
          </div>
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
                const tieneEntreno = fechasConEntreno.has(celda.fecha)
                const seleccionado = fechaCalendarioSeleccionada === celda.fecha
                return (
                  <button
                    key={celda.fecha}
                    type="button"
                    className={`button is-small has-text-weight-semibold app-calendar-day ${seleccionado ? 'is-link is-selected' : tieneEntreno ? 'has-activity' : 'is-light'}`}
                    onClick={() => setFechaCalendarioSeleccionada(celda.fecha)}
                  >
                    <span>{celda.dia}</span>
                    {tieneEntreno && (
                      <span className="app-calendar-dots" aria-hidden="true">
                        <i className="dot-rut" />
                      </span>
                    )}
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
              <select
                value={periodProgreso}
                onChange={(e) => {
                  const value = e.target.value
                  setPeriodProgreso(value)
                  if (value === 'personalizado' && !desdeProgresoCustom) {
                    const d = new Date((hastaProgresoCustom || hoy) + 'T12:00:00')
                    d.setDate(d.getDate() - 30)
                    setDesdeProgresoCustom(fechaToISO(d))
                  }
                }}
              >
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
          <div className="rutina-config">
            <div className="box mb-4 py-3">
              <div className="is-flex is-justify-content-space-between is-align-items-center is-flex-wrap-wrap mb-3" style={{ gap: '0.5rem' }}>
                <div>
                  <h2 className="title is-6 mb-1">Armá tu plan</h2>
                  <p className="is-size-7 has-text-grey mb-0">Elegí un día, agregá ejercicios, editá series/reps y arrastrá ⠿ para ordenarlos.</p>
                </div>
                <button type="button" className="button is-small is-link is-light" onClick={añadirDia}>
                  + Día
                </button>
              </div>

              <div className="rutina-dias-tabs mb-3" role="tablist" aria-label="Días de la rutina">
                {dias.map((d, di) => {
                  const activo = diaEditando === d.id
                  const cant = (d.ejercicios || []).length
                  return (
                    <div key={d.id} className={`rutina-dia-tab${activo ? ' is-active' : ''}`}>
                      <button
                        type="button"
                        className="rutina-dia-tab-main"
                        role="tab"
                        aria-selected={activo}
                        onClick={() => setDiaEditando(d.id)}
                      >
                        <span className="rutina-dia-tab-nombre">{d.nombre}</span>
                        <span className="rutina-dia-tab-count">{cant}</span>
                      </button>
                      {activo && (
                        <div className="rutina-dia-tab-tools">
                          <button type="button" className="rutina-icon-btn" disabled={di === 0} onClick={() => moverDia(d.id, -1)} aria-label="Mover día arriba" title="Mover día">↑</button>
                          <button type="button" className="rutina-icon-btn" disabled={di === dias.length - 1} onClick={() => moverDia(d.id, 1)} aria-label="Mover día abajo" title="Mover día">↓</button>
                          <button
                            type="button"
                            className="rutina-icon-btn"
                            onClick={() => {
                              const n = window.prompt('Nombre del día', d.nombre)
                              if (n != null) renombrarDia(d.id, n)
                            }}
                            aria-label="Renombrar día"
                            title="Renombrar"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="rutina-icon-btn is-danger"
                            disabled={dias.length <= 1}
                            onClick={() => quitarDia(d.id)}
                            aria-label={`Quitar ${d.nombre}`}
                            title="Quitar día"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="rutina-add-block mb-3">
                <label className="ej-form-label mb-1" htmlFor="rutina-buscar-ex">Agregar ejercicio a {diaActual?.nombre}</label>
                <div className="module-search rutina-buscar">
                  <span className="module-search-icon" aria-hidden>🔍</span>
                  <input
                    id="rutina-buscar-ex"
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar o escribir un nombre…"
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && busqueda.trim()) {
                        e.preventDefault()
                        if (resultadosBusqueda[0]) añadirEjercicioAlDia(resultadosBusqueda[0])
                        else añadirEjercicioAlDia(busqueda.trim())
                      }
                    }}
                  />
                </div>
                {resultadosBusqueda.length > 0 && (
                  <ul className="rutina-sugerencias">
                    {resultadosBusqueda.slice(0, 8).map((ex) => (
                      <li key={ex}>
                        <button type="button" className="rutina-sugerencia-btn" onClick={() => añadirEjercicioAlDia(ex)}>
                          <span>+ {ex}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {busqueda.trim() && resultadosBusqueda.length === 0 && (
                  <button
                    type="button"
                    className="button is-small is-link is-light mt-2"
                    onClick={() => añadirEjercicioAlDia(busqueda.trim())}
                  >
                    + Agregar &quot;{busqueda.trim()}&quot;
                  </button>
                )}
              </div>

              <div className="rutina-plan-list-head">
                <h3 className="title is-6 mb-0">{diaActual?.nombre}</h3>
                <span className="is-size-7 has-text-grey">
                  {ejerciciosDelDia.length === 0
                    ? 'Sin ejercicios'
                    : `${ejerciciosDelDia.length} ejercicio${ejerciciosDelDia.length !== 1 ? 's' : ''} · arrastrá ⠿ para ordenar`}
                </span>
              </div>

              {ejerciciosDelDia.length === 0 ? (
                <div className="rutina-empty-plan">
                  <p className="mb-0">Todavía no hay ejercicios en este día.</p>
                  <p className="is-size-7 has-text-grey mt-1 mb-0">Buscá arriba o escribí un nombre y agregalo.</p>
                </div>
              ) : (
                <ul
                  className={`rutina-plan-list${dragEjercicio ? ' is-dragging' : ''}`}
                  ref={planListRef}
                >
                  {ejerciciosDelDia.map((ex, idx) => {
                    const it = itemEjercicioDiaNormalizado(ex)
                    const editando = ejercicioEditandoIdx === idx
                    const isDragging = dragEjercicio?.fromIdx === idx
                    const isDropTarget = dragEjercicio && dragEjercicio.overIdx === idx && dragEjercicio.fromIdx !== idx
                    return (
                      <li
                        key={`${it?.nombre || 'ex'}-${idx}`}
                        data-plan-idx={idx}
                        className={`rutina-plan-row${editando ? ' is-editing' : ''}${isDragging ? ' is-dragging' : ''}${isDropTarget ? ' is-drop-target' : ''}`}
                      >
                        {editando ? (
                          <div className="rutina-plan-edit">
                            <input
                              className="input is-small"
                              type="text"
                              value={draftEjercicio.nombre}
                              onChange={(e) => setDraftEjercicio((d) => ({ ...d, nombre: e.target.value }))}
                              placeholder="Nombre del ejercicio"
                              autoFocus
                            />
                            <div className="rutina-plan-edit-grid">
                              <div>
                                <label className="ej-form-label mb-1">Series</label>
                                <input
                                  className="input is-small"
                                  type="text"
                                  inputMode="numeric"
                                  value={draftEjercicio.series}
                                  onChange={(e) => setDraftEjercicio((d) => ({ ...d, series: e.target.value }))}
                                  placeholder="3"
                                />
                              </div>
                              <div>
                                <label className="ej-form-label mb-1">Reps</label>
                                <input
                                  className="input is-small"
                                  type="text"
                                  value={draftEjercicio.repeticiones}
                                  onChange={(e) => setDraftEjercicio((d) => ({ ...d, repeticiones: e.target.value }))}
                                  placeholder="10 o 8+8"
                                />
                              </div>
                            </div>
                            <div className="rutina-plan-edit-actions">
                              <button type="button" className="button is-small is-link" onClick={guardarEdicionEjercicio} disabled={!draftEjercicio.nombre.trim()}>
                                Guardar
                              </button>
                              <button type="button" className="button is-small is-light" onClick={cancelarEdicionEjercicio}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="rutina-drag-handle"
                              aria-label={`Arrastrar para reordenar ${it?.nombre || 'ejercicio'}`}
                              title="Arrastrá para mover"
                              onPointerDown={(e) => onPlanPointerDown(e, idx)}
                              onPointerMove={onPlanPointerMove}
                              onPointerUp={onPlanPointerUp}
                              onPointerCancel={onPlanPointerUp}
                            >
                              <span aria-hidden>⠿</span>
                            </button>
                            <div className="rutina-plan-row-body">
                              <span className="rutina-plan-row-num">{idx + 1}</span>
                              <div className="rutina-plan-row-text">
                                <strong className="rutina-plan-ejercicio">{it?.nombre}</strong>
                                {(it?.series || it?.repeticiones) ? (
                                  <span className="rutina-chip rutina-chip-plan">
                                    {it.series && it.repeticiones ? `${it.series}×${it.repeticiones}` : it.series ? `${it.series} series` : `${it.repeticiones} reps`}
                                  </span>
                                ) : (
                                  <span className="is-size-7 has-text-grey">Sin series/reps sugeridas</span>
                                )}
                              </div>
                            </div>
                            <div className="rutina-plan-row-actions">
                              <button type="button" className="rutina-icon-btn" onClick={() => iniciarEdicionEjercicio(idx)} aria-label="Editar" title="Editar">✎</button>
                              <button type="button" className="rutina-icon-btn is-danger" onClick={() => quitarEjercicioDelDiaPorIdx(idx)} aria-label="Quitar" title="Quitar">×</button>
                            </div>
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {vista === 'registrar' && (
          <>
            <div className="box mb-4 py-3">
              <h2 className="title is-6 mb-1">Registrar sesión</h2>
              <p className="is-size-7 has-text-grey mb-3">Elegí fecha y día del plan, marcá lo que hiciste y guardá.</p>
              <div className="rutina-reg-meta">
                <div>
                  <label className="ej-form-label mb-1" htmlFor="rutina-fecha-sesion">Fecha</label>
                  <input
                    id="rutina-fecha-sesion"
                    className="input"
                    type="date"
                    value={fechaInput}
                    onChange={(e) => setFechaInput(e.target.value)}
                  />
                </div>
                <div>
                  <span className="ej-form-label mb-1">Día del plan</span>
                  <div className="rutina-dias-pills" role="group" aria-label="Día de la rutina">
                    {dias.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`rutina-dia-pill${diaSeleccionado === d.id ? ' is-active' : ''}`}
                        onClick={() => setDiaSeleccionado(d.id)}
                      >
                        {d.nombre}
                        <span className="rutina-dia-pill-count">{(d.ejercicios || []).length}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {ejerciciosParaCargar.length === 0 ? (
              <div className="box has-text-grey">
                <p className="mb-2">No hay ejercicios en <strong>{diaParaRegistrar?.nombre}</strong>.</p>
                <button type="button" className="button is-small is-link" onClick={() => setVista('configurar')}>
                  Ir a Configurar
                </button>
              </div>
            ) : (
              <div className="box mb-4">
                <div className="mb-3">
                  <h3 className="title is-6 mb-0">Plan de {diaParaRegistrar?.nombre}</h3>
                  <p className="is-size-7 has-text-grey mb-0">
                    Solo ves los pendientes. Al guardar, salen del listado. Podés agregar otra tanda desde “Ya hechos”.
                  </p>
                </div>
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

            <div className="box mb-4 py-3 rutina-hist-box">
              <button
                type="button"
                className="rutina-hist-toggle"
                onClick={() => setHistorialAbierto((v) => !v)}
                aria-expanded={historialAbierto}
              >
                <div>
                  <h2 className="title is-6 mb-0">Historial</h2>
                  <p className="is-size-7 has-text-grey mb-0">
                    {historialAbierto
                      ? 'Elegí una fecha para ver o editar registros'
                      : 'Tocá para consultar registros por fecha'}
                  </p>
                </div>
                <span className="rutina-hist-chevron" aria-hidden>{historialAbierto ? '▼' : '▶'}</span>
              </button>

              {historialAbierto && (
                <div className="rutina-hist-panel mt-3">
                  <HistorialFechaPicker
                    value={fechaHistorial}
                    onChange={setFechaHistorial}
                    hoy={hoy}
                    fechasConDatos={fechasConEntreno}
                  />
                  {(() => {
                    const lista = porFecha[fechaHistorial] || []
                    if (lista.length === 0) {
                      return (
                        <p className="is-size-7 has-text-grey mb-0 mt-3">
                          No hay registros el {formatearFecha(fechaHistorial)}.
                        </p>
                      )
                    }
                    return (
                      <ul className="rutina-sesion-regs mt-3">
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
                            variant="compacto"
                          />
                        ))}
                      </ul>
                    )
                  })()}
                </div>
              )}
            </div>
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

function HistorialFechaPicker({ value, onChange, hoy, fechasConDatos }) {
  const base = value || hoy
  const [vistaMes, setVistaMes] = useState(() => base.slice(0, 7))

  useEffect(() => {
    if (value && value.slice(0, 7) !== vistaMes) setVistaMes(value.slice(0, 7))
  }, [value])

  const moverDia = (delta) => {
    const d = new Date(`${(value || hoy)}T12:00:00`)
    d.setDate(d.getDate() + delta)
    const iso = fechaToISO(d)
    onChange(iso)
    setVistaMes(iso.slice(0, 7))
  }

  const celdas = useMemo(() => {
    const [y, m] = vistaMes.split('-').map(Number)
    const primerDia = new Date(y, m - 1, 1)
    const ultimoDia = new Date(y, m, 0)
    const diasEnMes = ultimoDia.getDate()
    const inicioSemana = primerDia.getDay()
    const vacios = inicioSemana === 0 ? 6 : inicioSemana - 1
    const total = Math.ceil((vacios + diasEnMes) / 7) * 7
    const out = []
    for (let i = 0; i < vacios; i++) out.push({ vacio: true })
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      out.push({ fecha, dia: d, vacio: false })
    }
    while (out.length < total) out.push({ vacio: true })
    return out
  }, [vistaMes])

  const labelMes = (() => {
    const [y, m] = vistaMes.split('-').map(Number)
    return new Date(y, m - 1, 1)
      .toLocaleDateString('es', { month: 'long', year: 'numeric' })
      .replace(/^\w/, (c) => c.toUpperCase())
  })()

  const cambiarMes = (delta) => {
    const [y, m] = vistaMes.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setVistaMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="rutina-hist-picker">
      <div className="rutina-hist-picker-nav">
        <button type="button" className="rutina-icon-btn" onClick={() => moverDia(-1)} aria-label="Día anterior">‹</button>
        <div className="rutina-hist-picker-fecha">
          <span className="rutina-hist-picker-label">{formatearFecha(value || hoy)}</span>
          {(value || hoy) === hoy && <span className="rutina-hist-picker-hoy-tag">Hoy</span>}
        </div>
        <button type="button" className="rutina-icon-btn" onClick={() => moverDia(1)} aria-label="Día siguiente">›</button>
        {(value || hoy) !== hoy && (
          <button type="button" className="button is-small is-link is-light" onClick={() => { onChange(hoy); setVistaMes(hoy.slice(0, 7)) }}>
            Hoy
          </button>
        )}
      </div>

      <div className="rutina-hist-cal">
        <div className="rutina-hist-cal-head">
          <button type="button" className="rutina-icon-btn" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">‹</button>
          <span className="rutina-hist-cal-mes">{labelMes}</span>
          <button type="button" className="rutina-icon-btn" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">›</button>
        </div>
        <div className="rutina-hist-cal-weekdays">
          {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="rutina-hist-cal-grid">
          {celdas.map((c, i) => {
            if (c.vacio) return <span key={`v-${i}`} className="rutina-hist-cal-empty" />
            const selected = c.fecha === (value || hoy)
            const esHoy = c.fecha === hoy
            const conDatos = fechasConDatos?.has?.(c.fecha)
            return (
              <button
                key={c.fecha}
                type="button"
                className={`rutina-hist-cal-day${selected ? ' is-selected' : ''}${esHoy ? ' is-today' : ''}${conDatos ? ' has-data' : ''}`}
                onClick={() => onChange(c.fecha)}
              >
                {c.dia}
              </button>
            )
          })}
        </div>
      </div>
    </div>
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
                        {(d.ejercicios || []).map((ex, ei) => (
                          <li key={`${nombreDeEjercicioDiaItem(ex)}-${ei}`} className="is-size-7">
                            {etiquetaPlanEjercicio(ex)}
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
    <div className="rutina-hist-row-actions">
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
        <li className="rutina-hist-row">
          <div className="rutina-hist-row-main">
            <strong className="rutina-registro-nombre">{registro.ejercicio}</strong>
            <div className="rutina-hist-row-meta">
              <span className="rutina-chip rutina-chip-plan">{registro.series}×{registro.repeticiones}</span>
              {registro.pesoKg != null && registro.pesoKg > 0 && <span className="rutina-chip rutina-chip-peso">{registro.pesoKg} kg</span>}
              <span className="rutina-chip rutina-chip-kcal">~{caloriasQuemadasRegistroRutina(registro, pesoCfg)} kcal</span>
              {registro.kcalManual != null && Number(registro.kcalManual) > 0 && (
                <span className="has-text-grey is-size-7"> (manual)</span>
              )}
            </div>
            {registro.notas && <p className="is-size-7 rutina-registro-notas mt-1 mb-0">— {registro.notas}</p>}
          </div>
          {botonesAccion}
        </li>
      )
    }
    return (
      <li className="box py-2 px-3 mb-2">
        <div className="is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
          <div>
            <strong className="rutina-registro-nombre">{registro.ejercicio}</strong>
            <p className="is-size-7 mt-1 mb-0">
              <span className="rutina-chip rutina-chip-plan">{registro.series}×{registro.repeticiones}</span>
              {registro.pesoKg != null && registro.pesoKg > 0 && <span className="rutina-chip rutina-chip-peso ml-1">{registro.pesoKg} kg</span>}
              <span className="rutina-chip rutina-chip-kcal ml-1">~{caloriasQuemadasRegistroRutina(registro, pesoCfg)} kcal</span>
              {registro.kcalManual != null && Number(registro.kcalManual) > 0 && (
                <span className="has-text-grey"> (manual)</span>
              )}
            </p>
            {registro.notas && <p className="is-size-7 rutina-registro-notas mt-1 mb-0">— {registro.notas}</p>}
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

function filasIniciales(planItems) {
  return Object.fromEntries(
    planItems.map((it) => {
      const seriesIni = it.series?.trim() ? it.series.trim() : '3'
      const repsIni = it.repeticiones?.trim() || ''
      return [
        it.nombre,
        { incluir: false, series: seriesIni, repeticiones: repsIni, pesoKg: '', kcalManual: '', notas: '' },
      ]
    })
  )
}

function serializarPlanItems(planItems) {
  return JSON.stringify(planItems.map((it) => ({ n: it.nombre, s: it.series, r: it.repeticiones })))
}

function RegistrarPlanDelDia({ ejercicios, registrosDeEstaSesion, pesoCfg, onGuardarMarcados, onEliminarRegistro }) {
  const [filas, setFilas] = useState(() => filasIniciales(ejercicios))
  const [errorLote, setErrorLote] = useState(null)
  const [hechosAbiertos, setHechosAbiertos] = useState(true)

  useEffect(() => {
    setFilas((prev) => {
      const base = filasIniciales(ejercicios)
      // Conservar borradores abiertos si el ejercicio sigue en el plan
      for (const it of ejercicios) {
        if (prev[it.nombre]?.incluir) base[it.nombre] = { ...base[it.nombre], ...prev[it.nombre] }
      }
      return base
    })
    setErrorLote(null)
  }, [serializarPlanItems(ejercicios)])

  const setFila = (nombre, patch) => {
    setFilas((prev) => ({ ...prev, [nombre]: { ...(prev[nombre] || filasIniciales([ejercicios.find((e) => e.nombre === nombre) || { nombre }])[nombre]), ...patch } }))
  }

  const regsPorEjercicio = ejercicios.reduce((acc, it) => {
    acc[it.nombre] = registrosDeEstaSesion.filter((r) => r.ejercicio === it.nombre)
    return acc
  }, {})

  const pendientes = ejercicios.filter((it) => (regsPorEjercicio[it.nombre] || []).length === 0)
  const hechos = ejercicios.filter((it) => (regsPorEjercicio[it.nombre] || []).length > 0)
  const hechosConOtraTanda = hechos.filter((it) => filas[it.nombre]?.incluir)

  const listaParaGuardar = [...pendientes, ...hechosConOtraTanda]

  const pendientesGuardar = listaParaGuardar.filter((it) => {
    const f = filas[it.nombre]
    if (!f?.incluir) return false
    const reps = (f.repeticiones || '').trim()
    return f.series !== '' && f.series != null && reps
  })

  const abrirOtraTanda = (it) => {
    const seriesIni = it.series?.trim() ? it.series.trim() : '3'
    const repsIni = it.repeticiones?.trim() || ''
    setFila(it.nombre, {
      incluir: true,
      series: seriesIni,
      repeticiones: repsIni,
      pesoKg: '',
      kcalManual: '',
      notas: '',
    })
    setHechosAbiertos(true)
  }

  const guardarLote = () => {
    setErrorLote(null)
    const marcadosSinReps = listaParaGuardar.filter((it) => {
      const f = filas[it.nombre]
      return f?.incluir && (!(f.repeticiones || '').trim() || f.series === '' || f.series == null)
    })
    if (marcadosSinReps.length > 0) {
      setErrorLote('En los marcados, completá series y reps (reps puede ser texto, ej. 10 o 8+8).')
      return
    }
    const payload = pendientesGuardar.map((it) => {
      const f = filas[it.nombre]
      return {
        ejercicio: it.nombre,
        series: f.series,
        repeticiones: f.repeticiones,
        pesoKg: f.pesoKg,
        kcalManual: f.kcalManual,
        notas: f.notas,
      }
    })
    if (payload.length === 0) {
      setErrorLote('Marcá al menos un ejercicio y completá series y reps.')
      return
    }
    onGuardarMarcados(payload)
    setFilas((prev) => {
      const next = { ...prev }
      for (const it of pendientesGuardar) {
        const seriesReset = it.series?.trim() ? it.series.trim() : '3'
        const repsReset = it.repeticiones?.trim() || ''
        next[it.nombre] = {
          incluir: false,
          series: seriesReset,
          repeticiones: repsReset,
          pesoKg: '',
          kcalManual: '',
          notas: '',
        }
      }
      return next
    })
  }

  const renderForm = (ex, f) => (
    <div className="rutina-reg-form">
      <div className="rutina-reg-fields">
        <div>
          <label className="ej-form-label mb-1">Series</label>
          <input
            className="input is-small"
            type="number"
            min="1"
            max="99"
            value={f.series}
            onChange={(e) => setFila(ex, { series: e.target.value })}
          />
        </div>
        <div className="rutina-reg-field-grow">
          <label className="ej-form-label mb-1">Reps</label>
          <input
            className="input is-small"
            type="text"
            value={f.repeticiones}
            onChange={(e) => setFila(ex, { repeticiones: e.target.value })}
            placeholder="10, 8+8, max…"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="ej-form-label mb-1">Peso</label>
          <input
            className="input is-small"
            type="number"
            min="0"
            step="0.5"
            value={f.pesoKg}
            onChange={(e) => setFila(ex, { pesoKg: e.target.value })}
            placeholder="kg"
          />
        </div>
        <div>
          <label className="ej-form-label mb-1">Kcal</label>
          <input
            className="input is-small"
            type="number"
            min="1"
            step="1"
            value={f.kcalManual}
            onChange={(e) => setFila(ex, { kcalManual: e.target.value })}
            placeholder="Auto"
            title="Opcional: si lo cargás, reemplaza la estimación"
          />
        </div>
      </div>
      <input
        className="input is-small mt-2"
        type="text"
        value={f.notas}
        onChange={(e) => setFila(ex, { notas: e.target.value })}
        placeholder="Notas (opcional)"
      />
    </div>
  )

  return (
    <div className="rutina-reg-plan">
      {errorLote && (
        <div className="notification is-warning is-light is-size-7 py-2 px-3 mb-3">{errorLote}</div>
      )}

      <div className="rutina-reg-progress mb-3">
        <span>
          {hechos.length}/{ejercicios.length} hechos
        </span>
        {pendientes.length > 0 ? (
          <span className="has-text-grey">{pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}</span>
        ) : (
          <span className="rutina-reg-progress-ok">Plan del día completo</span>
        )}
      </div>

      {pendientes.length > 0 ? (
        <>
          <p className="ej-form-label mb-2">Pendientes</p>
          <ul className="rutina-reg-list">
            {pendientes.map((it) => {
              const ex = it.nombre
              const f = filas[ex] || {
                incluir: false,
                series: '3',
                repeticiones: '',
                pesoKg: '',
                kcalManual: '',
                notas: '',
              }
              const sugSer = it.series?.trim()
              const sugRep = it.repeticiones?.trim()
              return (
                <li key={ex} className={`rutina-reg-card${f.incluir ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="rutina-reg-card-head"
                    onClick={() => setFila(ex, { incluir: !f.incluir })}
                    aria-expanded={f.incluir}
                  >
                    <span className={`rutina-reg-check${f.incluir ? ' is-on' : ''}`} aria-hidden>
                      {f.incluir ? '✓' : ''}
                    </span>
                    <span className="rutina-reg-card-title">
                      <strong className="rutina-registro-nombre">{ex}</strong>
                      {(sugSer || sugRep) && (
                        <span className="rutina-chip rutina-chip-plan">
                          {sugSer && sugRep ? `${sugSer}×${sugRep}` : sugSer ? `${sugSer} series` : `${sugRep} reps`}
                        </span>
                      )}
                    </span>
                  </button>
                  {f.incluir && renderForm(ex, f)}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <div className="rutina-reg-all-done mb-3">
          <p className="mb-1"><strong>Ya registraste todos los ejercicios del plan.</strong></p>
          <p className="is-size-7 has-text-grey mb-0">Si querés otra tanda de alguno, abrí “Ya hechos” y tocá “+ Otra tanda”.</p>
        </div>
      )}

      {hechos.length > 0 && (
        <div className="rutina-reg-hechos mt-3">
          <button
            type="button"
            className="rutina-reg-hechos-toggle"
            onClick={() => setHechosAbiertos((v) => !v)}
            aria-expanded={hechosAbiertos}
          >
            <span>Ya hechos ({hechos.length})</span>
            <span aria-hidden>{hechosAbiertos ? '▼' : '▶'}</span>
          </button>
          {hechosAbiertos && (
            <ul className="rutina-reg-list rutina-reg-list--hechos">
              {hechos.map((it) => {
                const ex = it.nombre
                const ya = regsPorEjercicio[ex] || []
                const f = filas[ex] || {
                  incluir: false,
                  series: '3',
                  repeticiones: '',
                  pesoKg: '',
                  kcalManual: '',
                  notas: '',
                }
                return (
                  <li key={ex} className={`rutina-reg-card has-done${f.incluir ? ' is-open' : ''}`}>
                    <div className="rutina-reg-hecho-head">
                      <div className="rutina-reg-card-title">
                        <strong className="rutina-registro-nombre">{ex}</strong>
                        <span className="rutina-reg-done-badge">{ya.length} guardado{ya.length !== 1 ? 's' : ''}</span>
                      </div>
                      {!f.incluir ? (
                        <button type="button" className="button is-small is-link is-light" onClick={() => abrirOtraTanda(it)}>
                          + Otra tanda
                        </button>
                      ) : (
                        <button type="button" className="button is-small is-light" onClick={() => setFila(ex, { incluir: false })}>
                          Cancelar
                        </button>
                      )}
                    </div>
                    <div className="rutina-reg-done-list">
                      {ya.map((r) => (
                        <div key={r.id} className="rutina-reg-done-row">
                          <span>
                            <span className="rutina-chip rutina-chip-plan">{r.series}×{r.repeticiones}</span>
                            {r.pesoKg != null && r.pesoKg > 0 && <span className="rutina-chip rutina-chip-peso ml-1">{r.pesoKg} kg</span>}
                            <span className="rutina-chip rutina-chip-kcal ml-1">~{caloriasQuemadasRegistroRutina(r, pesoCfg)} kcal</span>
                            {r.notas && <span className="rutina-registro-notas"> — {r.notas}</span>}
                          </span>
                          <button type="button" className="rutina-icon-btn is-danger" onClick={() => onEliminarRegistro(r.id)} aria-label="Quitar registro">×</button>
                        </div>
                      ))}
                    </div>
                    {f.incluir && renderForm(ex, f)}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {(pendientes.length > 0 || hechosConOtraTanda.length > 0) && (
        <button
          type="button"
          className="button is-link is-fullwidth mt-3"
          onClick={guardarLote}
          disabled={pendientesGuardar.length === 0}
        >
          Guardar lo marcado{pendientesGuardar.length > 0 ? ` (${pendientesGuardar.length})` : ''}
        </button>
      )}
    </div>
  )
}
