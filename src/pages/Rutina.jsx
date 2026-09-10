import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { listAssignmentsForStudent, assignmentsToRutinasItems, deleteRoutineAssignment } from '../lib/profeDb'
import { formatearFecha, fechaToISO, fechaSoloDia, caloriasQuemadasRegistroRutina } from '../utils/calorias'
import { getRangoPorPeriodo } from '../utils/estadisticas'
import { descargarRutinaPdf } from '../utils/rutinaPdf'
import {
  itemEjercicioDiaNormalizado,
  nombresEjerciciosDia,
  inferirGruposMuscularesDia,
  ejercicioDiaAJson,
  inferirGrupoMuscular,
  parseNumSeriesPlan,
  siguienteLabelSuperserie,
  nombresEjercicioCoinciden,
} from '../utils/rutinaEjercicioDia'
import SesionRegistroTitanium from '../components/SesionRegistroTitanium'
import ArmarPlanTitanium from '../components/ArmarPlanTitanium'
import ProgresoCargasTitanium from '../components/ProgresoCargasTitanium'
import RutinasAsignadasTitanium from '../components/RutinasAsignadasTitanium'
import { AppNotificacionesCampana } from '../context/AppNotificationsContext'
import { nuevoIdRegistro } from '../utils/ids'

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
      .map((e) => ejercicioDiaAJson(e))
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
  const [searchParams] = useSearchParams()
  const syncRutinasNube = Boolean(user && isConfigured)
  const [rutinas, setRutinas] = useStorage('rutinas', [])
  const [rutinasAsignadas, setRutinasAsignadas] = useStorage('rutinasAsignadas', [])
  const [rutinaActivaId, setRutinaActivaId] = useStorage('rutinaActivaId', '')
  const [registros, setRegistros] = useStorage('rutinaPesos', [])
  const [config] = useStorage('config', { pesoKg: 70 })

  const [origenRutinas, setOrigenRutinas] = useState('propias')
  const [assignmentsRefreshTick, setAssignmentsRefreshTick] = useState(0)
  const [vista, setVista] = useState('registrar') // 'registrar' | 'configurar' | 'progreso'
  const [diaEditando, setDiaEditando] = useState('')
  const [fechaInput, setFechaInput] = useState(() => fechaToISO(new Date()))
  const [diaSeleccionado, setDiaSeleccionado] = useState('')
  const [nombreNuevaRutina, setNombreNuevaRutina] = useState('')
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [periodProgreso, setPeriodProgreso] = useState('mes')
  const [desdeProgresoCustom, setDesdeProgresoCustom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return fechaToISO(d)
  })
  const [hastaProgresoCustom, setHastaProgresoCustom] = useState(() => fechaToISO(new Date()))
  /** Historial en Registrar: cerrado por defecto; fecha a consultar (hoy). */
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [fechaHistorial, setFechaHistorial] = useState(() => fechaToISO(new Date()))

  // La solapa Calendario se eliminó; si quedó algún estado viejo, volver a registrar
  useEffect(() => {
    if (vista === 'calendario') setVista('registrar')
  }, [vista])

  useEffect(() => {
    const fechaParam = searchParams.get('fecha')
    if (fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)) {
      setFechaInput(fechaParam)
      setFechaHistorial(fechaParam)
      setMesCalendario(fechaParam.slice(0, 7))
    }
    if (searchParams.get('fecha') || searchParams.get('iniciar') === '1') {
      setVista('registrar')
      setOrigenRutinas('propias')
    }
  }, [searchParams])

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
  const tonoDiaRegistro = useMemo(() => {
    const i = dias.findIndex((d) => d.id === diaSeleccionado)
    return (i >= 0 ? i : 0) % 6
  }, [dias, diaSeleccionado])

  useEffect(() => {
    if (dias.length > 0) {
      const idPrimero = dias[0].id
      if (!dias.some((d) => d.id === diaEditando)) setDiaEditando(idPrimero)
      if (!dias.some((d) => d.id === diaSeleccionado)) setDiaSeleccionado(idPrimero)
    }
  }, [rutinaIdActual])

  useEffect(() => {
    if (origenRutinas === 'asignadas') setVista('registrar')
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

  const copiarAsignadaAMisRutinas = useCallback(
    (r) => {
      const clon = clonarRutinaParaMisRutinas(r)
      setRutinas((list) => [...(list || []), clon])
      setRutinaActivaId(clon.id)
      setOrigenRutinas('propias')
      window.alert(`«${clon.nombre}» quedó en Mis rutinas y está activa. Ahí podés registrar pesos y editarla.`)
    },
    [setRutinas, setRutinaActivaId, setOrigenRutinas],
  )

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

  const duplicarDia = (idDia) => {
    actualizarRutina((r) => {
      const list = [...(r.dias || [])]
      const idx = list.findIndex((d) => d.id === idDia)
      if (idx < 0) return r
      const src = list[idx]
      const copia = {
        id: `d${Date.now()}_copy`,
        nombre: `${src.nombre || `Día ${idx + 1}`} (copia)`,
        ejercicios: JSON.parse(JSON.stringify(src.ejercicios || [])),
      }
      list.splice(idx + 1, 0, copia)
      return { ...r, dias: list }
    })
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

  const añadirEjercicioAlDia = (nombreOrItem, series = '', repeticiones = '') => {
    let n = ''
    let notas = ''
    let grupoMuscular = ''
    if (nombreOrItem != null && typeof nombreOrItem === 'object') {
      n = String(nombreOrItem.nombre || '').trim()
      notas = String(nombreOrItem.notas || '').trim()
      grupoMuscular = String(nombreOrItem.categoria || nombreOrItem.grupoMuscular || '').trim()
    } else {
      n = String(nombreOrItem || '').trim()
    }
    if (!n) return
    const ya = nombresEjerciciosDia({ ejercicios: diaActual?.ejercicios })
    if (ya.some((x) => x.toLowerCase() === n.toLowerCase())) return
    const s = String(series || '').trim()
    const rps = String(repeticiones || '').trim()
    const g = grupoMuscular || inferirGrupoMuscular(n)
    const raw = {
      nombre: n,
      ...(s ? { series: s } : {}),
      ...(rps ? { repeticiones: rps } : {}),
      ...(notas ? { notas } : {}),
      ...(g && g !== 'Otro' ? { grupoMuscular: g } : {}),
    }
    const item =
      Object.keys(raw).length === 1 && raw.nombre
        ? raw.nombre
        : ejercicioDiaAJson(raw) ?? n
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) =>
        d.id === diaEditando ? { ...d, ejercicios: [...(d.ejercicios || []), item] } : d,
      ),
    }))
  }

  const añadirEjerciciosCatalogoAlDia = (pickedItems) => {
    if (!pickedItems?.length || !diaEditando) return
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) => {
        if (d.id !== diaEditando) return d
        const ya = new Set(
          nombresEjerciciosDia(d).map((x) => String(x).trim().toLowerCase()),
        )
        const nuevos = []
        for (const c of pickedItems) {
          const n = String(c?.nombre || '').trim()
          if (!n) continue
          const key = n.toLowerCase()
          if (ya.has(key)) continue
          const g = String(c.categoria || '').trim() || inferirGrupoMuscular(n)
          const raw = {
            nombre: n,
            notas: String(c.notas || '').trim(),
            ...(g && g !== 'Otro' ? { grupoMuscular: g } : {}),
          }
          const item = ejercicioDiaAJson(raw) ?? n
          nuevos.push(item)
          ya.add(key)
        }
        if (!nuevos.length) return d
        return { ...d, ejercicios: [...(d.ejercicios || []), ...nuevos] }
      }),
    }))
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
  }

  const duplicarEjercicioEnDia = (idx) => {
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) => {
        if (d.id !== diaEditando) return d
        const ejercicios = [...(d.ejercicios || [])]
        const it = itemEjercicioDiaNormalizado(ejercicios[idx])
        if (!it) return d
        const copy = ejercicioDiaAJson({ ...it }) ?? it.nombre
        ejercicios.splice(idx + 1, 0, copy)
        return { ...d, ejercicios }
      }),
    }))
  }

  const guardarEjercicioPlan = (idx, draft) => {
    const nombre = String(draft?.nombre || '').trim()
    if (!nombre || idx == null) return
    const raw = {
      nombre,
      series: String(draft.series || '').trim(),
      repeticiones: String(draft.repeticiones || '').trim(),
      superserie: String(draft.superserie || '').trim(),
      descansoPostRonda: String(draft.descansoPostRonda || '').trim(),
      grupoMuscular: String(draft.grupoMuscular || '').trim(),
      carga: String(draft.carga || '').trim(),
      notas: String(draft.notas || '').trim(),
    }
    const item = ejercicioDiaAJson(raw) ?? nombre
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) => {
        if (d.id !== diaEditando) return d
        const ejercicios = [...(d.ejercicios || [])]
        ejercicios[idx] = item
        return { ...d, ejercicios }
      }),
    }))
  }

  const vincularSuperserie = (idx) => {
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) => {
        if (d.id !== diaEditando) return d
        const ejercicios = [...(d.ejercicios || [])]
        if (idx < 0 || idx >= ejercicios.length - 1) return d
        const label = siguienteLabelSuperserie(ejercicios)
        const a = itemEjercicioDiaNormalizado(ejercicios[idx])
        const b = itemEjercicioDiaNormalizado(ejercicios[idx + 1])
        if (!a || !b) return d
        const descanso = a.descansoPostRonda || b.descansoPostRonda || '90'
        ejercicios[idx] = ejercicioDiaAJson({ ...a, superserie: label, descansoPostRonda: descanso })
        ejercicios[idx + 1] = ejercicioDiaAJson({ ...b, superserie: label, descansoPostRonda: descanso })
        return { ...d, ejercicios }
      }),
    }))
  }

  const desvincularSuperserie = (label) => {
    const key = String(label || '').trim()
    if (!key) return
    actualizarRutina((r) => ({
      ...r,
      dias: r.dias.map((d) => {
        if (d.id !== diaEditando) return d
        const ejercicios = (d.ejercicios || []).map((ex) => {
          const it = itemEjercicioDiaNormalizado(ex)
          if (!it || it.superserie !== key) return ex
          return ejercicioDiaAJson({ ...it, superserie: '', descansoPostRonda: '' }) ?? it.nombre
        })
        return { ...d, ejercicios }
      }),
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
    const nuevos = validos.map(({ ejercicio, series, repeticiones, pesoKg, notas, kcalManual, serieNum, rpe }) => {
      const repsStr = typeof repeticiones === 'string' ? repeticiones.trim() : String(repeticiones ?? '').trim()
      const kcalM = kcalManual !== '' && kcalManual != null && Number(kcalManual) > 0 ? Math.round(Number(kcalManual)) : undefined
      const row = {
        id: nuevoIdRegistro(),
        fecha,
        rutinaId: rutinaIdActual,
        diaRutinaId: diaSeleccionado,
        ejercicio,
        series: Number(series) || 1,
        repeticiones: repsStr,
        pesoKg: pesoKg !== '' && pesoKg != null ? Number(pesoKg) : undefined,
        notas: (notas || '').trim(),
      }
      if (serieNum != null && serieNum !== '') row.serieNum = Number(serieNum)
      if (rpe != null && rpe !== '') row.rpe = Number(rpe)
      if (kcalM != null) row.kcalManual = kcalM
      return row
    })
    setRegistros((prev) => [...nuevos, ...prev])
  }

  const guardarSerieSesion = (serie) => {
    agregarRegistrosVarios([serie])
  }

  const guardarSeriesSesion = (lista) => {
    agregarRegistrosVarios(lista)
  }

  const eliminarRegistro = (id) => {
    setRegistros((regs) => regs.filter((r) => r.id !== id))
  }

  /** Borra varios registros en un solo update (evita perder deletes al encadenar). */
  const eliminarRegistrosPorIds = (ids) => {
    const set = new Set((ids || []).filter(Boolean))
    if (set.size === 0) return
    setRegistros((regs) => regs.filter((r) => !set.has(r.id)))
  }

  const seleccionarFechaSesion = (fecha) => {
    if (!fecha) return
    setFechaInput(fecha)
    setFechaHistorial(fecha)
    if (fecha.length >= 7) setMesCalendario(fecha.slice(0, 7))
    const delDia = registros.filter(
      (r) =>
        r.fecha === fecha &&
        (r.rutinaId === rutinaIdActual || !r.rutinaId)
    )
    if (delDia.length === 0) return
    const conteo = {}
    for (const r of delDia) {
      if (!r.diaRutinaId) continue
      conteo[r.diaRutinaId] = (conteo[r.diaRutinaId] || 0) + 1
    }
    const mejor = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (mejor && dias.some((d) => d.id === mejor)) {
      setDiaSeleccionado(mejor)
    }
  }

  const registrosDeEstaSesion = registros.filter((r) => {
    if (r.fecha !== (fechaInput || hoy)) return false
    if (r.rutinaId && r.rutinaId !== rutinaIdActual) return false
    if (r.diaRutinaId && r.diaRutinaId === diaSeleccionado) return true
    // Legacy / sin día, o día distinto pero mismo ejercicio del plan (huérfanos tras renombrar/cambiar día)
    return ejerciciosParaCargar.some((it) => nombresEjercicioCoinciden(it.nombre, r.ejercicio))
  })

  const progresoSesion = (() => {
    let hechos = 0
    let seriesTotales = 0
    let seriesHechas = 0
    const nombresCompletos = new Set()
    for (const it of ejerciciosParaCargar) {
      const ya = registrosDeEstaSesion.filter((r) => nombresEjercicioCoinciden(r.ejercicio, it.nombre))
      const esWarm =
        /calentamiento/i.test(String(it.grupoMuscular || '')) ||
        /bici|el[ií]ptic[oa]|cinta|cardio|calentamiento|spinning|movilidad/i.test(String(it.nombre || ''))
      let nPlan
      if (esWarm) {
        nPlan = 1
      } else if (it.superserie) {
        nPlan = Math.max(
          1,
          Number(it.superserie.vueltas) || parseNumSeriesPlan(it.series) || 4
        )
      } else {
        nPlan = parseNumSeriesPlan(it.series)
      }
      seriesTotales += nPlan
      if (ya.length === 0) continue

      if (it.superserie) {
        // Misma regla que la UI: cada vuelta (serieNum 1..N) debe existir
        const hechasSs = Array.from({ length: nPlan }, (_, i) => i + 1).filter((sn) =>
          ya.some((r) => Number(r.serieNum) === sn)
        ).length
        seriesHechas += hechasSs
        if (hechasSs >= nPlan) {
          hechos += 1
          nombresCompletos.add(it.nombre)
        }
        continue
      }

      // Un solo registro legacy con N series cubre el plan
      const legacy = ya.find((r) => r.serieNum == null && Number(r.series) >= nPlan)
      if (legacy) {
        hechos += 1
        seriesHechas += nPlan
        nombresCompletos.add(it.nombre)
        continue
      }

      // Contar solo series numeradas 1..N (ignora registros huérfanos sin serieNum)
      const conSerie = ya.filter((r) => r.serieNum != null)
      let hechasEx = 0
      if (conSerie.length > 0) {
        hechasEx = Array.from({ length: nPlan }, (_, i) => i + 1).filter((sn) =>
          conSerie.some((r) => Number(r.serieNum) === sn)
        ).length
      } else if (esWarm) {
        hechasEx = ya.length > 0 ? 1 : 0
      }
      seriesHechas += hechasEx
      if (hechasEx >= nPlan) {
        hechos += 1
        nombresCompletos.add(it.nombre)
      }
    }
    const total = ejerciciosParaCargar.length
    // La barra sigue el conteo de ejercicios (misma cifra que el texto "X de Y")
    const pct = total > 0 ? Math.round((hechos / total) * 100) : 0
    const kcal = registrosDeEstaSesion.reduce((s, r) => {
      const ok = [...nombresCompletos].some((n) => nombresEjercicioCoinciden(n, r.ejercicio))
      if (!ok) return s
      return s + caloriasQuemadasRegistroRutina(r, pesoCfg)
    }, 0)
    return { hechos, total, pct, kcal, seriesHechas, seriesTotales }
  })()

  const registrosRutina = registros.filter((r) => !r.rutinaId || r.rutinaId === rutinaIdActual)
  const porFecha = registrosRutina.reduce((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = []
    acc[r.fecha].push(r)
    return acc
  }, {})
  const fechasConEntreno = new Set(registrosRutina.map((r) => r.fecha))

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

  const volumenKgPeriodo = registrosEnPeriodo.reduce((sum, r) => {
    const peso = r.pesoKg != null ? Number(r.pesoKg) : 0
    if (!(peso > 0)) return sum
    const series = Number(r.series) || 1
    const reps = parseFloat(String(r.repeticiones || '').replace(',', '.')) || 0
    return sum + peso * series * (reps > 0 ? reps : 1)
  }, 0)
  const volumenTon = volumenKgPeriodo / 1000

  const fechaSesionHist = fechaInput || hoy
  const historialPorEjercicio = {}
  for (const r of registrosRutina) {
    if (r.fecha >= fechaSesionHist) continue
    const name = r.ejercicio || 'Sin nombre'
    if (!historialPorEjercicio[name]) historialPorEjercicio[name] = []
    historialPorEjercicio[name].push(r)
  }
  for (const name of Object.keys(historialPorEjercicio)) {
    historialPorEjercicio[name].sort((a, b) => b.fecha.localeCompare(a.fecha))
  }

  let progresionEjercicioActivo = null
  {
    const fechaSesion = fechaInput || hoy
    const regsHoy = (registrosRutina || []).filter((r) => {
      const f = fechaSoloDia(r.fecha)
      return f === fechaSesion && r.pesoKg != null && Number(r.pesoKg) > 0
    })
    if (regsHoy.length) {
      const porEj = {}
      for (const r of regsHoy) {
        const name = r.ejercicio || 'Sin nombre'
        if (!porEj[name]) porEj[name] = []
        porEj[name].push(Number(r.pesoKg))
      }
      const candidatos = Object.entries(porEj).map(([ejercicio, pesos]) => {
        const hoyPeso = Math.max(...pesos)
        const hist = [...(progresoPorEjercicio[ejercicio] || [])]
          .filter((x) => fechaSoloDia(x.fecha) < fechaSesion && x.pesoKg != null && Number(x.pesoKg) > 0)
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
        const inicio = hist.length
          ? Number(hist[0].pesoKg)
          : hoyPeso
        const pct = inicio > 0 ? Math.round(((hoyPeso - inicio) / inicio) * 100) : 0
        return { ejercicio, inicio, hoyPeso, pct, conHistorial: hist.length > 0 }
      })
      // Preferir el que más cambió hoy vs historial; si empatan, el de mayor carga
      candidatos.sort((a, b) => {
        if (b.pct !== a.pct) return Math.abs(b.pct) - Math.abs(a.pct)
        return b.hoyPeso - a.hoyPeso
      })
      progresionEjercicioActivo = candidatos[0] || null
    }
  }

  return (
    <section className="section py-2 rutina-titanium rutina-layout">
      <div className="rutina-chrome">
        <div className="container app-page-container rutina-container">
        <header className="rut-head">
          <div className="rut-head-top">
            <div className="rut-head-titles">
              <h1 className="rut-head-title">Gestión de Rutinas y Entrenamiento</h1>
              <p className="rut-head-sub">
                Control de cargas, progresión de 1RM estimada, tonelaje acumulado y métricas de rendimiento en tiempo real.
              </p>
            </div>

            <div className="rut-head-actions">
              <span className="rut-modo">Modo Atleta</span>

              <div className="rut-activa">
                <span className="rut-activa-label" id="rutina-activa-label">Rutina activa:</span>
                <div className="rut-activa-select">
                  <select
                    id="rutina-activa-select"
                    aria-labelledby="rutina-activa-label"
                    value={rutinaActivaId || rutinaIdActual}
                    onChange={(e) => setRutinaActivaId(e.target.value)}
                    disabled={origenRutinas !== 'propias'}
                  >
                    {listaRutinas.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="rut-ico-btn"
                disabled={origenRutinas !== 'propias' || listaRutinas.length <= 1}
                onClick={() => window.confirm('¿Eliminar esta rutina?') && eliminarRutina(rutinaIdActual)}
                title="Eliminar rutina"
                aria-label="Eliminar rutina"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 7h16" /><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" /><path d="M18 7l-.8 12.2A2 2 0 0115.2 21H8.8a2 2 0 01-2-1.8L6 7" /><path d="M10 11v6M14 11v6" />
                </svg>
              </button>

              <button
                type="button"
                className="rut-btn-dark"
                disabled={origenRutinas !== 'propias'}
                onClick={() => {
                  const nombre = window.prompt('Nombre de la nueva rutina', nombreNuevaRutina || 'Nueva rutina')
                  if (nombre == null) return
                  const nueva = { ...rutinaVacia(), id: `r${Date.now()}`, nombre: nombre.trim() || 'Nueva rutina' }
                  setRutinas((list) => [...(list || []), nueva])
                  setRutinaActivaId(nueva.id)
                  setNombreNuevaRutina('')
                  setOrigenRutinas('propias')
                  setVista('configurar')
                }}
              >
                + Nueva rutina
              </button>

              <button
                type="button"
                className="rut-btn-pdf"
                disabled={origenRutinas !== 'propias'}
                onClick={() => {
                  try {
                    descargarRutinaPdf(rutinaActiva)
                  } catch (e) {
                    window.alert(e?.message || 'No se pudo generar el PDF.')
                  }
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
                </svg>
                <span className="rut-btn-label rut-btn-label--long">Exportar PDF</span>
                <span className="rut-btn-label rut-btn-label--short">PDF</span>
              </button>

              <div className="rut-campana">
                <AppNotificacionesCampana />
              </div>
            </div>
          </div>

          <div className="rut-head-tabs">
            <nav className="rut-tabs" aria-label="Vistas de rutina">
              <button
                type="button"
                className={`rut-tab${vista === 'registrar' && origenRutinas === 'propias' ? ' is-active' : ''}`}
                onClick={() => { setOrigenRutinas('propias'); setVista('registrar') }}
              >
                <span className="rut-tab-check" aria-hidden>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="rut-tab-label rut-tab-label--long">Registrar Sesión (Hoy)</span>
                <span className="rut-tab-label rut-tab-label--short">Registrar (Hoy)</span>
              </button>
              <button
                type="button"
                className={`rut-tab${vista === 'configurar' && origenRutinas === 'propias' ? ' is-active' : ''}`}
                onClick={() => { setOrigenRutinas('propias'); setVista('configurar') }}
              >
                Armar tu plan
              </button>
              <button
                type="button"
                className={`rut-tab${vista === 'progreso' && origenRutinas === 'propias' ? ' is-active' : ''}`}
                onClick={() => { setOrigenRutinas('propias'); setVista('progreso') }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 19V5M4 19h16" strokeLinecap="round" />
                  <path d="m7 15 3.5-4.5L14 13l4-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="rut-tab-label rut-tab-label--long">Progreso & Cargas</span>
                <span className="rut-tab-label rut-tab-label--short">Progreso & Cargas</span>
              </button>
            </nav>

            <div className="rut-origen" role="tablist" aria-label="Origen de rutinas">
              <button
                type="button"
                role="tab"
                aria-selected={origenRutinas === 'propias'}
                className={origenRutinas === 'propias' ? 'is-active' : ''}
                onClick={() => setOrigenRutinas('propias')}
              >
                Mis rutinas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={origenRutinas === 'asignadas'}
                className={origenRutinas === 'asignadas' ? 'is-active' : ''}
                onClick={() => setOrigenRutinas('asignadas')}
              >
                Asignadas por Profe
              </button>
            </div>
          </div>
        </header>
        </div>
      </div>

      <div className="rutina-scroll">
        <div className="container app-page-container rutina-container">
        {origenRutinas === 'propias' ? (
        <>

        {vista === 'progreso' && (
          <ProgresoCargasTitanium
            registros={registrosRutina}
            ejerciciosPlan={[
              ...new Set(
                (dias || []).flatMap((d) =>
                  (d.ejercicios || [])
                    .map((e) => (typeof e === 'string' ? e : e?.nombre))
                    .filter(Boolean)
                )
              ),
            ]}
            onAplicarSugerencia={({ ejercicio, carga }) => {
              setVista('registrar')
              window.alert(
                ejercicio && carga != null
                  ? `Sugerencia: en la próxima sesión de «${ejercicio}» apuntá a ${carga} kg.`
                  : 'Abrí Registrar sesión para aplicar la sugerencia.'
              )
            }}
          />
        )}

        {vista === 'configurar' && (
          <ArmarPlanTitanium
            dias={dias}
            diaEditando={diaEditando || diaActual?.id || ''}
            setDiaEditando={setDiaEditando}
            diaActual={diaActual}
            ejerciciosDelDia={ejerciciosDelDia}
            origenEditable={origenRutinas === 'propias'}
            onAñadirDia={añadirDia}
            onDuplicarDia={duplicarDia}
            onMoverDia={moverDia}
            onRenombrarDia={renombrarDia}
            onQuitarDia={quitarDia}
            onAñadirEjercicio={añadirEjercicioAlDia}
            onAñadirEjerciciosCatalogo={añadirEjerciciosCatalogoAlDia}
            onQuitarEjercicio={quitarEjercicioDelDiaPorIdx}
            onGuardarEjercicio={guardarEjercicioPlan}
            onDuplicarEjercicio={duplicarEjercicioEnDia}
            onReordenar={reordenarEjercicioDelDia}
            onVincularSuperserie={vincularSuperserie}
            onDesvincularSuperserie={desvincularSuperserie}
            onExportarPdf={() => {
              try {
                descargarRutinaPdf(rutinaActiva)
              } catch (err) {
                window.alert(err?.message || 'No se pudo exportar el PDF.')
              }
            }}
          />
        )}

        {vista === 'registrar' && (
          <div className="rut-sesion-layout">
            <div className="rut-sesion-main">
              <div className="rut-day-panel">
                <div className="rut-day-panel-top">
                  <p className="rut-day-kicker mb-0">
                    <i className="rut-day-dot" aria-hidden />
                    Seleccionar día del plan activo
                  </p>
                  <p className="rut-day-fecha mb-0">
                    <span className="rut-day-fecha-label">
                      {(fechaInput || hoy) === hoy ? 'Hoy:' : 'Sesión:'}
                    </span>{' '}
                    {(() => {
                      try {
                        const base = fechaInput || hoy
                        const [y, m, d] = base.split('-').map(Number)
                        return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })
                      } catch {
                        return fechaInput || hoy
                      }
                    })()}
                  </p>
                </div>

                <div className="rut-day-chips" role="group" aria-label="Día de la rutina">
                  {dias.map((d, di) => {
                    const grupos = inferirGruposMuscularesDia(d.ejercicios)
                    const cant = (d.ejercicios || []).length
                    const activo = diaSeleccionado === d.id
                    const titulo = grupos || d.nombre || `Día ${di + 1}`
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={`rut-day-chip rut-day-chip--tone-${di % 6}${activo ? ' is-active' : ''}`}
                        onClick={() => setDiaSeleccionado(d.id)}
                      >
                        {activo && (
                          <span className="rut-day-chip-check" aria-hidden>✓</span>
                        )}
                        <span className="rut-day-chip-name">Día {di + 1}: {titulo}</span>
                        <span className="rut-day-chip-badge">{cant} ejer.</span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    className="rut-day-chip rut-day-chip--add"
                    onClick={() => { setVista('configurar'); añadirDia() }}
                  >
                    + Añadir día
                  </button>
                </div>

                {(() => {
                  const { hechos, total, pct, kcal } = progresoSesion
                  return (
                    <div className={`rut-day-progress rut-day-progress--tone-${tonoDiaRegistro}`}>
                      <div className="rut-day-progress-top">
                        <p className="mb-0">
                          Progreso de la sesión:{' '}
                          <strong className="rut-day-progress-hi">
                            {hechos} de {total} ejercicios
                          </strong>{' '}
                          completados
                        </p>
                        <p className="rut-day-progress-meta mb-0">
                          {pct}% · Estimado: ~{kcal} kcal gastadas
                        </p>
                      </div>
                      <div className="rut-day-progress-bar" aria-hidden>
                        <span style={{ width: pct > 0 ? `${pct}%` : '0%' }} />
                      </div>
                    </div>
                  )
                })()}
              </div>

              {ejerciciosParaCargar.length === 0 ? (
                <div className="rut-empty">
                  <p className="mb-2">No hay ejercicios en <strong>{diaParaRegistrar?.nombre}</strong>.</p>
                  <button type="button" className="rut-btn-primary" onClick={() => setVista('configurar')}>
                    Ir a Armar tu plan
                  </button>
                </div>
              ) : (
                <SesionRegistroTitanium
                  key={`${diaSeleccionado}-${fechaInput}`}
                  diaTono={tonoDiaRegistro}
                  ejercicios={ejerciciosParaCargar}
                  registrosDeEstaSesion={registrosDeEstaSesion}
                  historialPorEjercicio={historialPorEjercicio}
                  pesoCfg={pesoCfg}
                  onGuardarSerie={guardarSerieSesion}
                  onGuardarSeries={guardarSeriesSesion}
                  onEliminarRegistro={eliminarRegistro}
                  onEliminarRegistros={eliminarRegistrosPorIds}
                  ocultarProgreso
                  onAnadirEjercicioExtra={() => {
                    const nombre = window.prompt('Nombre del ejercicio extra a añadir:')
                    const n = String(nombre || '').trim()
                    if (!n) return
                    const idDia = diaSeleccionado || diaParaRegistrar?.id
                    if (!idDia) return
                    const ya = nombresEjerciciosDia(diaParaRegistrar)
                    if (ya.includes(n)) {
                      window.alert('Ese ejercicio ya está en la sesión.')
                      return
                    }
                    actualizarRutina((r) => ({
                      ...r,
                      dias: r.dias.map((d) =>
                        d.id === idDia
                          ? { ...d, ejercicios: [...(d.ejercicios || []), n] }
                          : d
                      ),
                    }))
                  }}
                />
              )}

            </div>

            <aside className="rut-aside">
              <div className="rut-aside-card">
                <h2 className="rut-aside-title">Consistencia mensual</h2>
                <div className="rut-mini-cal-nav">
                  <button
                    type="button"
                    className="rut-icon-btn"
                    onClick={() => {
                      const [y, m] = mesCalendario.split('-').map(Number)
                      const prev = new Date(y, m - 2, 1)
                      setMesCalendario(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`)
                    }}
                  >
                    ‹
                  </button>
                  <span>
                    {(() => {
                      const [y, m] = mesCalendario.split('-').map(Number)
                      return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                    })()}
                  </span>
                  <button
                    type="button"
                    className="rut-icon-btn"
                    onClick={() => {
                      const [y, m] = mesCalendario.split('-').map(Number)
                      const next = new Date(y, m, 1)
                      setMesCalendario(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
                    }}
                  >
                    ›
                  </button>
                </div>
                <div className="rut-mini-cal">
                  <div className="rut-mini-cal-head">
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div className="rut-mini-cal-grid">
                    {diasDelMes.map((cel, i) => {
                      if (cel.vacio) return <span key={`e${i}`} className="rut-mini-cal-cell is-empty" />
                      const entrenado = fechasConEntreno.has(cel.fecha)
                      const esHoy = cel.fecha === hoy
                      const sel = cel.fecha === fechaInput
                      return (
                        <button
                          key={cel.fecha}
                          type="button"
                          className={`rut-mini-cal-cell${entrenado ? ' is-trained' : ''}${esHoy ? ' is-today' : ''}${sel ? ' is-sel' : ''}`}
                          onClick={() => seleccionarFechaSesion(cel.fecha)}
                          title={entrenado ? 'Ver sesión de este día' : 'Abrir sesión de este día'}
                        >
                          {cel.dia}
                          {entrenado && <i />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="rut-avance">
                <div className="rut-avance-head">
                  <div>
                    <h2 className="rut-avance-title">Avance de Cargas</h2>
                    <p className="rut-avance-sub mb-0">Últimos 30 días de progreso</p>
                  </div>
                  {(() => {
                    const conPeso = progresoOrdenadoEnPeriodo.filter((p) => p.ultima?.pesoKg && p.anterior?.pesoKg)
                    if (!conPeso.length) return null
                    const deltas = conPeso.map((p) => ((p.ultima.pesoKg - p.anterior.pesoKg) / p.anterior.pesoKg) * 100)
                    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length
                    const signo = avg >= 0 ? '+' : ''
                    return (
                      <span className={`rut-avance-badge${avg < 0 ? ' is-down' : ''}`}>
                        ↑ {signo}{Math.abs(avg).toFixed(1)}% fuerza
                      </span>
                    )
                  })()}
                </div>

                <div className="rut-avance-grid">
                  <div className="rut-avance-kpi">
                    <span className="rut-avance-kpi-label">Sesiones</span>
                    <strong className="rut-avance-kpi-value">{sesionesEnPeriodo}</strong>
                    <span className="rut-avance-kpi-hint">Días entrenados</span>
                  </div>
                  <div className="rut-avance-kpi">
                    <span className="rut-avance-kpi-label">Volumen Total</span>
                    <strong className="rut-avance-kpi-value is-blue">
                      {volumenTon >= 10 ? volumenTon.toFixed(1) : volumenTon.toFixed(2)} ton
                    </strong>
                    <span className="rut-avance-kpi-hint">Tonelaje acumulado</span>
                  </div>
                  <div className="rut-avance-kpi">
                    <span className="rut-avance-kpi-label">Ejercicios</span>
                    <strong className="rut-avance-kpi-value">{ejerciciosEnPeriodo}</strong>
                    <span className="rut-avance-kpi-hint">Patrones evaluados</span>
                  </div>
                  <div className="rut-avance-kpi">
                    <span className="rut-avance-kpi-label">Mejorados</span>
                    <strong className="rut-avance-kpi-value is-green">↑ {conMejora}</strong>
                    <span className="rut-avance-kpi-hint">Superaron PR previo</span>
                  </div>
                </div>

                {progresionEjercicioActivo ? (
                  <div className="rut-avance-prog">
                    <div className="rut-avance-prog-top">
                      <h3 className="rut-avance-prog-title">
                        {(() => {
                          const n = String(progresionEjercicioActivo.ejercicio || '')
                            .replace(/^\s*\d+\s*[-–.)]\s*/, '')
                            .replace(/\s*\(.*$/, '')
                            .trim()
                          const label = n.length > 26 ? `${n.slice(0, 24)}…` : n
                          return `${label} (Progresión)`
                        })()}
                      </h3>
                      <span className={`rut-avance-prog-pct${progresionEjercicioActivo.pct < 0 ? ' is-down' : ''}`}>
                        {progresionEjercicioActivo.pct >= 0 ? '+' : ''}{progresionEjercicioActivo.pct}% de carga
                      </span>
                    </div>
                    <div className="rut-avance-prog-meta">
                      <span>Inicio: {progresionEjercicioActivo.inicio} kg</span>
                      <span className="is-hoy">Hoy: {progresionEjercicioActivo.hoyPeso} kg</span>
                    </div>
                    <div className="rut-avance-prog-bar" aria-hidden>
                      <span
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              8,
                              progresionEjercicioActivo.pct === 0
                                ? 42
                                : 42 + Math.min(50, Math.abs(progresionEjercicioActivo.pct))
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rut-avance-prog is-empty">
                    <div className="rut-avance-prog-top">
                      <h3 className="rut-avance-prog-title">Progresión de carga</h3>
                      <span className="rut-avance-prog-pct is-muted">—</span>
                    </div>
                    <div className="rut-avance-prog-meta">
                      <span>Inicio: —</span>
                      <span className="is-hoy">Hoy: —</span>
                    </div>
                    <div className="rut-avance-prog-bar" aria-hidden>
                      <span style={{ width: '0%' }} />
                    </div>
                    <p className="rut-avance-prog-empty mb-0">Registrá series con kilos para ver la evolución aquí.</p>
                  </div>
                )}

                <button
                  type="button"
                  className="rut-avance-hist"
                  onClick={() => setVista('progreso')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                  </svg>
                  Ver historial completo de registros
                </button>
              </div>

              {syncRutinasNube && (
                <div className="rut-cloud">
                  <span className="rut-cloud-ico" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.4A3.5 3.5 0 0119 18H7z" />
                      <path d="M12 14v-6M9.5 10.5L12 8l2.5 2.5" />
                    </svg>
                  </span>
                  <div>
                    <strong>Sincronización Cloud con Profe</strong>
                    <p className="mb-0">Tus series y RPE se suben automáticamente a la nube al guardar.</p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
        </>
        ) : (
          <RutinasAsignadasTitanium
            rutinasAsignadas={Array.isArray(rutinasAsignadas) ? rutinasAsignadas : []}
            syncRutinasNube={syncRutinasNube}
            onCopiar={copiarAsignadaAMisRutinas}
            onQuitar={quitarAsignadaHandler}
            onRefreshAssignments={() => setAssignmentsRefreshTick((n) => n + 1)}
          />
        )}
        </div>
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
