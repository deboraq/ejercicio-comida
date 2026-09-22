import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { OBJETIVOS } from '../utils/consejos'
import { fechaToISO } from '../utils/calorias'
import {
  PLAN_MES1_TOTAL_DIAS,
  buildActivacionPlanMes1,
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
  esquemaPlanActivo,
  etiquetaFechaCorta,
  fechaCalendarioDiaPlan,
  formatearHoraPlan,
  formatearKcalRango,
  formatearPesoKg,
  labelEsquemaPlan,
  nombreDiaSemanaCorto,
  resumenHidratacionPlan,
  slotsVisiblesParaEsquema,
  tipNutricionistaPlan,
  totalKcalDiaEstimado,
  estimarMacrosComida,
} from '../utils/planMes1Kanban'
import { totalesMacrosItems } from '../utils/planOpcionComida'
import { payloadSyncPlanToggle, planRefRegistro, planRefsChecksDia } from '../utils/planRegistroSync'
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
  const [config, setConfig] = useStorage('config', {
    objetivo: 'mantener_peso',
    pesoKg: 70,
    sexo: '',
    planMes1Inicio: '',
    planMes1Variante: 'bajar_grasa',
    planMes1CincoComidas: true,
    planMes1Esquema: '5',
  })
  const [planPropio, setPlanPropio] = useStorage('planPropio', null)
  const [estado, setEstado] = useStorage('planMes1Estado', {
    checks: {},
    omitidos: {},
    extras: {},
  })

  const [semanaActiva, setSemanaActiva] = useState(1)
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [editDiaPlan, setEditDiaPlan] = useState(1)

  useEffect(() => {
    const first = (semanaActiva - 1) * 7 + 1
    setEditDiaPlan(first)
  }, [semanaActiva])

  useEffect(() => {
    if (abrirEditorInicial && esPlanPropio(config)) {
      setEditorAbierto(true)
    }
  }, [abrirEditorInicial, config?.planMes1Origen])

  const inicio = config?.planMes1Inicio || ''
  const tienePlan = planMes1TieneInicio(config)
  const listo = perfilPlanListo(config)
  const metaKcal = metaCaloriasPlan(config?.sexo)
  const esquema = esquemaPlanActivo(config)
  const objetivoLabel = OBJETIVOS.find((o) => o.value === config?.objetivo)?.label
  const metaTitulo =
    labelVariantePlan(config?.planMes1Variante || variantePlanDesdeObjetivo(config?.objetivo))
    + (objetivoLabel ? ` / ${objetivoLabel.toLowerCase()}` : '')

  const diasSemana = useMemo(() => diasDeSemanaPlan(semanaActiva), [semanaActiva])
  const listoGenerar = perfilListoParaGenerarPlan(config)

  const confirmarReemplazoPlan = () => {
    if (!tienePlan) return true
    return window.confirm(
      'Vas a empezar un plan nuevo (día 1 desde hoy). Se borran las marcas del tablero. ¿Continuar?'
    )
  }

  const activarPlanGuiado = () => {
    if (!listoGenerar) {
      window.alert('Completá sexo, peso y objetivo en Config para crear el plan guiado de 30 días.')
      return
    }
    if (!confirmarReemplazoPlan()) return
    const hoy = fechaToISO(new Date())
    setEstado({ checks: {}, omitidos: {}, extras: {} })
    setConfig((c) => ({ ...c, ...buildActivacionPlanMes1(c, hoy) }))
    setSemanaActiva(1)
    setEditorAbierto(false)
  }

  const activarPlanPropio = (desdeGuia = false) => {
    if (!listo) {
      window.alert('Completá sexo y peso en Config (o arriba en tu perfil) antes de crear el plan.')
      return
    }
    if (!confirmarReemplazoPlan()) return
    const hoy = fechaToISO(new Date())
    setPlanPropio(desdeGuia ? crearPlanPropioDesdeGuia() : crearPlantillaPlanPropioVacia())
    setEstado({ checks: {}, omitidos: {}, extras: {} })
    setConfig((c) => ({ ...c, ...buildActivacionPlanPropio(c, hoy) }))
    setSemanaActiva(1)
    setEditorAbierto(true)
  }

  const accionesCrearPlan = (modo = 'empty') => (
    <div
      id="plan-crear-nuevo"
      className={modo === 'bar' ? 'plan-kanban-create-bar' : 'plan-kanban-create-block'}
    >
      {modo === 'bar' ? (
        <>
          <p className="plan-kanban-create-bar-title mb-0">Nuevo plan</p>
          <p className="plan-kanban-create-bar-sub mb-0">
            Reiniciá desde hoy con otro menú. Las marcas del tablero se limpian.
          </p>
        </>
      ) : null}
      <div className="plan-kanban-create-row">
        <button
          type="button"
          className="plan-kanban-create-btn plan-kanban-create-btn--primary"
          onClick={activarPlanGuiado}
          disabled={!listoGenerar}
          title={
            listoGenerar
              ? 'Menú de 30 días según tu objetivo'
              : 'Completá sexo, peso y objetivo en Config'
          }
        >
          Plan guiado (30 días)
        </button>
        <button type="button" className="plan-kanban-create-btn" onClick={() => activarPlanPropio(false)}>
          Plan propio (vacío)
        </button>
        <button
          type="button"
          className="plan-kanban-create-btn plan-kanban-create-btn--soft"
          onClick={() => activarPlanPropio(true)}
        >
          Plan propio desde menú sugerido
        </button>
        <Link to="/config#plan-desde-objetivo" className="plan-kanban-create-link">
          Más opciones en Config
        </Link>
      </div>
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

    setEstado((prev) => ({
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
    setEstado((prev) => {
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
    setEstado((prev) => {
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
    setEstado((prev) => {
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
    setEstado((prev) => {
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
    setEstado((prev) => ({
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
      setEstado((prev) => ({
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
      setEstado((prev) => ({
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
          Elegí un <strong>plan guiado</strong> de 30 días según tu objetivo o armá un{' '}
          <strong>plan propio</strong> con tus comidas (dos opciones por comida). Todo desde acá, sin ir a Config.
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

  return (
    <div className={`plan-kanban${embedded ? ' plan-kanban--embedded' : ''}`}>
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

      {!listo && (
        <div className="plan-m1-alert plan-kanban-alert">
          <p className="mb-0">
            Completá sexo y peso en <Link to="/config">Config</Link> para afinar porciones y agua.
          </p>
        </div>
      )}

      <div className="plan-kanban-toolbar">
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
              {editorAbierto ? 'Ocultar editor de menú' : 'Editar mi menú'}
            </button>
          </div>
        )}
      </div>

      {editorAbierto && esPlanPropio(config) && planPropio && (
        <PlanPropioEditor
          diaPlan={editDiaPlan}
          planPropio={planPropio}
          setPlanPropio={setPlanPropio}
          semanaActiva={semanaActiva}
          onCerrar={() => setEditorAbierto(false)}
        />
      )}

      <div className="plan-kanban-board-wrap">
        <div className="plan-kanban-board">
          {diasSemana.map((diaPlan) => {
            const built = buildComidasDiaKanban(diaPlan, config, planPropio)
            if (!built) return null
            const fecha = fechaCalendarioDiaPlan(inicio, diaPlan)
            const diaNombre = nombreDiaSemanaCorto(fecha)
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
                className={`plan-kanban-col${diaCompleto ? ' is-day-done' : ''}`}
              >
                <header className="plan-kanban-col-head">
                  <div>
                    <h3 className="plan-kanban-col-title">
                      Día {diaPlan} · {diaNombre}
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
