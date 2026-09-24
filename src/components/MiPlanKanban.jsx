import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../context/AuthContext'
import { OBJETIVOS } from '../utils/consejos'
import { fechaToISO } from '../utils/calorias'
import {
  PLAN_MES1_TOTAL_DIAS,
  diaPlanMes1,
  buildActivacionPlanMes1,
  inicioISOparaDiaPlan,
  labelVariantePlan,
  metaCaloriasPlan,
  perfilListoParaGenerarPlan,
  perfilPlanListo,
  planMes1TieneInicio,
  sugerenciasCatalogoParaTexto,
  variantePlanDesdeObjetivo,
} from '../utils/planMes1'
import {
  buildActivacionPlanPropio,
  crearPlantillaPlanPropioVacia,
  crearPlanPropioDesdeGuia,
  esPlanPropio,
  labelOrigenPlan,
} from '../utils/planPropio'
import PlanPropioEditor from './PlanPropioEditor'
import {
  PLAN_SLOT_ICON,
  buildComidasDiaKanban,
  claveComidaPlan,
  clavesOpcionesSlot,
  diasDeSemanaPlan,
  distribucionMacrosTexto,
  diasConMarcasEnEstado,
  navegacionInicialPlanKanban,
  esquemaPlanActivo,
  etiquetaFechaCorta,
  fechaCalendarioDiaPlan,
  formatearHoraPlan,
  formatearKcalRango,
  formatearPesoKg,
  labelEsquemaPlan,
  resumenHidratacionPlan,
  slotsVisiblesParaEsquema,
  tipNutricionistaPlan,
  totalKcalDiaEstimado,
  estimarMacrosComida,
} from '../utils/planMes1Kanban'
import { totalesMacrosItems } from '../utils/planOpcionComida'
import { payloadSyncPlanToggle, planRefRegistro, planRefsChecksDia } from '../utils/planRegistroSync'
import {
  aplicarSnapshot,
  entradaPlanVacio,
  etiquetaOrigenPlanBiblioteca,
  newPlanNutricionId,
  nombrePlanGuiadoSistema,
  snapshotFromRuntime,
  upsertPlanEnLista,
} from '../utils/planesNutricion'
import '../pages/PlanMes1.css'

function sexoLabel(sexo) {
  if (sexo === 'hombre') return 'Hombre'
  if (sexo === 'mujer') return 'Mujer'
  return '—'
}

function IconPencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  )
}

function IconGear() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  )
}

const ESQUEMAS = [
  { id: '5', label: '5 comidas (con colación)' },
  { id: '4', label: '4 comidas' },
  { id: 'ayuno168', label: 'Ayuno 16:8' },
]

/**
 * Vista Kanban semanal de Mi plan (Comida → pestaña Mi plan).
 * @param {{ onRegistrarComida?: (payload: object) => void, onSyncPlanRegistro?: (payload: object) => void, embedded?: boolean }} props
 */
export default function MiPlanKanban({
  onRegistrarComida,
  onSyncPlanRegistro,
  embedded = true,
  abrirEditorInicial = false,
}) {
  const { user, isConfigured } = useAuth()
  const [config, setConfig, configCloudReady] = useStorage('config', {
    objetivo: 'mantener_peso',
    pesoKg: 70,
    sexo: '',
    planMes1Inicio: '',
    planMes1Variante: 'bajar_grasa',
    planMes1CincoComidas: true,
    planMes1Esquema: '5',
  })
  const [planPropio, setPlanPropio] = useStorage('planPropio', null)
  const [estado, setEstado, estadoCloudReady] = useStorage('planMes1Estado', {
    checks: {},
    omitidos: {},
    extras: {},
  })

  const [planesNutricion, setPlanesNutricion] = useStorage('planesNutricion', [])
  const [planNutricionActivoId, setPlanNutricionActivoId] = useStorage('planNutricionActivoId', '')
  const [semanaActiva, setSemanaActiva] = useState(1)
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [editDiaPlan, setEditDiaPlan] = useState(1)
  const [panelNuevoPlan, setPanelNuevoPlan] = useState(false)
  const [vistaPlanZoom, setVistaPlanZoom] = useState('2')
  const boardWrapRef = useRef(null)
  const planNavKey = planNutricionActivoId || config?.planNutricionId || ''
  const planNavAplicadoRef = useRef(null)
  const planNavMarcasRef = useRef('')
  const pendingScrollDiaRef = useRef(null)

  const scrollADiaPlan = useCallback((diaPlan) => {
    if (!diaPlan) return
    const wrap = boardWrapRef.current
    const col = wrap?.querySelector(`[data-dia-plan="${diaPlan}"]`)
    col?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [])

  const scrollParDiasPlan = useCallback(
    (diaA, diaB) => {
      const wrap = boardWrapRef.current
      if (!wrap || !diaA) return
      const colA = wrap.querySelector(`[data-dia-plan="${diaA}"]`)
      if (!colA) return
      if (vistaPlanZoom === '2' && diaB && diaB !== diaA) {
        wrap.scrollTo({ left: Math.max(0, colA.offsetLeft - 4), behavior: 'smooth' })
        return
      }
      colA.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    },
    [vistaPlanZoom],
  )

  const aplicarNavegacionInicial = useCallback(
    (inicioISO, est) => {
      if (!inicioISO) return
      const nav = navegacionInicialPlanKanban(inicioISO, est)
      setSemanaActiva(nav.semana)
      setEditDiaPlan(nav.diaEdit)
      pendingScrollDiaRef.current = nav.diaScroll
    },
    [],
  )

  const inicio = config?.planMes1Inicio || ''
  const tienePlan = planMes1TieneInicio(config)

  const syncBibliotecaEstado = useCallback(
    (est) => {
      const id = planNutricionActivoId || config?.planNutricionId
      if (!id || !planMes1TieneInicio(config)) return
      setPlanesNutricion((prev) =>
        upsertPlanEnLista(prev, snapshotFromRuntime(config, planPropio, est, id)),
      )
    },
    [config, planPropio, planNutricionActivoId, setPlanesNutricion],
  )

  const patchEstado = useCallback(
    (updater) => {
      setEstado((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        queueMicrotask(() => syncBibliotecaEstado(next))
        return next
      })
    },
    [setEstado, syncBibliotecaEstado],
  )

  const marcadosKeyMemo = useMemo(() => diasConMarcasEnEstado(estado).join(','), [estado])
  const estadoRef = useRef(estado)
  estadoRef.current = estado

  useEffect(() => {
    const dias = diasDeSemanaPlan(semanaActiva)
    setEditDiaPlan((prev) => (dias.includes(prev) ? prev : dias[0]))
  }, [semanaActiva])

  useEffect(() => {
    if (!planMes1TieneInicio(config)) return
    const inicioISO = config.planMes1Inicio
    const key = planNavKey || inicioISO
    if (!inicioISO || !key) return

    const marcadosKey = marcadosKeyMemo
    const planCambio = planNavAplicadoRef.current !== key
    const marcasRecienDisponibles = !planNavMarcasRef.current && Boolean(marcadosKey)
    const primeraVez = planNavAplicadoRef.current === null
    const storageListo = !user || !isConfigured || (configCloudReady && estadoCloudReady)
    const datosCloudRecienListos =
      storageListo
      && planNavAplicadoRef.current === key
      && !planNavMarcasRef.current
      && Boolean(marcadosKey)

    const debeNav = planCambio || primeraVez || marcasRecienDisponibles || datosCloudRecienListos

    if (!debeNav) return

    aplicarNavegacionInicial(inicioISO, estadoRef.current)
    planNavAplicadoRef.current = key
    planNavMarcasRef.current = marcadosKey
  }, [
    planNavKey,
    config?.planMes1Inicio,
    marcadosKeyMemo,
    configCloudReady,
    estadoCloudReady,
    user,
    isConfigured,
    aplicarNavegacionInicial,
  ])

  useEffect(() => {
    if (abrirEditorInicial && esPlanPropio(config)) {
      setEditorAbierto(true)
    }
  }, [abrirEditorInicial, config?.planMes1Origen])

  const contextoDiasPlan = useMemo(() => {
    if (!inicio) {
      return { diaCalendario: null, ultimoMarca: null, diaSiguiente: null, diaToca: null }
    }
    const nav = navegacionInicialPlanKanban(inicio, estado)
    const marcados = diasConMarcasEnEstado(estado)
    const ultimoMarca = marcados.length ? marcados[marcados.length - 1] : null
    const diaSiguiente =
      ultimoMarca != null
        ? Math.min(PLAN_MES1_TOTAL_DIAS, ultimoMarca + 1)
        : nav.diaCalendario
    return {
      diaCalendario: nav.diaCalendario,
      ultimoMarca,
      diaSiguiente,
      diaToca: nav.diaEdit,
      semanaSugerida: nav.semana,
      desfaseInicio: nav.desfaseInicio,
      inicioPlan: inicio,
    }
  }, [inicio, estado])

  const diasSemana = useMemo(() => diasDeSemanaPlan(semanaActiva), [semanaActiva])

  const diasAMostrar = useMemo(() => {
    const diaAncla = contextoDiasPlan.diaCalendario ?? contextoDiasPlan.diaToca ?? 1
    if (vistaPlanZoom === 'mes') {
      return Array.from({ length: PLAN_MES1_TOTAL_DIAS }, (_, i) => i + 1)
    }
    if (vistaPlanZoom === 'semana') {
      return diasSemana
    }
    if (vistaPlanZoom === '1') {
      return [diaAncla]
    }
    const sig = Math.min(PLAN_MES1_TOTAL_DIAS, diaAncla + 1)
    if (sig <= diaAncla) return [diaAncla]
    return [diaAncla, sig]
  }, [vistaPlanZoom, diasSemana, contextoDiasPlan.diaCalendario, contextoDiasPlan.diaToca])

  const parScrollDosDias = useMemo(() => {
    const t = contextoDiasPlan.diaCalendario ?? contextoDiasPlan.diaToca ?? 1
    const s = Math.min(PLAN_MES1_TOTAL_DIAS, t + 1)
    return { t, s: s > t ? s : null }
  }, [contextoDiasPlan.diaCalendario, contextoDiasPlan.diaToca])
  const listo = perfilPlanListo(config)
  const metaKcal = metaCaloriasPlan(config?.sexo)
  const esquema = esquemaPlanActivo(config)
  const objetivoLabel = OBJETIVOS.find((o) => o.value === config?.objetivo)?.label
  const metaTitulo =
    objetivoLabel
    || labelVariantePlan(config?.planMes1Variante || variantePlanDesdeObjetivo(config?.objetivo))

  useEffect(() => {
    if (!planMes1TieneInicio(config)) return
    if (planesNutricion?.length > 0) return
    const id = config?.planNutricionId || newPlanNutricionId()
    const snap = snapshotFromRuntime(config, planPropio, estado, id)
    setPlanesNutricion([snap])
    setPlanNutricionActivoId(id)
    if (!config?.planNutricionId) {
      setConfig((c) => ({ ...c, planNutricionId: id }))
    }
    // Migración única: plan existente → biblioteca
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planesNutricion?.length, config?.planMes1Inicio])

  useEffect(() => {
    if (!tienePlan || !pendingScrollDiaRef.current) return
    const dia = pendingScrollDiaRef.current
    pendingScrollDiaRef.current = null
    const t = window.setTimeout(() => scrollADiaPlan(dia), 60)
    return () => window.clearTimeout(t)
  }, [semanaActiva, diasSemana, tienePlan, scrollADiaPlan])

  useEffect(() => {
    if (!tienePlan) return
    const { t, s } = parScrollDosDias
    if (!t) return
    const diaB = vistaPlanZoom === '2' ? s : contextoDiasPlan.diaSiguiente
    const tm = window.setTimeout(() => scrollParDiasPlan(t, diaB), 120)
    return () => window.clearTimeout(tm)
  }, [
    vistaPlanZoom,
    parScrollDosDias,
    contextoDiasPlan.diaSiguiente,
    semanaActiva,
    tienePlan,
    scrollParDiasPlan,
  ])

  const listoGenerar = perfilListoParaGenerarPlan(config)
  const nombrePlanSistema = useMemo(() => nombrePlanGuiadoSistema(config), [config])

  const estadoVacio = { checks: {}, omitidos: {}, extras: {} }

  const persistirPlanActivoEnBiblioteca = () => {
    if (!planMes1TieneInicio(config)) return planesNutricion || []
    const id = planNutricionActivoId || config?.planNutricionId
    if (!id) return planesNutricion || []
    const snap = snapshotFromRuntime(config, planPropio, estado, id)
    return upsertPlanEnLista(planesNutricion, snap)
  }

  const ajustarInicioAlDia = (diaPlan) => {
    const d = Number(diaPlan)
    if (!Number.isFinite(d) || d < 1 || d > PLAN_MES1_TOTAL_DIAS) return
    const hoy = fechaToISO(new Date())
    const nuevoInicio = inicioISOparaDiaPlan(d, hoy)
    setConfig((c) => ({ ...c, planMes1Inicio: nuevoInicio }))
    const id = planNutricionActivoId || config?.planNutricionId
    if (id) {
      setPlanesNutricion((prev) => {
        const cfg = { ...config, planMes1Inicio: nuevoInicio }
        return upsertPlanEnLista(prev, snapshotFromRuntime(cfg, planPropio, estado, id))
      })
    }
    planNavAplicadoRef.current = null
    planNavMarcasRef.current = ''
  }

  const confirmarReemplazoPlan = () => {
    if (!tienePlan) return true
    return window.confirm(
      'Vas a empezar un plan nuevo (día 1 desde hoy). Se borran las marcas del tablero. ¿Continuar?'
    )
  }

  const promptNombrePlan = (sugerido) => {
    const nombre = window.prompt('Nombre del plan', sugerido)
    if (nombre === null) return null
    return nombre.trim() || sugerido
  }

  const cambiarPlanActivo = (id) => {
    if (!id || id === planNutricionActivoId) return
    const entry = (planesNutricion || []).find((p) => p.id === id)
    if (!entry) return
    const lista = persistirPlanActivoEnBiblioteca()
    setPlanesNutricion(lista)
    const { configPatch, planPropio: pp, estado: est } = aplicarSnapshot(entry)
    setConfig((c) => ({ ...c, ...configPatch }))
    setPlanPropio(pp)
    setEstado(est)
    setPlanNutricionActivoId(id)
    setEditorAbierto(entry.origen === 'propio')
    setPanelNuevoPlan(false)
    planNavAplicadoRef.current = null
    planNavMarcasRef.current = ''
  }

  const registrarPlanNuevoEnBiblioteca = (id, nombre, origen, hoy, ppData) => {
    const listaBase = persistirPlanActivoEnBiblioteca()
    const entry = entradaPlanVacio(id, nombre, origen, hoy, config, ppData, estadoVacio)
    setPlanesNutricion(upsertPlanEnLista(listaBase, entry))
    setPlanNutricionActivoId(id)
  }

  const activarPlanGuiado = () => {
    if (!listoGenerar) {
      window.alert('Completá sexo, peso y objetivo en Config para crear el plan guiado de 30 días.')
      return
    }
    if (!confirmarReemplazoPlan()) return
    const nombre = nombrePlanSistema
    const hoy = fechaToISO(new Date())
    const id = newPlanNutricionId()
    setEstado(estadoVacio)
    setPlanPropio(null)
    setConfig((c) => ({ ...c, ...buildActivacionPlanMes1(c, hoy), planNutricionId: id }))
    registrarPlanNuevoEnBiblioteca(id, nombre, 'guia', hoy, null)
    setEditorAbierto(false)
    setPanelNuevoPlan(false)
    planNavAplicadoRef.current = null
    planNavMarcasRef.current = ''
  }

  const crearPlanPropio = (desdeGuia = false) => {
    if (!listo) {
      window.alert('Completá sexo y peso en Config (o arriba en tu perfil) antes de crear el plan.')
      return
    }
    if (!confirmarReemplazoPlan()) return
    const sugerido = 'Mi plan propio'
    const nombre = promptNombrePlan(sugerido)
    if (nombre === null) return
    const hoy = fechaToISO(new Date())
    const pp = desdeGuia ? crearPlanPropioDesdeGuia() : crearPlantillaPlanPropioVacia(nombre)
    if (nombre && pp.nombre !== nombre) pp.nombre = nombre
    const id = newPlanNutricionId()
    setPlanPropio(pp)
    setEstado(estadoVacio)
    setConfig((c) => ({ ...c, ...buildActivacionPlanPropio(c, hoy), planNutricionId: id }))
    registrarPlanNuevoEnBiblioteca(id, nombre, 'propio', hoy, pp)
    setEditorAbierto(true)
    setPanelNuevoPlan(false)
    planNavAplicadoRef.current = null
    planNavMarcasRef.current = ''
  }

  const eliminarPlanBiblioteca = () => {
    const lista = persistirPlanActivoEnBiblioteca()
    const activoId = planNutricionActivoId || config?.planNutricionId
    const entry = lista.find((p) => p.id === activoId)
    if (!entry) return
    if (
      !window.confirm(
        `¿Eliminar "${entry.nombre}"?\n\nSe borra de tu lista. Las marcas de ese plan no se recuperan.`,
      )
    ) {
      return
    }
    const nextList = lista.filter((p) => p.id !== activoId)
    setPlanesNutricion(nextList)
    if (nextList.length === 0) {
      setConfig((c) => ({
        ...c,
        planMes1Inicio: '',
        planNutricionId: '',
        planMes1Origen: 'guia',
      }))
      setPlanPropio(null)
      setEstado(estadoVacio)
      setPlanNutricionActivoId('')
      setEditorAbierto(false)
      setPanelNuevoPlan(false)
      return
    }
    const otro = nextList[0]
    const { configPatch, planPropio: pp, estado: est } = aplicarSnapshot(otro)
    setConfig((c) => ({ ...c, ...configPatch }))
    setPlanPropio(pp)
    setEstado(est)
    setPlanNutricionActivoId(otro.id)
    setEditorAbierto(otro.origen === 'propio')
    planNavAplicadoRef.current = null
    planNavMarcasRef.current = ''
  }

  const bloquePlanSistema = () => (
    <div className="plan-kanban-create-section">
      <p className="plan-kanban-create-section-kicker mb-0">Plan del sistema</p>
      <p className="plan-kanban-create-sys-name mb-0">{nombrePlanSistema}</p>
      <p className="plan-kanban-create-bar-sub mb-0">
        Menú de 30 días según tu objetivo y perfil en Config.
      </p>
      <button
        type="button"
        className="plan-kanban-create-btn plan-kanban-create-btn--primary plan-kanban-create-btn--wide"
        onClick={activarPlanGuiado}
        disabled={!listoGenerar}
        title={
          listoGenerar
            ? 'Usar este menú guiado'
            : 'Completá sexo, peso y objetivo en Config'
        }
      >
        Usar plan del sistema
      </button>
    </div>
  )

  const bloqueCrearPlanPropio = () => (
    <div className="plan-kanban-create-section plan-kanban-create-section--propio">
      <p className="plan-kanban-create-section-kicker mb-0">Tu menú</p>
      <p className="plan-kanban-create-bar-sub mb-0">
        Armá comidas a tu gusto (dos opciones por comida). Podés empezar vacío o copiar el menú sugerido.
      </p>
      <div className="plan-kanban-create-row plan-kanban-create-row--tight">
        <button
          type="button"
          className="plan-kanban-create-btn plan-kanban-create-btn--propio"
          onClick={() => crearPlanPropio(false)}
          disabled={!listo}
        >
          + Crear plan
        </button>
        <button
          type="button"
          className="plan-kanban-create-btn plan-kanban-create-btn--soft"
          onClick={() => crearPlanPropio(true)}
          disabled={!listo}
        >
          Crear plan desde menú sugerido
        </button>
      </div>
    </div>
  )

  const filasCrearPlan = () => (
    <>
      {bloquePlanSistema()}
      {bloqueCrearPlanPropio()}
      <Link to="/config#plan-desde-objetivo" className="plan-kanban-create-link">
        Más opciones en Config
      </Link>
    </>
  )

  const selectorPlanActivo = () => {
    const lista = planesNutricion?.length
      ? planesNutricion
      : planNutricionActivoId || config?.planNutricionId
        ? [
            snapshotFromRuntime(
              config,
              planPropio,
              estado,
              planNutricionActivoId || config?.planNutricionId,
            ),
          ]
        : []
    const activoId = planNutricionActivoId || config?.planNutricionId || lista[0]?.id || ''
    const puedeEliminar = lista.length > 0

    return (
      <div className="plan-kanban-plan-bar">
        <div className="plan-kanban-activa">
          <span className="plan-kanban-activa-label" id="plan-nutricion-activo-label">
            Plan activo:
          </span>
          <div className="plan-kanban-activa-select">
            <select
              id="plan-nutricion-activo-select"
              aria-labelledby="plan-nutricion-activo-label"
              value={activoId}
              onChange={(e) => cambiarPlanActivo(e.target.value)}
              disabled={lista.length <= 1}
            >
              {lista.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {etiquetaOrigenPlanBiblioteca(p)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          className="plan-kanban-btn-eliminar"
          disabled={!puedeEliminar}
          onClick={eliminarPlanBiblioteca}
          title="Eliminar plan de la lista"
          aria-label="Eliminar plan"
        >
          <IconTrash />
          <span className="plan-kanban-btn-eliminar-label">Eliminar</span>
        </button>
        <button
          type="button"
          className="plan-kanban-btn-nuevo"
          onClick={() => setPanelNuevoPlan((v) => !v)}
        >
          {panelNuevoPlan ? 'Cerrar' : '+ Agregar plan'}
        </button>
      </div>
    )
  }

  const accionesCrearPlan = (modo = 'empty') => (
    <div
      id="plan-crear-nuevo"
      className={modo === 'bar' ? 'plan-kanban-create-bar' : 'plan-kanban-create-block'}
    >
      {modo === 'bar' ? (
        <>
          {selectorPlanActivo()}
          {panelNuevoPlan ? (
            <>
              <p className="plan-kanban-create-bar-sub mb-0">
                Agregá otro plan o cambiá de menú. Al crear uno nuevo, el tablero empieza de cero desde hoy.
              </p>
              {filasCrearPlan()}
            </>
          ) : null}
        </>
      ) : (
        filasCrearPlan()
      )}
    </div>
  )

  const setEsquema = (id) => {
    setConfig((c) => ({
      ...c,
      planMes1Esquema: id,
      planMes1CincoComidas: id === '5',
    }))
  }

  const isChecked = (diaPlan, slotId, extraId = null, opcionIndex = null) =>
    Boolean(estado?.checks?.[claveComidaPlan(diaPlan, slotId, extraId, opcionIndex)])

  const slotTieneAlgunaOpcionHecha = (diaPlan, slot) =>
    (slot.opciones || []).some((_, i) => isChecked(diaPlan, slot.id, null, i))

  const isOmitido = (diaPlan, slotId) =>
    Boolean(estado?.omitidos?.[claveComidaPlan(diaPlan, slotId)])

  const emitSyncPlan = (payload) => {
    if (onSyncPlanRegistro && inicio) onSyncPlanRegistro(payload)
  }

  const handleToggleOpcion = (diaPlan, slotOrExtra, opIdx = null, extraIdLegacy = null) => {
    const isExtra = slotOrExtra?.isExtra || (typeof slotOrExtra === 'string' && slotOrExtra === 'extra')
    let slot = null
    let extra = null
    let opIndex = opIdx

    if (isExtra) {
      extra = typeof slotOrExtra === 'object' && slotOrExtra.id ? slotOrExtra : null
      if (!extra && extraIdLegacy) {
        extra = (estado?.extras?.[diaPlan] || []).find((e) => e.id === extraIdLegacy)
      }
    } else {
      slot = slotOrExtra
    }

    const key = extra
      ? claveComidaPlan(diaPlan, 'extra', extra.id)
      : claveComidaPlan(diaPlan, slot.id, null, opIndex)

    const willCheck = !estado?.checks?.[key]

    patchEstado((prev) => ({
      ...prev,
      checks: {
        ...(prev?.checks || {}),
        [key]: willCheck,
      },
    }))

    if (!inicio) return

    const syncPayload = extra
      ? payloadSyncPlanToggle({
          diaPlan,
          inicioISO: inicio,
          config,
          extra,
          checked: willCheck,
        })
      : payloadSyncPlanToggle({
          diaPlan,
          inicioISO: inicio,
          config,
          slot,
          opIdx: opIndex,
          checked: willCheck,
        })

    emitSyncPlan(syncPayload)
  }

  const clavesChecksDia = (diaPlan, slots, extrasDia) => {
    const keys = []
    for (const slot of slots) {
      for (let i = 0; i < (slot.opciones || []).length; i += 1) {
        keys.push(claveComidaPlan(diaPlan, slot.id, null, i))
      }
    }
    for (const ex of extrasDia) {
      keys.push(claveComidaPlan(diaPlan, 'extra', ex.id))
    }
    return keys
  }

  const diaTieneAlgunaMarca = (diaPlan, slots, extrasDia) =>
    clavesChecksDia(diaPlan, slots, extrasDia).some((k) => estado?.checks?.[k])

  /** @returns {number[] | null} índices 0/1 o ambos; null si canceló */
  const preguntarOpcionesMarcarTodo = () => {
    const msg =
      '¿Qué opción querés marcar en todas las comidas del día?\n\n'
      + '1 — Solo Opción 1\n'
      + '2 — Solo Opción 2\n'
      + '3 — Ambas opciones\n\n'
      + 'Escribí 1, 2 o 3'
    const r = window.prompt(msg, '1')
    if (r === null) return null
    const n = String(r).trim()
    if (n === '1') return [0]
    if (n === '2') return [1]
    if (n === '3') return [0, 1]
    window.alert('Respuesta no válida. Usá 1, 2 o 3.')
    return preguntarOpcionesMarcarTodo()
  }

  const handleDesmarcarTodoElDia = (diaPlan, slots, extrasDia) => {
    if (!window.confirm('¿Desmarcar todas las comidas de este día?')) return
    patchEstado((prev) => {
      const checks = { ...(prev?.checks || {}) }
      for (const k of clavesChecksDia(diaPlan, slots, extrasDia)) {
        delete checks[k]
      }
      return { ...prev, checks }
    })
    emitSyncPlan({ type: 'removeMany', planRefs: planRefsChecksDia(diaPlan, slots, extrasDia) })
  }

  const handleMarcarTodoElDia = (diaPlan, slots, extrasDia) => {
    const indices = preguntarOpcionesMarcarTodo()
    if (!indices) return
    patchEstado((prev) => {
      const checks = { ...(prev?.checks || {}) }
      for (const slot of slots) {
        const nOp = (slot.opciones || []).length
        for (let i = 0; i < nOp; i += 1) {
          checks[claveComidaPlan(diaPlan, slot.id, null, i)] = indices.includes(i)
        }
      }
      for (const ex of extrasDia) {
        checks[claveComidaPlan(diaPlan, 'extra', ex.id)] = true
      }
      return { ...prev, checks }
    })

    if (!inicio) return
    const ops = []
    for (const slot of slots) {
      const nOp = (slot.opciones || []).length
      for (let i = 0; i < nOp; i += 1) {
        ops.push(
          payloadSyncPlanToggle({
            diaPlan,
            inicioISO: inicio,
            config,
            slot,
            opIdx: i,
            checked: indices.includes(i),
          }),
        )
      }
    }
    for (const ex of extrasDia) {
      ops.push(
        payloadSyncPlanToggle({
          diaPlan,
          inicioISO: inicio,
          config,
          extra: ex,
          checked: true,
        }),
      )
    }
    emitSyncPlan({ type: 'batch', ops })
  }

  const handleToggleMarcarTodoDia = (diaPlan, slots, extrasDia, diaCompleto) => {
    const hayMarcas = diaTieneAlgunaMarca(diaPlan, slots, extrasDia)
    if (diaCompleto || hayMarcas) {
      handleDesmarcarTodoElDia(diaPlan, slots, extrasDia)
      return
    }
    handleMarcarTodoElDia(diaPlan, slots, extrasDia)
  }

  const handleEliminarComida = (diaPlan, slot, label) => {
    if (!window.confirm(`¿Quitar "${label}" del día ${diaPlan} del plan?`)) return
    const key = claveComidaPlan(diaPlan, slot.id)
    patchEstado((prev) => {
      const checks = { ...(prev?.checks || {}) }
      for (const k of clavesOpcionesSlot(diaPlan, slot.id, slot.opciones)) {
        delete checks[k]
      }
      return {
        ...prev,
        omitidos: { ...(prev?.omitidos || {}), [key]: true },
        checks,
      }
    })
    const refs = (slot.opciones || []).map((_, i) => planRefRegistro(diaPlan, slot.id, null, i))
    emitSyncPlan({ type: 'removeMany', planRefs: refs })
  }

  const handleEliminarExtra = (diaPlan, extraId, label) => {
    if (!window.confirm(`¿Eliminar "${label}"?`)) return
    patchEstado((prev) => {
      const extrasDia = (prev?.extras?.[diaPlan] || []).filter((e) => e.id !== extraId)
      const checks = { ...(prev?.checks || {}) }
      delete checks[claveComidaPlan(diaPlan, 'extra', extraId)]
      return {
        ...prev,
        extras: { ...(prev?.extras || {}), [diaPlan]: extrasDia },
        checks,
      }
    })
    emitSyncPlan({ type: 'remove', planRef: planRefRegistro(diaPlan, 'extra', extraId, null) })
  }

  const handleAnadirColacion = (diaPlan) => {
    const id = `ex_${Date.now()}`
    patchEstado((prev) => ({
      ...prev,
      extras: {
        ...(prev?.extras || {}),
        [diaPlan]: [
          ...(prev?.extras?.[diaPlan] || []),
          {
            id,
            label: 'Colación extra',
            texto: 'Fruta + puñado de frutos secos o yogur descremado',
            horaRef: '16:00',
          },
        ],
      },
    }))
  }

  const handleEditarEnRegistroHoy = (diaPlan, slot, texto, opcionLabel, opIdx = 0) => {
    const key = claveComidaPlan(diaPlan, slot.id, null, opIdx)
    if (!isChecked(diaPlan, slot.id, null, opIdx)) {
      patchEstado((prev) => ({
        ...prev,
        checks: { ...(prev?.checks || {}), [key]: true },
      }))
    }

    if (onSyncPlanRegistro && inicio) {
      const built = payloadSyncPlanToggle({
        diaPlan,
        inicioISO: inicio,
        config,
        slot,
        opIdx,
        checked: true,
      })
      onSyncPlanRegistro({ ...built, abrirEdicion: true })
      return
    }

    const fecha = fechaCalendarioDiaPlan(inicio, diaPlan)
    const payload = {
      momento: slot.momentoComida || slot.label,
      notas: `Tu plan · Día ${diaPlan} · ${slot.label}${opcionLabel ? ` · ${opcionLabel}` : ''}`,
      sugerencias: sugerenciasCatalogoParaTexto(texto),
      textoPlan: texto,
      fecha,
      origenPlan: true,
    }
    if (onRegistrarComida) onRegistrarComida(payload)
  }

  const handleEditarExtraEnRegistro = (diaPlan, extra, texto) => {
    const key = claveComidaPlan(diaPlan, 'extra', extra.id)
    if (!isChecked(diaPlan, 'extra', extra.id)) {
      patchEstado((prev) => ({
        ...prev,
        checks: { ...(prev?.checks || {}), [key]: true },
      }))
    }

    if (onSyncPlanRegistro && inicio) {
      const built = payloadSyncPlanToggle({
        diaPlan,
        inicioISO: inicio,
        config,
        extra,
        checked: true,
      })
      onSyncPlanRegistro({ ...built, abrirEdicion: true })
      return
    }

    const fecha = fechaCalendarioDiaPlan(inicio, diaPlan)
    const payload = {
      momento: 'Snack',
      notas: `Tu plan · Día ${diaPlan} · ${extra.label}`,
      sugerencias: sugerenciasCatalogoParaTexto(texto),
      textoPlan: texto,
      fecha,
      origenPlan: true,
    }
    if (onRegistrarComida) onRegistrarComida(payload)
  }

  if (!tienePlan) {
    return (
      <div className="plan-m1-embedded-empty">
        <h2 className="plan-m1-section-title">Mi plan</h2>
        <p className="plan-m1-sub mb-3">
          Abajo ves el nombre exacto del <strong>plan del sistema</strong> o usá <strong>+ Crear plan</strong> para
          armar el tuyo.
        </p>
        {accionesCrearPlan('empty')}
        {!listoGenerar && listo && (
          <p className="plan-kanban-create-hint mb-0 mt-2">
            Para el plan guiado falta elegir <Link to="/config">objetivo en Config</Link>.
          </p>
        )}
      </div>
    )
  }

  const hidratacion = resumenHidratacionPlan(config)

  const etiquetaVistaZoom =
    vistaPlanZoom === '1'
      ? '1 día'
      : vistaPlanZoom === '2'
        ? '2 días'
        : vistaPlanZoom === 'semana'
          ? 'Semana'
          : 'Mes'

  const toolbarInicioYZoom = (
    <div className="plan-kanban-toolbar-row plan-kanban-toolbar-row--inicio">
      <label className="plan-kanban-inicio-dia">
        <span className="plan-kanban-inicio-dia-label">Hoy</span>
        <select
          value={contextoDiasPlan.diaCalendario ?? 1}
          onChange={(e) => ajustarInicioAlDia(Number(e.target.value))}
          aria-label="Qué día del plan corresponde a hoy"
        >
          {Array.from({ length: PLAN_MES1_TOTAL_DIAS }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              Día {d}
            </option>
          ))}
        </select>
      </label>
      <div className="plan-kanban-zoom" role="group" aria-label="Vista del tablero">
        {[
          { id: '1', label: '1' },
          { id: '2', label: '2' },
          { id: 'semana', label: 'Sem.' },
          { id: 'mes', label: 'Mes' },
        ].map((z) => (
          <button
            key={z.id}
            type="button"
            className={`plan-kanban-zoom-btn${vistaPlanZoom === z.id ? ' is-active' : ''}`}
            onClick={() => setVistaPlanZoom(z.id)}
            title={
              z.id === '1'
                ? 'Un día'
                : z.id === '2'
                  ? 'Dos días'
                  : z.id === 'semana'
                    ? 'Semana'
                    : 'Mes completo'
            }
          >
            {z.label}
          </button>
        ))}
      </div>
    </div>
  )

  const bloqueEsquemaYEditor = (
    <>
      <div className="plan-kanban-esquema" role="group" aria-label="Esquema de comidas">
        {ESQUEMAS.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`plan-kanban-esquema-btn${esquema === e.id ? ' is-active' : ''}`}
            onClick={() => setEsquema(e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>
      {(vistaPlanZoom === 'semana' || vistaPlanZoom === 'mes') && (
        <div className="plan-kanban-semanas" role="tablist" aria-label="Semanas del plan">
          {[1, 2, 3, 4].map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={semanaActiva === s}
              className={`plan-kanban-semana-btn${semanaActiva === s ? ' is-active' : ''}`}
              onClick={() => setSemanaActiva(s)}
            >
              Semana {s}
            </button>
          ))}
        </div>
      )}
      {esPlanPropio(config) && (
        <div className="plan-kanban-propio-tools">
          <label className="plan-kanban-edit-day">
            <span>Día a editar</span>
            <select
              value={editDiaPlan}
              onChange={(e) => setEditDiaPlan(Number(e.target.value))}
            >
              {diasSemana.map((d) => (
                <option key={d} value={d}>
                  Día {d}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`plan-kanban-esquema-btn${editorAbierto ? ' is-active' : ''}`}
            onClick={() => setEditorAbierto((v) => !v)}
          >
            {editorAbierto ? 'Ocultar editor' : 'Editar menú'}
          </button>
        </div>
      )}
    </>
  )

  return (
    <div className={`plan-kanban${embedded ? ' plan-kanban--embedded' : ''}`}>
      {embedded ? (
        <>
          <details className="plan-kanban-compact-fold">
            <summary>
              <span className="plan-kanban-compact-fold-title">
                {esPlanPropio(config) ? planPropio?.nombre || 'Mi plan' : metaTitulo}
              </span>
              <span className="plan-kanban-compact-fold-meta">
                D{contextoDiasPlan.diaCalendario ?? '—'} · {etiquetaVistaZoom}
              </span>
            </summary>
            <div className="plan-kanban-compact-fold-body">
              <div className="plan-kanban-meta-actions plan-kanban-meta-actions--fold">
                <Link to="/config#plan-desde-objetivo" className="plan-kanban-config-btn">
                  <IconGear />
                  Config
                </Link>
              </div>
              {accionesCrearPlan('bar')}
              {contextoDiasPlan.desfaseInicio && contextoDiasPlan.ultimoMarca != null && (
                <div className="plan-kanban-desfase-alert plan-kanban-desfase-alert--compact" role="alert">
                  <p className="mb-2">
                    Marcas hasta <strong>Día {contextoDiasPlan.ultimoMarca}</strong>, calendario en{' '}
                    <strong>Día {contextoDiasPlan.diaCalendario}</strong>.
                  </p>
                  <button
                    type="button"
                    className="plan-kanban-create-btn plan-kanban-create-btn--primary plan-kanban-create-btn--wide"
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Ajustar para que HOY sea el Día ${contextoDiasPlan.ultimoMarca}?`,
                        )
                      ) {
                        ajustarInicioAlDia(contextoDiasPlan.ultimoMarca)
                      }
                    }}
                  >
                    Corregir a Día {contextoDiasPlan.ultimoMarca}
                  </button>
                </div>
              )}
              <details className="plan-kanban-meta-details">
                <summary>Perfil y metas</summary>
                <div className="plan-kanban-sync-grid">
                  <div className="plan-kanban-sync-card plan-kanban-sync-card--perfil">
                    <span className="plan-kanban-sync-label">Perfil</span>
                    <strong>
                      {sexoLabel(config.sexo)} · {formatearPesoKg(config.pesoKg)}
                    </strong>
                  </div>
                  <div className="plan-kanban-sync-card plan-kanban-sync-card--kcal">
                    <span className="plan-kanban-sync-label">Calorías</span>
                    <strong>{formatearKcalRango(metaKcal.min, metaKcal.max)}</strong>
                  </div>
                </div>
              </details>
            </div>
          </details>
          <div className="plan-kanban-toolbar plan-kanban-toolbar--compact">
            {toolbarInicioYZoom}
            <details className="plan-kanban-compact-fold plan-kanban-compact-fold--inline">
              <summary>Esquema y editor</summary>
              <div className="plan-kanban-compact-fold-body">{bloqueEsquemaYEditor}</div>
            </details>
          </div>
        </>
      ) : (
      <>
      <header className="plan-kanban-meta">
        <div className="plan-kanban-meta-top">
          <div>
            <p className="plan-kanban-kicker">Meta sincronizada</p>
            <p className="plan-kanban-meta-obj mb-0">
              {esPlanPropio(config) ? planPropio?.nombre || 'Mi plan propio' : metaTitulo}
            </p>
            <span className={`plan-kanban-origen-badge${esPlanPropio(config) ? ' is-propio' : ''}`}>
              {labelOrigenPlan(config)}
            </span>
          </div>
          <div className="plan-kanban-meta-actions">
            <Link to="/config#plan-desde-objetivo" className="plan-kanban-config-btn">
              <IconGear />
              Config
            </Link>
          </div>
        </div>

        {accionesCrearPlan('bar')}

        {contextoDiasPlan.desfaseInicio && contextoDiasPlan.ultimoMarca != null && (
          <div className="plan-kanban-desfase-alert" role="alert">
            <p className="mb-2">
              Tenés marcas hasta el <strong>Día {contextoDiasPlan.ultimoMarca}</strong>, pero la fecha de inicio (
              {contextoDiasPlan.inicioPlan}) hace que hoy sea solo el{' '}
              <strong>Día {contextoDiasPlan.diaCalendario}</strong>. Por eso el registro diario puede no coincidir.
            </p>
            <button
              type="button"
              className="plan-kanban-create-btn plan-kanban-create-btn--primary plan-kanban-create-btn--wide"
              onClick={() => {
                if (
                  window.confirm(
                    `¿Ajustar el plan para que HOY sea el Día ${contextoDiasPlan.ultimoMarca}? (No borra tus marcas del tablero)`,
                  )
                ) {
                  ajustarInicioAlDia(contextoDiasPlan.ultimoMarca)
                }
              }}
            >
              Corregir: hoy es Día {contextoDiasPlan.ultimoMarca}
            </button>
          </div>
        )}

        {(contextoDiasPlan.diaCalendario != null
          || contextoDiasPlan.ultimoMarca != null
          || contextoDiasPlan.diaToca != null) && (
          <div className="plan-kanban-nav-banner" role="status">
            {contextoDiasPlan.diaToca != null && (
              <span className="plan-kanban-nav-chip plan-kanban-nav-chip--hoy">
                Te toca: <strong>Día {contextoDiasPlan.diaToca}</strong>
                {contextoDiasPlan.semanaSugerida != null
                  ? ` · Semana ${contextoDiasPlan.semanaSugerida}`
                  : ''}
              </span>
            )}
            {contextoDiasPlan.ultimoMarca != null && (
              <span className="plan-kanban-nav-chip plan-kanban-nav-chip--ultimo">
                Última marca: <strong>Día {contextoDiasPlan.ultimoMarca}</strong>
              </span>
            )}
            {contextoDiasPlan.diaSiguiente != null
              && contextoDiasPlan.ultimoMarca != null
              && contextoDiasPlan.diaSiguiente !== contextoDiasPlan.ultimoMarca && (
              <span className="plan-kanban-nav-chip plan-kanban-nav-chip--siguiente">
                Siguiente: <strong>Día {contextoDiasPlan.diaSiguiente}</strong>
              </span>
            )}
            {contextoDiasPlan.diaCalendario == null && contextoDiasPlan.ultimoMarca == null && (
              <span className="plan-kanban-nav-chip">Empezá por el Día 1 del tablero.</span>
            )}
          </div>
        )}

        <div className="plan-kanban-sync-grid">
            <div className="plan-kanban-sync-card plan-kanban-sync-card--perfil">
              <span className="plan-kanban-sync-label">Perfil biométrico</span>
              <strong>
                {sexoLabel(config.sexo)} · {formatearPesoKg(config.pesoKg)}
              </strong>
            </div>
            <div className="plan-kanban-sync-card plan-kanban-sync-card--kcal">
              <span className="plan-kanban-sync-label">Ingesta calórica diaria</span>
              <strong>{formatearKcalRango(metaKcal.min, metaKcal.max)}</strong>
            </div>
            <div className="plan-kanban-sync-card plan-kanban-sync-card--macros">
              <span className="plan-kanban-sync-label">Distribución objetivo</span>
              <strong>{distribucionMacrosTexto(config)}</strong>
            </div>
            <div className="plan-kanban-sync-card plan-kanban-sync-card--agua">
              <span className="plan-kanban-sync-label">Hidratación base</span>
              <strong>{hidratacion.texto}</strong>
            </div>
          </div>
      </header>

      <div className="plan-kanban-toolbar">
        {toolbarInicioYZoom}
        {bloqueEsquemaYEditor}
        {vistaPlanZoom !== '1' && vistaPlanZoom !== '2' && contextoDiasPlan.diaCalendario != null && (
          <p className="plan-kanban-nav-hint mb-0 plan-kanban-nav-hint--compact">
            Calendario: <strong>Día {contextoDiasPlan.diaCalendario}</strong>
            {semanaActiva !== contextoDiasPlan.semanaSugerida && contextoDiasPlan.semanaSugerida ? (
              <>
                {' '}
                ·{' '}
                <button
                  type="button"
                  className="plan-kanban-nav-jump"
                  onClick={() => setSemanaActiva(contextoDiasPlan.semanaSugerida)}
                >
                  Semana {contextoDiasPlan.semanaSugerida}
                </button>
              </>
            ) : null}
          </p>
        )}
      </div>
      </>
      )}

      {!listo && (
        <div className="plan-m1-alert plan-kanban-alert">
          <p className="mb-0">
            Completá sexo y peso en <Link to="/config">Config</Link> para afinar porciones y agua.
          </p>
        </div>
      )}

      {editorAbierto && esPlanPropio(config) && planPropio && (
        <PlanPropioEditor
          diaPlan={editDiaPlan}
          planPropio={planPropio}
          setPlanPropio={setPlanPropio}
          semanaActiva={semanaActiva}
          onCerrar={() => setEditorAbierto(false)}
        />
      )}

      <div className="plan-kanban-board-wrap" ref={boardWrapRef}>
        <div className={`plan-kanban-board plan-kanban-board--zoom-${vistaPlanZoom}`}>
          {diasAMostrar.map((diaPlan) => {
            const built = buildComidasDiaKanban(diaPlan, config, planPropio)
            if (!built) return null
            const fecha = fechaCalendarioDiaPlan(inicio, diaPlan)
            const extras = (estado?.extras?.[diaPlan] || []).map((ex) => ({
              ...ex,
              isExtra: true,
            }))
            const slotsBase = built.comidas.filter((c) => !isOmitido(diaPlan, c.id))
            const extrasList = estado?.extras?.[diaPlan] || []
            const hayMarcasDia = diaTieneAlgunaMarca(diaPlan, slotsBase, extrasList)
            const slotHecho = (slot) => slotTieneAlgunaOpcionHecha(diaPlan, slot)
            const extraHecho = (ex) => isChecked(diaPlan, 'extra', ex.id)
            const diaCompleto =
              slotsBase.every(slotHecho)
              && (extrasList.length === 0 || extrasList.every(extraHecho))
              && slotsBase.length > 0
            const kcalDia =
              totalKcalDiaEstimado(slotsVisiblesParaEsquema(esquema), config)
              + extrasList.length * estimarMacrosComida('media_manana', config).kcal

            return (
              <article
                key={diaPlan}
                data-dia-plan={diaPlan}
                className={`plan-kanban-col${diaCompleto ? ' is-day-done' : ''}${
                  contextoDiasPlan.diaCalendario === diaPlan ? ' is-plan-hoy' : ''
                }${contextoDiasPlan.ultimoMarca === diaPlan ? ' is-plan-ultimo' : ''}${
                  contextoDiasPlan.diaSiguiente === diaPlan ? ' is-plan-siguiente' : ''
                }`}
              >
                <header className="plan-kanban-col-head">
                  <div>
                    <h3 className="plan-kanban-col-title">
                      Día {diaPlan}
                      {contextoDiasPlan.diaCalendario === diaPlan ? (
                        <span className="plan-kanban-col-tag">Hoy</span>
                      ) : null}
                    </h3>
                    <p className="plan-kanban-col-date mb-0">
                      {etiquetaFechaCorta(fecha)}
                      <span className="plan-kanban-col-kcal">{Math.round(kcalDia).toLocaleString('es-AR')} kcal</span>
                    </p>
                  </div>
                  <div className="plan-kanban-col-actions">
                    {diaCompleto ? (
                      <span className="plan-kanban-day-badge">✓ Día completado</span>
                    ) : null}
                    <button
                      type="button"
                      className={`plan-kanban-mark-all${diaCompleto || hayMarcasDia ? ' is-unmark' : ''}`}
                      onClick={() =>
                        handleToggleMarcarTodoDia(diaPlan, slotsBase, extrasList, diaCompleto)
                      }
                    >
                      {diaCompleto || hayMarcasDia ? '↩ Desmarcar todo' : '✓ Marcar todo'}
                    </button>
                  </div>
                </header>

                {diaCompleto && (
                  <p className="plan-kanban-day-done-msg">
                    Objetivo diario alcanzado: todas las comidas registradas.
                  </p>
                )}

                {built.detalle.tip && (
                  <div className="plan-kanban-day-tip">
                    <p className="mb-0">{built.detalle.tip}</p>
                  </div>
                )}

                <div className="plan-kanban-meals">
                  {slotsBase.map((slot) => {
                    const icon = PLAN_SLOT_ICON[slot.id] || '🍽️'
                    const hora = formatearHoraPlan(slot.horaRef || '10:30')
                    const algunaHecha = slotTieneAlgunaOpcionHecha(diaPlan, slot)
                    const opciones = slot.opciones?.length
                      ? slot.opciones
                      : [{ id: 'op1', label: 'Opción 1', texto: slot.label }]

                    return (
                      <div
                        key={slot.id}
                        className={`plan-kanban-meal plan-kanban-meal--${slot.id}${algunaHecha ? ' is-slot-started' : ''}`}
                      >
                        <div className="plan-kanban-meal-head plan-kanban-meal-head--slot">
                          <span className="plan-kanban-meal-moment">
                            {icon} {slot.label}{' '}
                            <time>{hora}</time>
                          </span>
                          <button
                            type="button"
                            className="plan-kanban-icon-btn plan-kanban-icon-btn--danger"
                            aria-label={`Quitar ${slot.label} del día`}
                            title="Quitar comida del día"
                            onClick={() => handleEliminarComida(diaPlan, slot, slot.label)}
                          >
                            <IconTrash />
                          </button>
                        </div>

                        <div className="plan-kanban-options">
                          {opciones.map((op, opIdx) => {
                            const checked = isChecked(diaPlan, slot.id, null, opIdx)
                            const macros = op.items?.length
                              ? totalesMacrosItems(op.items)
                              : estimarMacrosComida(slot.id, config)
                            return (
                              <div
                                key={op.id || `op${opIdx}`}
                                className={`plan-kanban-option${checked ? ' is-picked' : ''}`}
                              >
                                <div className="plan-kanban-option-head">
                                  <label className="plan-kanban-meal-check">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => handleToggleOpcion(diaPlan, slot, opIdx)}
                                    />
                                    <span className="plan-kanban-option-label">{op.label}</span>
                                  </label>
                                  <button
                                    type="button"
                                    className="plan-kanban-icon-btn"
                                    aria-label={`Editar ${op.label} en registro de hoy`}
                                    title="Editar en Registro de hoy"
                                    onClick={() =>
                                      handleEditarEnRegistroHoy(diaPlan, slot, op.texto, op.label, opIdx)
                                    }
                                  >
                                    <IconPencil />
                                  </button>
                                </div>
                                <p className={`plan-kanban-meal-text${checked ? ' is-struck' : ''}`}>
                                  {op.texto}
                                </p>
                                <div className="plan-kanban-macros">
                                  <span className="plan-kanban-pill plan-kanban-pill--kcal">{Math.round(macros.kcal)} kcal</span>
                                  <span className="plan-kanban-pill plan-kanban-pill--p">P {macros.p}g</span>
                                  <span className="plan-kanban-pill plan-kanban-pill--c">C {macros.h}g</span>
                                  <span className="plan-kanban-pill plan-kanban-pill--g">G {macros.g}g</span>
                                </div>
                                {checked && (
                                  <p className="plan-kanban-meal-done-foot mb-0">
                                    <span>✓ {op.label} completada</span>
                                    <span className="plan-kanban-listo">Listo</span>
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {extras.map((slot) => {
                    const label = slot.label
                    const texto = slot.texto
                    const hora = formatearHoraPlan(slot.horaRef || '10:30')
                    const macros = estimarMacrosComida('media_manana', config)
                    const checked = isChecked(diaPlan, 'extra', slot.id)

                    return (
                      <div
                        key={slot.id}
                        className={`plan-kanban-meal plan-kanban-meal--extra plan-kanban-meal--colacion-extra${checked ? ' is-slot-started' : ''}`}
                      >
                        <div className={`plan-kanban-option plan-kanban-option--single${checked ? ' is-picked' : ''}`}>
                        <div className="plan-kanban-meal-head">
                          <label className="plan-kanban-meal-check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleOpcion(diaPlan, { ...slot, isExtra: true })}
                            />
                            <span className="plan-kanban-meal-moment">
                              🍎 {label}{' '}
                              <time>{hora}</time>
                            </span>
                          </label>
                          <div className="plan-kanban-meal-actions">
                            <button
                              type="button"
                              className="plan-kanban-icon-btn"
                              aria-label="Editar en registro de hoy"
                              title="Editar en Registro de hoy"
                              onClick={() => handleEditarExtraEnRegistro(diaPlan, slot, texto)}
                            >
                              <IconPencil />
                            </button>
                            <button
                              type="button"
                              className="plan-kanban-icon-btn plan-kanban-icon-btn--danger"
                              aria-label="Quitar colación extra"
                              title="Quitar"
                              onClick={() => handleEliminarExtra(diaPlan, slot.id, label)}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </div>
                        <p className={`plan-kanban-meal-text${checked ? ' is-struck' : ''}`}>{texto}</p>
                        <div className="plan-kanban-macros">
                          <span className="plan-kanban-pill plan-kanban-pill--kcal">{macros.kcal} kcal</span>
                          <span className="plan-kanban-pill plan-kanban-pill--p">P {macros.p}g</span>
                          <span className="plan-kanban-pill plan-kanban-pill--c">C {macros.h}g</span>
                          <span className="plan-kanban-pill plan-kanban-pill--g">G {macros.g}g</span>
                        </div>
                        {checked ? (
                          <p className="plan-kanban-meal-done-foot mb-0">
                            <span>✓ Colación completada</span>
                            <span className="plan-kanban-listo">Listo</span>
                          </p>
                        ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  className="plan-kanban-add-snack"
                  onClick={() => handleAnadirColacion(diaPlan)}
                >
                  + Añadir colación extra
                </button>
              </article>
            )
          })}
        </div>
      </div>

      <footer className="plan-kanban-foot-tip">
        <div className="plan-kanban-foot-tip-inner">
          <span className="plan-kanban-foot-icon" aria-hidden>
            🛡️
          </span>
          <div>
            <p className="plan-kanban-foot-title mb-1">Tip del nutricionista fitness pro</p>
            <p className="plan-kanban-foot-text mb-0">{tipNutricionistaPlan(config)}</p>
          </div>
          <button type="button" className="plan-kanban-foot-link" onClick={() => setSemanaActiva(4)}>
            Ver recetas sugeridas de cena →
          </button>
        </div>
      </footer>

      <p className="plan-kanban-foot-note mb-0">
        Plan de {PLAN_MES1_TOTAL_DIAS} días · semana {semanaActiva} · {labelEsquemaPlan(esquema)}
      </p>
    </div>
  )
}
