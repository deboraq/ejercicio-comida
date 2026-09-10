import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useStorage } from '../../hooks/useStorage'
import { exportarRutinaAJson } from '../../utils/rutinaShare'
import { createRoutineAssignment } from '../../lib/profeDb'
import {
  nombreDeEjercicioDiaItem,
  itemEjercicioDiaNormalizado,
  inferirGrupoMuscular,
  resumenPlanDia,
  GRUPOS_MUSCULARES_OPCIONES,
} from '../../utils/rutinaEjercicioDia'
import {
  catalogoItemNormalizado,
  applyProfeCatalogoSeedSync,
  buscarSugerenciasCatalogo,
  getCategoriaCatalogo,
} from '../../utils/profeCatalogo'
import { grupoMuscularTone } from './profeCatalogoUi'
import ProfeCatalogoPickerModal from './ProfeCatalogoPickerModal'
import CatalogoEjercicioSuggest from './CatalogoEjercicioSuggest'

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizarNombreEjercicio(nombreRaw) {
  return String(nombreRaw || '').trim().toLocaleUpperCase('es')
}

function grupoMuscularDisplay(row) {
  const inferido = inferirGrupoMuscular(row?.nombre)
  const guardado = String(row?.grupoMuscular || '').trim()
  if (guardado && guardado !== 'Otro' && GRUPOS_MUSCULARES_OPCIONES.includes(guardado)) return guardado
  return GRUPOS_MUSCULARES_OPCIONES.includes(inferido) ? inferido : 'Otro'
}

function emptyDia(i) {
  return { id: newId('pd'), nombre: `Día ${i}`, ejercicios: [] }
}

function emptyPlantilla() {
  return { id: newId('pt'), nombre: 'Nueva plantilla', dias: [emptyDia(1)], soloStudentId: null, tags: [] }
}

const TAGS_RAPIDOS = [
  { label: 'Nivel: Principiante', dot: 'blue' },
  { label: 'Nivel: Intermedio', dot: 'blue' },
  { label: 'Nivel: Avanzado', dot: 'purple' },
  { label: 'Enfoque: Hipertrofia', dot: 'green' },
  { label: 'Enfoque: Fuerza', dot: 'amber' },
  { label: '4 Sesiones semanales', dot: 'yellow' },
  { label: '3 Sesiones semanales', dot: 'yellow' },
]

function clonarEjercicioParaPlantilla(e) {
  const it = rowEjercicio(e)
  if (!it) return null
  const o = { nombre: it.nombre }
  if (it.series.trim()) o.series = it.series.trim()
  if (it.repeticiones.trim()) o.repeticiones = it.repeticiones.trim()
  if (it.descansoPostRonda.trim()) o.descansoPostRonda = it.descansoPostRonda.trim()
  if (it.carga.trim()) o.carga = it.carga.trim()
  if (it.grupoMuscular.trim()) o.grupoMuscular = it.grupoMuscular.trim()
  if (!it.series.trim() && !it.repeticiones.trim() && !it.descansoPostRonda.trim() && !it.carga.trim()) return it.nombre
  return o
}

function rowEjercicio(e) {
  const it = itemEjercicioDiaNormalizado(e)
  if (!it) return null
  const raw = typeof e === 'object' && e ? e : {}
  return {
    ...it,
    descansoPostRonda:
      it.descansoPostRonda ||
      (raw.descanso != null ? String(raw.descanso) : '') ||
      (raw.descansoPostRonda != null ? String(raw.descansoPostRonda) : ''),
    carga: it.carga || (raw.rir != null ? String(raw.rir) : ''),
    grupoMuscular: it.grupoMuscular || inferirGrupoMuscular(it.nombre),
    notas: it.notas || (raw.notas != null ? String(raw.notas).trim() : ''),
  }
}

function duplicarPlantillaDesde(p) {
  const base = String(p.nombre || 'Sin nombre').trim() || 'Sin nombre'
  const dias = (p.dias || []).map((d, i) => {
    const ejercicios = (d.ejercicios || []).map(clonarEjercicioParaPlantilla).filter((x) => x != null)
    return { id: newId('pd'), nombre: d.nombre || `Día ${i + 1}`, ejercicios }
  })
  return {
    id: newId('pt'),
    nombre: `Copia de ${base}`,
    dias: dias.length ? dias : [emptyDia(1)],
    soloStudentId: p.soloStudentId || null,
    tags: Array.isArray(p.tags) ? [...p.tags] : [],
  }
}

function plantillaCoincideBusqueda(p, students, q) {
  if (!q) return true
  const n = (p.nombre || '').toLowerCase()
  if (n.includes(q)) return true
  for (const t of p.tags || []) {
    if (String(t).toLowerCase().includes(q)) return true
  }
  if (p.soloStudentId) {
    const st = students.find((s) => s.studentId === p.soloStudentId)
    const blob = `${st?.fullName || ''} ${st?.email || ''}`.toLowerCase()
    if (blob.includes(q)) return true
  }
  for (const d of p.dias || []) {
    if (String(d.nombre || '').toLowerCase().includes(q)) return true
    for (const ex of d.ejercicios || []) {
      if (nombreDeEjercicioDiaItem(ex).toLowerCase().includes(q)) return true
    }
  }
  return false
}

function etiquetaAlumnoOpcionEnvio(s) {
  const name = String(s.fullName || '').trim()
  const mail = String(s.email || '').trim()
  if (name && mail) return `${name} · ${mail}`
  return name || mail || 'Sin datos'
}

function puedeRecibirPlantilla(plantilla, studentId) {
  if (!plantilla?.soloStudentId) return true
  return plantilla.soloStudentId === studentId
}

function plantillasNecesitanMigracion(arr) {
  for (const p of arr || []) {
    for (const d of p.dias || []) {
      for (const e of d.ejercicios || []) {
        if (typeof e === 'string') return true
      }
    }
  }
  return false
}

function metaPlantilla(p) {
  const dias = (p.dias || []).length
  const ejercicios = (p.dias || []).reduce((n, d) => n + (d.ejercicios || []).length, 0)
  return { dias, ejercicios }
}

function badgePlantilla(p, students) {
  if (p.soloStudentId) {
    const st = students.find((s) => s.studentId === p.soloStudentId)
    const name = st?.fullName || st?.email || 'alumno'
    return { label: `Personalizada (${name})`, tone: 'personal', short: 'Personalizada' }
  }
  return { label: 'Plantilla global', tone: 'global', short: 'Global' }
}

function normalizarEjerciciosDia(list) {
  return (list || []).map(rowEjercicio).filter(Boolean)
}

function plantillaEsBorradorVacio(p) {
  if (!p) return false
  const nom = String(p.nombre || '').trim()
  if (nom !== '' && nom !== 'Nueva plantilla') return false
  if (p.soloStudentId) return false
  const dias = Array.isArray(p.dias) ? p.dias : []
  if (dias.length !== 1) return false
  const d0 = dias[0]
  if (String(d0?.nombre || '').trim() !== 'Día 1') return false
  const ej = normalizarEjerciciosDia(d0?.ejercicios || [])
  return ej.length === 0
}

const FLOW_STEPS = [
  {
    n: 1,
    tone: 'blue',
    title: 'Elegir o Crear',
    hint: 'Seleccioná de tu lista a la izquierda o tocá «+ Nueva Plantilla»',
    guide: (
      <>
        Elegí acá — buscá en la biblioteca o tocá <strong>+ Nueva Plantilla</strong> para empezar
      </>
    ),
  },
  {
    n: 2,
    tone: 'violet',
    title: 'Organizar Días',
    hint: 'Creá pestañas de microciclos (Día 1 Torso, Día 2 Pierna…)',
    guide: (
      <>
        Organizá acá — agregá días y configurá las pestañas de <strong>microciclos</strong>
      </>
    ),
  },
  {
    n: 3,
    tone: 'green',
    title: 'Sumar Ejercicios',
    hint: 'Buscá en catálogo o escribí directo; seteá series, reps y RIR.',
    guide: (
      <>
        Sumá acá — buscá en el catálogo o tipeá ejercicios con <strong>series, reps y RIR</strong>
      </>
    ),
  },
  {
    n: 4,
    tone: 'amber',
    title: 'Publicar y Asignar',
    hint: 'Mandala directo al alumno seleccionado o guardala global.',
    guide: (
      <>
        Publicá acá — guardá borrador o tocá <strong>Publicar y Asignar</strong> para enviar
      </>
    ),
  },
]

function FlowStepSwatch({ tone }) {
  return <span className={`pf-ws-flow-swatch pf-ws-flow-swatch--${tone}`} aria-hidden />
}

function BlockStepNum({ tone, n }) {
  return <span className={`pf-ws-step-num pf-ws-step-num--${tone}`}>{n}</span>
}

function WsGuideBanner({ tone, children }) {
  return (
    <div className={`pf-ws-guide-banner pf-ws-guide-banner--${tone}`} role="status" aria-live="polite">
      <span className="pf-ws-guide-dot" aria-hidden />
      {children}
    </div>
  )
}

function zoneGuideClass(guiaPaso, n, tone) {
  if (guiaPaso !== n) return ''
  return ` pf-ws-zone--guide pf-ws-zone--guide-${tone}`
}

function innerGuideClass(guiaPaso, n, tone) {
  if (guiaPaso !== n) return ''
  return ` pf-ws-guide-inner pf-ws-guide-inner--${tone}`
}

export default function ProfeRutinasWorkshop({ students, teacherId, busqueda = '', onToast, onEnviado }) {
  const [plantillas, setPlantillas] = useStorage('profePlantillasRutina', [])
  const [catalogo, setCatalogo] = useStorage('profeCatalogoEjercicios', [])
  const [, setCatalogoMeta] = useStorage('profeCatalogoMeta', { seedVersion: 0 })
  const [favoritos, setFavoritos] = useStorage('profeCatalogoFavoritos', [])
  const [categoriasCustom, setCategoriasCustom] = useStorage('profeCatalogoCategorias', [])

  useEffect(() => {
    applyProfeCatalogoSeedSync(setCatalogo, setCatalogoMeta)
  }, [setCatalogo, setCatalogoMeta])

  const listP = Array.isArray(plantillas) ? plantillas : []
  const listC = useMemo(
    () =>
      (Array.isArray(catalogo) ? catalogo : [])
        .map((c) => catalogoItemNormalizado(c))
        .filter(Boolean)
        .filter((c) => String(c.nombre || '').trim()),
    [catalogo],
  )
  const listCOrdenado = useMemo(
    () =>
      [...listC].sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), undefined, { sensitivity: 'base' })
      ),
    [listC]
  )

  const [selectedId, setSelectedId] = useState('')
  const [picker, setPicker] = useState(null)
  const idBorradorNuevaRef = useRef(null)
  const snapshotRef = useRef(null)
  const [modalEnviar, setModalEnviar] = useState(null)
  const [qModalEnviar, setQModalEnviar] = useState('')
  const [enviandoModal, setEnviandoModal] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [qLocal, setQLocal] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todas')
  const [diaActivoIdx, setDiaActivoIdx] = useState(0)
  const [qEjercicioDia, setQEjercicioDia] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestIdx, setSuggestIdx] = useState(-1)
  const [guiaPaso, setGuiaPaso] = useState(null)
  const guiaTimerRef = useRef(null)

  const sugerenciasDia = useMemo(
    () => buscarSugerenciasCatalogo(listCOrdenado, qEjercicioDia, { limit: 8 }),
    [listCOrdenado, qEjercicioDia],
  )

  const sugerenciasDiaTotal = sugerenciasDia.length + (qEjercicioDia.trim() ? 1 : 0)
  const masterRef = useRef(null)
  const block1Ref = useRef(null)
  const block2Ref = useRef(null)
  const block3Ref = useRef(null)
  const footerRef = useRef(null)

  const qBusq = (busqueda || '').trim().toLowerCase()
  const qBusqueda = (qLocal || qBusq).trim().toLowerCase()

  const conteosFiltro = useMemo(
    () => ({
      todas: listP.length,
      globales: listP.filter((p) => !p.soloStudentId).length,
      alumno: listP.filter((p) => p.soloStudentId).length,
      borradores: listP.filter(plantillaEsBorradorVacio).length,
    }),
    [listP]
  )

  const plantillasVisibles = useMemo(() => {
    let arr = listP
    if (filtroTipo === 'globales') arr = arr.filter((p) => !p.soloStudentId)
    else if (filtroTipo === 'alumno') arr = arr.filter((p) => p.soloStudentId)
    else if (filtroTipo === 'borradores') arr = arr.filter(plantillaEsBorradorVacio)
    if (qBusqueda) arr = arr.filter((p) => plantillaCoincideBusqueda(p, students, qBusqueda))
    return arr
  }, [listP, filtroTipo, qBusqueda, students])

  const qModalTrim = (qModalEnviar || '').trim().toLowerCase()
  const alumnosModalFiltrados = useMemo(() => {
    if (!modalEnviar) return []
    const p = listP.find((x) => x.id === modalEnviar.plantillaId)
    const base = students.filter((s) => p && puedeRecibirPlantilla(p, s.studentId))
    if (!qModalTrim) return base
    return base.filter((s) => {
      const fn = (s.fullName || '').toLowerCase()
      const em = (s.email || '').toLowerCase()
      return fn.includes(qModalTrim) || em.includes(qModalTrim)
    })
  }, [modalEnviar, students, listP, qModalTrim])

  const plantilla = listP.find((p) => p.id === selectedId)
  const metaSel = plantilla ? metaPlantilla(plantilla) : { dias: 0, ejercicios: 0 }
  const diasPlantilla = plantilla?.dias || []
  const diaActivo = diasPlantilla[diaActivoIdx] || diasPlantilla[0]
  const filasDiaActivo = normalizarEjerciciosDia(diaActivo?.ejercicios)

  const resumenDiaActivo = useMemo(
    () => resumenPlanDia(diaActivo?.ejercicios || []),
    [diaActivo?.ejercicios]
  )

  const activarGuiaPaso = useCallback((n) => {
    setGuiaPaso(n)
    if (guiaTimerRef.current) clearTimeout(guiaTimerRef.current)
    guiaTimerRef.current = window.setTimeout(() => setGuiaPaso(null), 5000)

    window.setTimeout(() => {
      if (n === 1) {
        masterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      if (n === 4) {
        footerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      const refs = [null, block1Ref, block2Ref, block3Ref]
      refs[n]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 40)
  }, [])

  const irAPaso = activarGuiaPaso

  useEffect(
    () => () => {
      if (guiaTimerRef.current) clearTimeout(guiaTimerRef.current)
    },
    []
  )

  useEffect(() => {
    setPlantillas((prev) => {
      const arr = Array.isArray(prev) ? prev : []
      if (!plantillasNecesitanMigracion(arr)) return prev
      return arr.map((p) => ({
        ...p,
        dias: (p.dias || []).map((d) => ({
          ...d,
          ejercicios: normalizarEjerciciosDia(d.ejercicios),
        })),
      }))
    })
  }, [setPlantillas])

  useEffect(() => {
    if (!listP.length) {
      setSelectedId('')
      return
    }
    if (selectedId && listP.some((p) => p.id === selectedId)) return
    setSelectedId(listP[0].id)
  }, [listP, selectedId])

  useEffect(() => {
    if (!plantilla) return
    snapshotRef.current = JSON.stringify(plantilla)
    setEditorDirty(false)
  }, [selectedId])

  useEffect(() => {
    if (diaActivoIdx >= diasPlantilla.length) setDiaActivoIdx(Math.max(0, diasPlantilla.length - 1))
  }, [diaActivoIdx, diasPlantilla.length])

  const seleccionarPlantilla = useCallback((id) => {
    setSelectedId(id)
    setDiaActivoIdx(0)
    setQEjercicioDia('')
    idBorradorNuevaRef.current = null
  }, [])

  const agregarPlantilla = () => {
    const n = emptyPlantilla()
    idBorradorNuevaRef.current = n.id
    setPlantillas((prev) => [...(Array.isArray(prev) ? prev : []), n])
    seleccionarPlantilla(n.id)
    activarGuiaPaso(1)
  }

  const eliminarRutinaPorId = (id) => {
    const p = listP.find((x) => x.id === id)
    if (!p || !window.confirm(`¿Eliminar la plantilla «${p.nombre || 'Sin nombre'}»? Esta acción no se puede deshacer.`)) {
      return
    }
    const next = listP.filter((x) => x.id !== id)
    setPlantillas(next)
    if (selectedId === id) {
      if (idBorradorNuevaRef.current === id) idBorradorNuevaRef.current = null
      setSelectedId(next[0]?.id ?? '')
      setEditorDirty(false)
    }
    onToast?.({ msg: `Plantilla «${p.nombre || 'Sin nombre'}» eliminada.` })
  }

  const duplicarPlantillaPorId = (id) => {
    const p = listP.find((x) => x.id === id)
    if (!p) return
    const n = duplicarPlantillaDesde(p)
    setPlantillas((prev) => [...(Array.isArray(prev) ? prev : []), n])
    seleccionarPlantilla(n.id)
    onToast?.({ msg: `Plantilla duplicada: «${n.nombre}».` })
  }

  const updatePlantilla = useCallback(
    (id, fn) => {
      setPlantillas((prev) =>
        (Array.isArray(prev) ? prev : []).map((p) => (p.id === id ? fn({ ...p }) : p))
      )
      setEditorDirty(true)
    },
    [setPlantillas]
  )

  const guardarEditor = useCallback(() => {
    if (!editorDirty) return
    setPlantillas((prev) => {
      try {
        const next = JSON.parse(JSON.stringify(Array.isArray(prev) ? prev : []))
        const cur = next.find((p) => p.id === selectedId)
        if (cur) snapshotRef.current = JSON.stringify(cur)
        return next
      } catch {
        return Array.isArray(prev) ? [...prev] : []
      }
    })
    setEditorDirty(false)
    idBorradorNuevaRef.current = null
    onToast?.({
      msg: 'Rutina guardada en este dispositivo y en tu cuenta (si iniciaste sesión).',
    })
  }, [editorDirty, setPlantillas, onToast, selectedId])

  const descartarCambios = () => {
    const cur = listP.find((x) => x.id === selectedId)
    if (cur && plantillaEsBorradorVacio(cur)) {
      const next = listP.filter((x) => x.id !== selectedId)
      setPlantillas(next)
      setSelectedId(next[0]?.id ?? '')
      idBorradorNuevaRef.current = null
      onToast?.({ msg: 'Borrador vacío descartado.' })
      return
    }
    if (!snapshotRef.current) return
    try {
      const snap = JSON.parse(snapshotRef.current)
      if (snap?.id !== selectedId) return
      setPlantillas((prev) => (Array.isArray(prev) ? prev : []).map((p) => (p.id === selectedId ? snap : p)))
      setEditorDirty(false)
      onToast?.({ msg: 'Cambios descartados.' })
    } catch {
      /* noop */
    }
  }

  const publicarYAsignar = () => {
    guardarEditor()
    if (selectedId) abrirModalEnviar(selectedId)
  }

  const abrirPicker = (dayIndex) => {
    if (!plantilla) return
    applyProfeCatalogoSeedSync(setCatalogo, setCatalogoMeta)
    setPicker({ dayIndex, initialQ: qEjercicioDia.trim() })
  }

  const agregarItemsCatalogoAlDia = (dayIndex, pickedItems) => {
    if (!plantilla || !pickedItems?.length) return
    const actuales = normalizarEjerciciosDia(plantilla.dias[dayIndex]?.ejercicios)
    const agregar = pickedItems
      .map((c) => {
        const nombre = normalizarNombreEjercicio(c.nombre)
        return {
          nombre,
          series: '',
          repeticiones: '',
          grupoMuscular: inferirGrupoMuscular(nombre),
          notas: String(c.notas || '').trim(),
        }
      })
      .filter((x) => x.nombre)

    updatePlantilla(plantilla.id, (p) => {
      const dias = [...(p.dias || [])]
      dias[dayIndex] = { ...dias[dayIndex], ejercicios: [...actuales, ...agregar] }
      return { ...p, dias }
    })
    onToast?.({
      msg: `${agregar.length} ejercicio${agregar.length === 1 ? '' : 's'} sumado${agregar.length === 1 ? '' : 's'} al Día ${dayIndex + 1}.`,
    })
  }

  const agregarEjercicioManual = (dayIndex, nombreRaw) => {
    const nombre = normalizarNombreEjercicio(nombreRaw)
    if (!plantilla || !nombre) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[dayIndex] }
      d.ejercicios = [
        ...(d.ejercicios || []),
        { nombre, series: '', repeticiones: '', grupoMuscular: inferirGrupoMuscular(nombre) },
      ]
      dias[dayIndex] = d
      return { ...p, dias }
    })
    setQEjercicioDia('')
    setSuggestOpen(false)
    setSuggestIdx(-1)
  }

  const agregarDesdeSugerencia = (dayIndex, item) => {
    if (!plantilla || !item?.nombre) return
    const nombre = normalizarNombreEjercicio(item.nombre)
    const cat = getCategoriaCatalogo(item)
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[dayIndex] }
      d.ejercicios = [
        ...(d.ejercicios || []),
        {
          nombre,
          series: '',
          repeticiones: '',
          grupoMuscular: inferirGrupoMuscular(nombre) || cat,
          notas: String(item.notas || '').trim(),
        },
      ]
      dias[dayIndex] = d
      return { ...p, dias }
    })
    setQEjercicioDia('')
    setSuggestOpen(false)
    setSuggestIdx(-1)
    onToast?.({ msg: `«${item.nombre}» sumado al Día ${dayIndex + 1}.` })
  }

  const onQEjercicioChange = (value) => {
    setQEjercicioDia(value)
    setSuggestOpen(Boolean(String(value).trim()))
    setSuggestIdx(-1)
  }

  const onQEjercicioKeyDown = (e, dayIndex) => {
    if (!qEjercicioDia.trim()) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestOpen(true)
      setSuggestIdx((i) => (i + 1) % sugerenciasDiaTotal)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestOpen(true)
      setSuggestIdx((i) => (i <= 0 ? sugerenciasDiaTotal - 1 : i - 1))
      return
    }
    if (e.key === 'Escape') {
      setSuggestOpen(false)
      setSuggestIdx(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestIdx >= 0 && suggestIdx < sugerenciasDia.length) {
        agregarDesdeSugerencia(dayIndex, sugerenciasDia[suggestIdx])
        return
      }
      if (suggestIdx === sugerenciasDia.length || sugerenciasDia.length === 0) {
        agregarEjercicioManual(dayIndex, qEjercicioDia)
        return
      }
      if (sugerenciasDia.length === 1) {
        agregarDesdeSugerencia(dayIndex, sugerenciasDia[0])
      }
    }
  }

  const quitarEjercicioLinea = (dayIndex, ei) => {
    if (!plantilla) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[dayIndex] }
      d.ejercicios = (d.ejercicios || []).filter((_, j) => j !== ei)
      dias[dayIndex] = d
      return { ...p, dias }
    })
  }

  const reordenarEjercicioDia = (dayIndex, desde, hasta) => {
    if (!plantilla || desde === hasta) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[dayIndex] }
      const ej = [...(d.ejercicios || [])]
      if (desde < 0 || hasta < 0 || desde >= ej.length || hasta >= ej.length) return p
      const [item] = ej.splice(desde, 1)
      ej.splice(hasta, 0, item)
      d.ejercicios = ej
      dias[dayIndex] = d
      return { ...p, dias }
    })
  }

  const patchEjercicioCampo = (dayIndex, ei, campo, valor) => {
    if (!plantilla) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[dayIndex] }
      const ej = [...(d.ejercicios || [])]
      const prev = rowEjercicio(ej[ei]) || {
        nombre: '',
        series: '',
        repeticiones: '',
        descansoPostRonda: '',
        carga: '',
        grupoMuscular: '',
        notas: '',
      }
      ej[ei] = { ...prev, [campo]: campo === 'nombre' ? normalizarNombreEjercicio(valor) : valor }
      if (campo === 'nombre') {
        const nombre = normalizarNombreEjercicio(valor)
        const guardado = String(prev.grupoMuscular || '').trim()
        if (!guardado || guardado === 'Otro') {
          const sugerido = inferirGrupoMuscular(nombre)
          if (sugerido !== 'Otro') ej[ei].grupoMuscular = sugerido
        }
      }
      d.ejercicios = ej
      dias[dayIndex] = d
      return { ...p, dias }
    })
  }

  const aplicarCategoriasSugeridas = () => {
    if (!plantilla) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...p.dias]
      const d = { ...dias[diaActivoIdx] }
      d.ejercicios = (d.ejercicios || []).map((ex) => {
        const prev = rowEjercicio(ex)
        if (!prev) return ex
        const guardado = String(prev.grupoMuscular || '').trim()
        if (guardado && guardado !== 'Otro') return typeof ex === 'object' ? ex : prev
        const sugerido = inferirGrupoMuscular(prev.nombre)
        if (sugerido === 'Otro') return typeof ex === 'object' ? ex : prev
        return { ...(typeof ex === 'object' && ex ? ex : prev), grupoMuscular: sugerido }
      })
      dias[diaActivoIdx] = d
      return { ...p, dias }
    })
    onToast?.({ msg: 'Categorías sugeridas aplicadas al día activo.' })
  }

  const agregarDia = () => {
    if (!plantilla) return
    updatePlantilla(plantilla.id, (p) => {
      const next = [...(p.dias || []), emptyDia((p.dias || []).length + 1)]
      return { ...p, dias: next }
    })
    setDiaActivoIdx(diasPlantilla.length)
  }

  const duplicarDia = (idx) => {
    if (!plantilla) return
    updatePlantilla(plantilla.id, (p) => {
      const dias = [...(p.dias || [])]
      const src = dias[idx]
      if (!src) return p
      const copia = {
        id: newId('pd'),
        nombre: `${src.nombre || `Día ${idx + 1}`} (copia)`,
        ejercicios: (src.ejercicios || []).map(clonarEjercicioParaPlantilla).filter((x) => x != null),
      }
      dias.splice(idx + 1, 0, copia)
      return { ...p, dias }
    })
    setDiaActivoIdx(idx + 1)
  }

  const quitarDia = (idx) => {
    if (!plantilla || (plantilla.dias || []).length <= 1) return
    updatePlantilla(plantilla.id, (p) => ({
      ...p,
      dias: (p.dias || []).filter((_, i) => i !== idx),
    }))
    if (diaActivoIdx >= idx) setDiaActivoIdx(Math.max(0, diaActivoIdx - 1))
  }

  const toggleTag = (tagLabel) => {
    if (!plantilla) return
    updatePlantilla(plantilla.id, (p) => {
      const tags = Array.isArray(p.tags) ? [...p.tags] : []
      const i = tags.indexOf(tagLabel)
      if (i >= 0) tags.splice(i, 1)
      else tags.push(tagLabel)
      return { ...p, tags }
    })
  }

  const abrirModalEnviar = (plantillaId) => {
    if (!teacherId) {
      onToast({ err: 'No hay sesión de entrenador.' })
      return
    }
    const p = listP.find((x) => x.id === plantillaId)
    if (!p) return
    if (!students.length) {
      onToast({ err: 'Vinculá alumnos en la pestaña Alumnos.' })
      return
    }
    const compatibles = students.filter((s) => puedeRecibirPlantilla(p, s.studentId))
    if (!compatibles.length) {
      onToast({
        err: 'Ningún alumno vinculado puede recibir esta plantilla (está marcada solo para otro alumno).',
      })
      return
    }
    setQModalEnviar('')
    setModalEnviar({
      plantillaId,
      seleccion: new Set(compatibles.map((s) => s.studentId)),
    })
  }

  const toggleSeleccionModal = (studentId) => {
    setModalEnviar((prev) => {
      if (!prev) return prev
      const p = listP.find((x) => x.id === prev.plantillaId)
      if (!p || !puedeRecibirPlantilla(p, studentId)) return prev
      const s = new Set(prev.seleccion)
      if (s.has(studentId)) s.delete(studentId)
      else s.add(studentId)
      return { ...prev, seleccion: s }
    })
  }

  const confirmarEnviarModal = async () => {
    if (!modalEnviar || !teacherId) return
    const p = listP.find((x) => x.id === modalEnviar.plantillaId)
    if (!p) {
      setModalEnviar(null)
      return
    }
    const ids = [...modalEnviar.seleccion].filter((sid) => puedeRecibirPlantilla(p, sid))
    if (!ids.length) {
      onToast({ err: 'Elegí al menos un alumno.' })
      return
    }
    setEnviandoModal(true)
    let ok = 0
    let fail = 0
    let lastErr = ''
    try {
      const obj = JSON.parse(exportarRutinaAJson({ nombre: p.nombre, dias: p.dias }))
      const dias = Array.isArray(obj.dias) ? obj.dias : []
      for (const studentId of ids) {
        const { error } = await createRoutineAssignment(teacherId, studentId, p.nombre || 'Rutina', { dias })
        if (error) {
          fail += 1
          lastErr = error.message || ''
        } else ok += 1
      }
    } catch (e) {
      onToast({ err: e?.message || 'Error al preparar la rutina.' })
      setEnviandoModal(false)
      return
    }
    setEnviandoModal(false)
    setModalEnviar(null)
    if (ok && !fail) {
      onToast({
        msg:
          ok === 1
            ? `Rutina «${p.nombre}» enviada. El alumno la ve en Rutina → Asignadas.`
            : `Rutina «${p.nombre}» enviada a ${ok} alumnos. La ven en Rutina → Asignadas.`,
      })
      onEnviado?.()
    } else if (ok && fail) {
      onToast({
        msg: `Enviada a ${ok} alumno${ok === 1 ? '' : 's'}.`,
        err: `Falló ${fail} envío${fail === 1 ? '' : 's'}${lastErr ? `: ${lastErr}` : '.'}`,
      })
      onEnviado?.()
    } else {
      onToast({ err: lastErr || 'No se pudo enviar.' })
    }
  }

  const plantillaModal = modalEnviar ? listP.find((x) => x.id === modalEnviar.plantillaId) : null
  const nSeleccionModal = modalEnviar?.seleccion?.size ?? 0

  const filtrosChip = [
    { id: 'todas', label: 'Todas', count: conteosFiltro.todas },
    { id: 'globales', label: 'Globales', count: conteosFiltro.globales },
    { id: 'alumno', label: 'Por Alumno', count: conteosFiltro.alumno },
    { id: 'borradores', label: 'Borradores', count: conteosFiltro.borradores },
  ]

  return (
    <>
      <div className="pf-ws">
        <header className="pf-ws-header">
          <nav className="pf-ws-breadcrumb" aria-label="Ruta">
            <span>Módulo Profe</span>
            <span className="pf-ws-breadcrumb-sep">›</span>
            <span className="pf-ws-breadcrumb-current pf-ws-breadcrumb-current--long">Plantillas de Entrenamiento</span>
            <span className="pf-ws-breadcrumb-current pf-ws-breadcrumb-current--short">Plantillas</span>
          </nav>
          <div className="pf-ws-header-meta">
            <span className="pf-ws-header-sep" aria-hidden />
            <span className="pf-ws-topbar-pill pf-ws-topbar-pill--active">Workspace Todo-en-Uno</span>
            <span className="pf-ws-topbar-pill pf-ws-topbar-pill--save">
              <span className="pf-ws-autosave-dot" aria-hidden />
              <span className="pf-ws-autosave-label pf-ws-autosave-label--long">Autoguardado en la nube</span>
              <span className="pf-ws-autosave-label pf-ws-autosave-label--short">Autoguardado</span>
            </span>
          </div>
          <div className="pf-ws-header-actions">
            <button
              type="button"
              className="pf-ws-btn-import"
              aria-label="Importar plantilla"
              onClick={() => onToast?.({ msg: 'Importar plantilla desde JSON próximamente.' })}
            >
              <svg className="pf-ws-btn-import-ico" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M10 3v10M6 7l4-4 4 4M4 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="pf-ws-btn-import-label pf-ws-btn-import-label--long">Importar plantilla</span>
              <span className="pf-ws-btn-import-label pf-ws-btn-import-label--short">Importar</span>
            </button>
            <button type="button" className="pf-ws-btn-new" onClick={agregarPlantilla}>
              <span className="pf-ws-btn-new-label pf-ws-btn-new-label--long">+ Nueva Plantilla</span>
              <span className="pf-ws-btn-new-label pf-ws-btn-new-label--short">+ Nueva</span>
            </button>
          </div>
        </header>

        <section className="pf-ws-flow" aria-label="Flujo rápido del entrenador">
          <div className="pf-ws-flow-head">
            <h2 className="pf-ws-flow-title">
              <span className="pf-ws-flow-info" aria-hidden>
                i
              </span>
              Flujo rápido del entrenador: ¿Cómo armar y asignar en minutos?
            </h2>
            <p className="pf-ws-flow-aside">Podés hacer todo directamente desde esta misma pantalla</p>
          </div>
          <ol className="pf-ws-flow-steps">
            {FLOW_STEPS.map((step) => (
              <li key={step.n}>
                <button
                  type="button"
                  className={`pf-ws-flow-step pf-ws-flow-step--${step.tone}`}
                  onClick={() => irAPaso(step.n)}
                >
                  <FlowStepSwatch tone={step.tone} />
                  <div className="pf-ws-flow-copy">
                    <strong>{step.title}</strong>
                    <span>{step.hint}</span>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <div className="pf-ws-split">
          <aside
            className={`pf-ws-master${zoneGuideClass(guiaPaso, 1, 'blue')}`}
            ref={masterRef}
          >
            {guiaPaso === 1 ? <WsGuideBanner tone="blue">{FLOW_STEPS[0].guide}</WsGuideBanner> : null}
            <div className={`pf-ws-guide-body${innerGuideClass(guiaPaso, 1, 'blue')}`}>
            <div className="pf-ws-master-head">
              <h3 className="pf-ws-panel-title">Biblioteca de Plantillas</h3>
              <span className="pf-ws-count-badge">{conteosFiltro.todas} total</span>
            </div>

            <div className="pf-ws-search-wrap">
              <span className="pf-ws-search-icon" aria-hidden>
                ⌕
              </span>
              <input
                type="search"
                className="pf-ws-search"
                placeholder="Buscar por nombre o etiqueta…"
                value={qLocal}
                onChange={(e) => setQLocal(e.target.value)}
                aria-label="Buscar plantillas"
              />
            </div>

            <div className="pf-ws-filters" role="tablist" aria-label="Filtrar plantillas">
              {filtrosChip.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filtroTipo === f.id}
                  className={`pf-ws-filter-chip${filtroTipo === f.id ? ' pf-ws-filter-chip--active' : ''}`}
                  onClick={() => setFiltroTipo(f.id)}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

            {!listP.length ? (
              <p className="pf-muted pf-ws-empty-list">Tocá «+ Nueva Plantilla» para crear la primera.</p>
            ) : plantillasVisibles.length === 0 ? (
              <p className="pf-muted pf-ws-empty-list">Ninguna plantilla coincide con la búsqueda o el filtro.</p>
            ) : (
              <ul className="pf-ws-template-list">
                {plantillasVisibles.map((p) => {
                  const meta = metaPlantilla(p)
                  const badge = badgePlantilla(p, students)
                  const activa = p.id === selectedId
                  return (
                    <li key={p.id}>
                      <article
                        className={`pf-ws-template-card${activa ? ' pf-ws-template-card--active' : ''}`}
                        onClick={() => seleccionarPlantilla(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            seleccionarPlantilla(p.id)
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-current={activa ? 'true' : undefined}
                      >
                        <div className="pf-ws-template-badges">
                          <span className={`pf-ws-type-badge pf-ws-type-badge--${badge.tone}`}>
                            {badge.tone === 'global' ? 'Plantilla global' : badge.short}
                          </span>
                          {activa ? (
                            <span className="pf-ws-editing-badge">
                              <span className="pf-ws-editing-dot" aria-hidden />
                              Editando ahora
                            </span>
                          ) : null}
                        </div>
                        <strong className="pf-ws-template-name">{p.nombre || 'Sin nombre'}</strong>
                        <p className="pf-ws-template-meta">
                          {meta.dias} microciclos (días) · {meta.ejercicios}{' '}
                          {meta.ejercicios === 1 ? 'ejercicio' : 'ejercicios'} vinculados
                        </p>
                        {(p.tags || []).length > 0 ? (
                          <div className="pf-ws-template-tags">
                            {(p.tags || []).slice(0, 3).map((t) => (
                              <span key={t} className="pf-ws-mini-tag">
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="pf-ws-template-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="pf-ws-link pf-ws-link--primary"
                            onClick={() => seleccionarPlantilla(p.id)}
                          >
                            Editar
                          </button>
                          <button type="button" className="pf-ws-link" onClick={() => duplicarPlantillaPorId(p.id)}>
                            Duplicar
                          </button>
                          <button type="button" className="pf-ws-link" onClick={() => abrirModalEnviar(p.id)}>
                            Enviar
                          </button>
                          <button
                            type="button"
                            className="pf-ws-link pf-ws-link--danger"
                            onClick={() => eliminarRutinaPorId(p.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
            </div>
          </aside>

          <div className={`pf-ws-detail-col${plantilla ? ` pf-ws-day-tone-${diaActivoIdx % 6}` : ''}`}>
            {!plantilla ? (
              <div className="pf-ws-detail-empty pf-ws-block-card">
                <p className="pf-ws-detail-empty-title">Sin plantilla seleccionada</p>
                <p className="pf-muted">Elegí una de la biblioteca o creá una nueva para empezar a editar.</p>
                <button type="button" className="pf-btn pf-btn--primary" onClick={agregarPlantilla}>
                  + Nueva Plantilla
                </button>
              </div>
            ) : (
              <>
                <div className="pf-ws-block pf-ws-block-card" ref={block1Ref}>
                  <div className="pf-ws-block-head pf-ws-block-head--spread">
                    <div className="pf-ws-block-head-left">
                      <BlockStepNum tone="blue" n={1} />
                      <h3 className="pf-ws-block-title">Información básica de la plantilla</h3>
                      <span className="pf-ws-editing-pill">En edición</span>
                    </div>
                    <div className="pf-ws-block-tools">
                      <button type="button" className="pf-ws-tool-btn" title="Vista alumno" onClick={() => onToast?.({ msg: 'Vista previa del alumno próximamente.' })}>
                        👁 Vista alumno
                      </button>
                      <button type="button" className="pf-ws-tool-btn" title="Duplicar plantilla" onClick={() => duplicarPlantillaPorId(plantilla.id)}>
                        ⧉
                      </button>
                      <button
                        type="button"
                        className="pf-ws-tool-btn pf-ws-tool-btn--danger"
                        title="Eliminar plantilla"
                        onClick={() => eliminarRutinaPorId(plantilla.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="pf-ws-fields">
                    <label className="pf-ws-field">
                      <span>Nombre de la rutina / plantilla *</span>
                      <input
                        type="text"
                        value={plantilla.nombre}
                        onChange={(e) => updatePlantilla(plantilla.id, (p) => ({ ...p, nombre: e.target.value }))}
                        placeholder="Ej. Hipertrofia 4 Días - Torso / Pierna Pro"
                      />
                    </label>
                    <label className="pf-ws-field">
                      <span>¿Asignar a un alumno específico?</span>
                      <select
                        value={plantilla.soloStudentId || ''}
                        onChange={(e) =>
                          updatePlantilla(plantilla.id, (p) => ({
                            ...p,
                            soloStudentId: e.target.value || null,
                          }))
                        }
                      >
                        <option value="">No — Plantilla global</option>
                        {students.map((s) => (
                          <option key={s.studentId} value={s.studentId}>
                            {s.fullName || s.email}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="pf-ws-tags-section">
                    <span className="pf-ws-tags-label">Etiquetas rápidas</span>
                    <div className="pf-ws-tags">
                      {TAGS_RAPIDOS.map((tag) => {
                        const on = (plantilla.tags || []).includes(tag.label)
                        return (
                          <button
                            key={tag.label}
                            type="button"
                            className={`pf-ws-tag pf-ws-tag--${tag.dot}${on ? ' pf-ws-tag--on' : ''}`}
                            onClick={() => toggleTag(tag.label)}
                          >
                            <span className={`pf-ws-tag-dot pf-ws-tag-dot--${tag.dot}`} aria-hidden />
                            {tag.label}
                          </button>
                        )
                      })}
                      <button type="button" className="pf-ws-tag pf-ws-tag--add" onClick={() => onToast?.({ msg: 'Elegí una etiqueta rápida de la lista.' })}>
                        + Añadir tag
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`pf-ws-block pf-ws-block-card pf-ws-block--panel${zoneGuideClass(guiaPaso, 2, 'violet')}`} ref={block2Ref}>
                  {guiaPaso === 2 ? <WsGuideBanner tone="violet">{FLOW_STEPS[1].guide}</WsGuideBanner> : null}
                  <div className={`pf-ws-guide-body${innerGuideClass(guiaPaso, 2, 'violet')}`}>
                  <div className="pf-ws-block-head pf-ws-block-head--spread">
                    <div className="pf-ws-block-head-left">
                      <BlockStepNum tone="violet" n={2} />
                      <h3 className="pf-ws-block-title">Días de entrenamiento (Microciclos)</h3>
                    </div>
                    <button type="button" className="pf-btn pf-btn--success pf-btn--sm" onClick={agregarDia}>
                      + Agregar día
                    </button>
                  </div>

                  <div className="pf-ws-day-tabs" role="tablist" aria-label="Días de la rutina">
                    {diasPlantilla.map((d, idx) => {
                      const nEj = normalizarEjerciciosDia(d.ejercicios).length
                      return (
                        <button
                          key={d.id || idx}
                          type="button"
                          role="tab"
                          aria-selected={diaActivoIdx === idx}
                          className={`pf-ws-day-tab pf-ws-day-tab--tone-${idx % 6}${diaActivoIdx === idx ? ' pf-ws-day-tab--active' : ''}`}
                          onClick={() => setDiaActivoIdx(idx)}
                        >
                          <span className="pf-ws-day-tab-label">
                            Día {idx + 1}: {d.nombre || `Día ${idx + 1}`}
                          </span>
                          <span className="pf-ws-day-tab-count">({nEj} ej.)</span>
                        </button>
                      )
                    })}
                  </div>

                  {diaActivo ? (
                    <div className="pf-ws-day-panel">
                      <div className="pf-ws-day-bar">
                        <div>
                          <span className="pf-ws-day-kicker">
                            Día activo {diaActivoIdx + 1} de {diasPlantilla.length}
                          </span>
                          <input
                            className="pf-ws-day-name-input"
                            value={diaActivo.nombre}
                            onChange={(e) =>
                              updatePlantilla(plantilla.id, (p) => {
                                const dias = [...(p.dias || [])]
                                dias[diaActivoIdx] = { ...dias[diaActivoIdx], nombre: e.target.value }
                                return { ...p, dias }
                              })
                            }
                            placeholder={`Día ${diaActivoIdx + 1}`}
                          />
                        </div>
                        <div className="pf-ws-day-bar-actions">
                          <span className="pf-ws-day-duration">
                            Estimado {resumenDiaActivo.tiempoMin} min
                          </span>
                          <button
                            type="button"
                            className="pf-ws-icon-btn"
                            title="Duplicar día"
                            onClick={() => duplicarDia(diaActivoIdx)}
                          >
                            ⧉
                          </button>
                          {diasPlantilla.length > 1 ? (
                            <button
                              type="button"
                              className="pf-ws-icon-btn pf-ws-icon-btn--danger"
                              title="Eliminar día"
                              onClick={() => quitarDia(diaActivoIdx)}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  </div>
                </div>

                <div
                  className={`pf-ws-block pf-ws-block-card pf-ws-block--exercises${zoneGuideClass(guiaPaso, 3, 'green')}`}
                  ref={block3Ref}
                >
                  {guiaPaso === 3 ? <WsGuideBanner tone="green">{FLOW_STEPS[2].guide}</WsGuideBanner> : null}
                  <div className={`pf-ws-guide-body${innerGuideClass(guiaPaso, 3, 'green')}`}>
                  <div className="pf-ws-exercise-panel">
                  <div className="pf-ws-block-head pf-ws-block-head--spread pf-ws-block-head--titled pf-ws-block-head--in-panel">
                    <div className="pf-ws-block-head-left">
                      <BlockStepNum tone="green" n={3} />
                      <div>
                        <h3 className="pf-ws-block-title">Agregar Ejercicios al Día {diaActivoIdx + 1}</h3>
                        <p className="pf-ws-block-sub">
                          Buscá rápido o abrí el catálogo completo. También podés sumar uno personalizado al vuelo.
                        </p>
                      </div>
                    </div>
                    <p className="pf-ws-block-aside">Ver catálogo para explorar por categoría o deporte</p>
                  </div>

                  <div className="pf-ws-exercise-toolbar">
                    <div className="pf-ws-exercise-toolbar-top">
                      <div className="pf-ws-exercise-search-wrap">
                        <span className="pf-ws-search-icon" aria-hidden>
                          ⌕
                        </span>
                        <input
                          type="search"
                          className="pf-ws-exercise-search"
                          placeholder="Buscar ejercicio del catálogo (ej. Press banca…)"
                          value={qEjercicioDia}
                          onChange={(e) => onQEjercicioChange(e.target.value)}
                          onFocus={() => qEjercicioDia.trim() && setSuggestOpen(true)}
                          onBlur={() => window.setTimeout(() => setSuggestOpen(false), 120)}
                          onKeyDown={(e) => onQEjercicioKeyDown(e, diaActivoIdx)}
                          autoComplete="off"
                          role="combobox"
                          aria-expanded={suggestOpen && Boolean(qEjercicioDia.trim())}
                          aria-autocomplete="list"
                        />
                        <CatalogoEjercicioSuggest
                          open={suggestOpen}
                          query={qEjercicioDia}
                          items={sugerenciasDia}
                          highlightIdx={suggestIdx}
                          onPick={(item) => agregarDesdeSugerencia(diaActivoIdx, item)}
                          onAddCustom={(q) => agregarEjercicioManual(diaActivoIdx, q)}
                          variant="pf"
                        />
                      </div>
                      <button
                        type="button"
                        className="pf-btn pf-btn--outline pf-btn--sm pf-ws-btn-catalog"
                        onClick={() => abrirPicker(diaActivoIdx)}
                      >
                        <span className="pf-ws-btn-icon" aria-hidden>
                          ▦
                        </span>
                        Ver catálogo
                      </button>
                      <button
                        type="button"
                        className="pf-btn pf-btn--primary pf-btn--sm pf-ws-btn-custom"
                        onClick={() => agregarEjercicioManual(diaActivoIdx, qEjercicioDia || 'Ejercicio personalizado')}
                      >
                        + Personalizado
                      </button>
                    </div>

                    <p className="pf-ws-catalog-collapsed-hint mb-0">
                      Escribí para ver sugerencias del catálogo. Tocá una o usá <strong>+ Personalizado</strong> / Enter
                      para el nombre que escribiste. La biblioteca completa está en <strong>Ver catálogo</strong>.
                    </p>
                  </div>

                    <div className="pf-ws-exercise-list-head">
                      <span>
                        Lista de ejercicios cargados ({filasDiaActivo.length} en Día {diaActivoIdx + 1})
                      </span>
                      <span className="pf-ws-exercise-list-hint">
                        Arrastrá desde <strong>::</strong> para reordenar ·{' '}
                        <button type="button" className="pf-ws-link-btn" onClick={aplicarCategoriasSugeridas}>
                          Aplicar categorías sugeridas
                        </button>
                      </span>
                    </div>

                    {filasDiaActivo.length === 0 ? (
                      <div className="pf-ws-exercise-empty">
                        <p className="pf-ws-exercise-empty-title">Sin ejercicios en este día</p>
                        <p className="pf-ws-exercise-empty-text">
                          Abrí <strong>Ver catálogo</strong> para elegir ejercicios o tocá <strong>+ Personalizado</strong>.
                        </p>
                      </div>
                    ) : (
                      <ul className="pf-ws-exercise-list">
                      {filasDiaActivo.map((row, ei) => {
                        const payload = JSON.stringify({ dayIndex: diaActivoIdx, ei })
                        const grupoVal = grupoMuscularDisplay(row)
                        return (
                          <li
                            key={`${diaActivo?.id || diaActivoIdx}-ex-${ei}`}
                            className={`pf-ws-exercise-row pf-ws-exercise-row--tone-${diaActivoIdx % 6}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/x-rutina-ej', payload)
                              e.dataTransfer.setData('text/plain', payload)
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'move'
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              let data
                              try {
                                data = JSON.parse(e.dataTransfer.getData('application/x-rutina-ej') || '{}')
                              } catch {
                                return
                              }
                              if (data.dayIndex !== diaActivoIdx || typeof data.ei !== 'number') return
                              reordenarEjercicioDia(diaActivoIdx, data.ei, ei)
                            }}
                          >
                            <span className="pf-ws-drag" title="Arrastrar para reordenar" aria-hidden>
                              ::
                            </span>
                            <span className="pf-ws-exercise-index">{ei + 1}</span>
                            <div className="pf-ws-exercise-info">
                              <input
                                className="pf-ws-exercise-name"
                                value={row.nombre}
                                onChange={(e) => patchEjercicioCampo(diaActivoIdx, ei, 'nombre', e.target.value)}
                                placeholder="Nombre del ejercicio"
                                title={row.nombre || 'Nombre del ejercicio'}
                              />
                              <label className="pf-ws-exercise-comment">
                                <span className="pf-ws-exercise-comment-label">Comentario</span>
                                <input
                                  type="text"
                                  value={row.notas || ''}
                                  onChange={(e) => patchEjercicioCampo(diaActivoIdx, ei, 'notas', e.target.value)}
                                  placeholder="Técnica, ritmo, variantes…"
                                />
                              </label>
                            </div>
                            <div className="pf-ws-exercise-fields">
                              <label className="pf-ws-field-box pf-ws-field-box--muscle">
                                <span>Grupo</span>
                                <select
                                  className={`pf-ws-muscle-select pf-ws-muscle--${grupoMuscularTone(grupoVal)}`}
                                  value={grupoVal}
                                  onChange={(e) =>
                                    patchEjercicioCampo(diaActivoIdx, ei, 'grupoMuscular', e.target.value)
                                  }
                                  aria-label="Grupo muscular"
                                  title="Cambiar categoría muscular"
                                >
                                  {GRUPOS_MUSCULARES_OPCIONES.map((g) => (
                                    <option key={g} value={g}>
                                      {g.toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="pf-ws-field-box">
                                <span>Series</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={row.series}
                                  onChange={(e) => patchEjercicioCampo(diaActivoIdx, ei, 'series', e.target.value)}
                                  placeholder="4"
                                />
                              </label>
                              <label className="pf-ws-field-box">
                                <span>Rango</span>
                                <input
                                  type="text"
                                  value={row.repeticiones}
                                  onChange={(e) =>
                                    patchEjercicioCampo(diaActivoIdx, ei, 'repeticiones', e.target.value)
                                  }
                                  placeholder="6 - 8"
                                />
                              </label>
                              <label className="pf-ws-field-box">
                                <span>Descanso</span>
                                <input
                                  type="text"
                                  value={row.descansoPostRonda}
                                  onChange={(e) =>
                                    patchEjercicioCampo(diaActivoIdx, ei, 'descansoPostRonda', e.target.value)
                                  }
                                  placeholder="120s"
                                />
                              </label>
                              <label className="pf-ws-field-box">
                                <span>Carga</span>
                                <input
                                  type="text"
                                  value={row.carga}
                                  onChange={(e) => patchEjercicioCampo(diaActivoIdx, ei, 'carga', e.target.value)}
                                  placeholder="25 kg"
                                />
                              </label>
                            </div>
                            <div className="pf-ws-exercise-actions">
                              <button
                                type="button"
                                className="pf-ws-icon-btn"
                                title="Duplicar fila"
                                onClick={() => {
                                  updatePlantilla(plantilla.id, (p) => {
                                    const dias = [...p.dias]
                                    const d = { ...dias[diaActivoIdx] }
                                    const ej = [...(d.ejercicios || [])]
                                    ej.splice(ei + 1, 0, { ...row, nombre: row.nombre })
                                    d.ejercicios = ej
                                    dias[diaActivoIdx] = d
                                    return { ...p, dias }
                                  })
                                }}
                              >
                                ⧉
                              </button>
                              <button
                                type="button"
                                className="pf-ws-icon-btn pf-ws-icon-btn--danger"
                                title="Quitar ejercicio"
                                onClick={() => quitarEjercicioLinea(diaActivoIdx, ei)}
                              >
                                ×
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                    )}
                  </div>
                  </div>
                </div>

                <footer className={`pf-ws-footer${zoneGuideClass(guiaPaso, 4, 'amber')}`} ref={footerRef}>
                  {guiaPaso === 4 ? <WsGuideBanner tone="amber">{FLOW_STEPS[3].guide}</WsGuideBanner> : null}
                  <div className={`pf-ws-footer-inner${innerGuideClass(guiaPaso, 4, 'amber')}`}>
                    <div className="pf-ws-footer-summary">
                      <div className="pf-ws-footer-summary-block">
                        <span className="pf-ws-footer-summary-label">Total resumen:</span>
                        <strong className="pf-ws-footer-summary-line">
                          {metaSel.dias} {metaSel.dias === 1 ? 'Día' : 'Días'} ·
                        </strong>
                        <strong className="pf-ws-footer-summary-line pf-ws-footer-summary-line--count">
                          {metaSel.ejercicios} {metaSel.ejercicios === 1 ? 'Ejercicio' : 'Ejercicios'}
                        </strong>
                      </div>
                    </div>
                    <div className="pf-ws-footer-actions">
                      <button
                        type="button"
                        className="pf-ws-footer-btn pf-ws-footer-btn--secondary"
                        onClick={descartarCambios}
                      >
                        <span className="pf-ws-footer-btn-label pf-ws-footer-btn-label--long">Descartar cambios</span>
                        <span className="pf-ws-footer-btn-label pf-ws-footer-btn-label--short">Descartar</span>
                      </button>
                      <button
                        type="button"
                        className="pf-ws-footer-btn pf-ws-footer-btn--secondary"
                        onClick={guardarEditor}
                        disabled={!editorDirty}
                      >
                        <span className="pf-ws-footer-btn-label pf-ws-footer-btn-label--long">Guardar borrador</span>
                        <span className="pf-ws-footer-btn-label pf-ws-footer-btn-label--short">Guardar</span>
                      </button>
                      <button
                        type="button"
                        className="pf-ws-footer-btn pf-ws-footer-btn--publish"
                        onClick={publicarYAsignar}
                        disabled={metaSel.ejercicios === 0}
                      >
                        <svg className="pf-ws-footer-publish-ico" viewBox="0 0 20 20" fill="none" aria-hidden>
                          <path
                            d="M10 4.25 16.25 15.5H3.75L10 4.25Z"
                            stroke="currentColor"
                            strokeWidth="1.45"
                            strokeLinejoin="round"
                          />
                          <path d="M10 8.25v3.5" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
                          <circle cx="10" cy="13.75" r="0.75" fill="currentColor" />
                        </svg>
                        <span className="pf-ws-footer-btn-label pf-ws-footer-btn-label--long">Publicar y Asignar</span>
                        <span className="pf-ws-footer-btn-label pf-ws-footer-btn-label--short">Publicar</span>
                      </button>
                    </div>
                  </div>
                </footer>
              </>
            )}
          </div>
        </div>
      </div>

      <ProfeCatalogoPickerModal
        open={Boolean(picker)}
        dayLabel={`Día ${(picker?.dayIndex ?? diaActivoIdx) + 1}`}
        dayTone={picker?.dayIndex ?? diaActivoIdx}
        items={listCOrdenado}
        setItems={setCatalogo}
        favoritos={favoritos}
        setFavoritos={setFavoritos}
        categoriasCustom={categoriasCustom}
        setCategoriasCustom={setCategoriasCustom}
        initialQ={picker?.initialQ || ''}
        onClose={() => setPicker(null)}
        onApply={(picked) => {
          if (picker) agregarItemsCatalogoAlDia(picker.dayIndex, picked)
          setPicker(null)
        }}
        onToast={onToast}
      />

      {modalEnviar && (
        <div className="modal is-active">
          <button
            type="button"
            className="modal-background"
            aria-label="Cerrar"
            disabled={enviandoModal}
            onClick={() => !enviandoModal && setModalEnviar(null)}
          />
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <header className="modal-card-head py-3">
              <p className="modal-card-title is-size-6">Publicar y asignar plantilla</p>
              <button
                type="button"
                className="delete"
                aria-label="Cerrar"
                disabled={enviandoModal}
                onClick={() => setModalEnviar(null)}
              />
            </header>
            <section className="modal-card-body py-3">
              {!plantillaModal ? (
                <p className="is-size-7 has-text-grey mb-0">Esta plantilla ya no existe. Cerrá y elegí otra del listado.</p>
              ) : (
                <>
                  <p className="is-size-7 has-text-grey mb-3" style={{ lineHeight: 1.45 }}>
                    <strong>{plantillaModal.nombre || 'Sin nombre'}</strong>. Se guarda en la nube; cada alumno marcado la
                    abre en <strong>Rutina → Asignadas</strong>.
                  </p>
                  <div className="field mb-3">
                    <label className="label is-size-7 mb-1" htmlFor="rut-modal-envio-buscar">
                      Buscar alumno
                    </label>
                    <input
                      id="rut-modal-envio-buscar"
                      type="search"
                      className="input is-small"
                      placeholder="Nombre o correo…"
                      value={qModalEnviar}
                      onChange={(e) => setQModalEnviar(e.target.value)}
                    />
                  </div>
                  {alumnosModalFiltrados.length === 0 ? (
                    <p className="is-size-7 has-text-grey mb-0">Ningún alumno coincide con la búsqueda.</p>
                  ) : (
                    <ul
                      className="mb-0"
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        maxHeight: 'min(50vh, 320px)',
                        overflowY: 'auto',
                      }}
                    >
                      {alumnosModalFiltrados.map((s) => {
                        const on = modalEnviar.seleccion.has(s.studentId)
                        return (
                          <li key={s.linkId ?? s.studentId} className="mb-2">
                            <label className="checkbox is-size-7">
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={enviandoModal}
                                onChange={() => toggleSeleccionModal(s.studentId)}
                              />
                              {` ${etiquetaAlumnoOpcionEnvio(s)}`}
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}
            </section>
            <footer className="modal-card-foot py-3" style={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                type="button"
                className="button is-small is-light"
                disabled={enviandoModal}
                onClick={() => setModalEnviar(null)}
              >
                Cancelar
              </button>
              {plantillaModal ? (
                <button
                  type="button"
                  className="button is-small is-link"
                  disabled={enviandoModal || nSeleccionModal === 0}
                  onClick={confirmarEnviarModal}
                >
                  {enviandoModal
                    ? 'Enviando…'
                    : nSeleccionModal > 0
                      ? `Enviar a ${nSeleccionModal} alumno${nSeleccionModal === 1 ? '' : 's'}`
                      : 'Publicar y asignar'}
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
