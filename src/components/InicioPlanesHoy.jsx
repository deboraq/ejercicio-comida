import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { fechaToISO } from '../utils/calorias'
import { diaPlanMes1, planMes1TieneInicio, PLAN_MES1_TOTAL_DIAS } from '../utils/planMes1'
import { esPlanMes2 } from '../utils/planMes2'
import { getDiaPlanAlimenticio, esPlanPropio } from '../utils/planPropio'
import { configConPlanBibliotecaActivo } from '../utils/planesNutricion'
import {
  getEstadoPlanActivo,
  normalizarEstadoMultiplan,
  setEstadoPlanActivo,
} from '../utils/planEstadoStorage'
import { applyPlanRegistroSyncPayload, togglePlanOpcionCheck } from '../utils/planRegistroSync'
import {
  claveComidaPlan,
  esquemaPlanActivo,
  fechaCalendarioDiaPlan,
  slotsVisiblesParaEsquema,
  PLAN_SLOT_ICON,
} from '../utils/planMes1Kanban'
import RutinaMarcadoRapido from './RutinaMarcadoRapido'
import {
  buildRutinaView,
  etiquetaFechaPlan,
  subtituloRutina,
} from '../utils/rutinaVistaRapida'

function slotHecho(estadoSlice, diaPlan, slot) {
  return (slot.opciones || []).some((_, i) =>
    Boolean(estadoSlice?.checks?.[claveComidaPlan(diaPlan, slot.id, null, i)]),
  )
}

function opcionMarcada(estadoSlice, diaPlan, slotId, opIdx) {
  return Boolean(estadoSlice?.checks?.[claveComidaPlan(diaPlan, slotId, null, opIdx)])
}

function numColumnasOpciones(slots) {
  let max = 0
  for (const s of slots) {
    max = Math.max(max, (s.opciones || []).length)
  }
  return Math.max(max, 1)
}

function textoOpcion(op) {
  if (!op) return ''
  return (op.texto || op.label || '').trim()
}

function buildPlanComida(fechaRef, configPlan, planPropio, planEstado, planActivoId) {
  if (!planMes1TieneInicio(configPlan)) return { tipo: 'sin-plan' }
  const inicio = configPlan.planMes1Inicio
  const diaPlan = diaPlanMes1(inicio, fechaRef)
  if (diaPlan == null) {
    return { tipo: 'fuera-rango', inicio, esMes2: esPlanMes2(configPlan) }
  }
  const detalle = getDiaPlanAlimenticio(diaPlan, configPlan, planPropio)
  if (!detalle) return { tipo: 'sin-detalle', diaPlan }
  const esquema = esquemaPlanActivo(configPlan)
  const slots = detalle.comidas.filter((s) => slotsVisiblesParaEsquema(esquema).some((v) => v.id === s.id))
  const slice = getEstadoPlanActivo(planEstado, planActivoId)
  const hechas = slots.filter((s) => slotHecho(slice, diaPlan, s)).length
  const mesLabel = esPlanMes2(configPlan) ? 'Mes 2' : esPlanPropio(configPlan) ? 'Propio' : 'Mes 1'
  return {
    tipo: 'ok',
    diaPlan,
    detalle,
    slots,
    hechas,
    total: slots.length,
    mesLabel,
    numColsOpciones: numColumnasOpciones(slots),
  }
}

function subtituloPlanComida(planComida) {
  if (planComida.tipo === 'sin-plan') return 'Sin plan activo'
  if (planComida.tipo === 'fuera-rango') return 'Fuera de los 30 días'
  if (planComida.tipo === 'ok') {
    return `${planComida.mesLabel} · Día ${planComida.diaPlan} · ${planComida.hechas}/${planComida.total} marcadas`
  }
  return 'Ver menú'
}

/**
 * Botones compactos en Inicio; al tocar, tarjeta/modal con resumen del día.
 * @param {{ fechaISO: string }} props
 */
export default function InicioPlanesHoy({ fechaISO }) {
  const [config] = useStorage('config', {})
  const [planesNutricion] = useStorage('planesNutricion', [])
  const [planNutricionActivoId] = useStorage('planNutricionActivoId', '')
  const [planPropio] = useStorage('planPropio', { inactivo: true, dias: {} })
  const [planEstado, setPlanEstado] = useStorage('planMes1Estado', { version: 2, byPlanId: {} })
  const [, setRegistrosComida] = useStorage('comida', [])
  const [rutinasRaw] = useStorage('rutinas', [])
  const [rutinaActivaId] = useStorage('rutinaActivaId', '')
  const [registrosRutinaRaw] = useStorage('rutinaPesos', [])

  const [panel, setPanel] = useState(null)
  const [fechaComidaModal, setFechaComidaModal] = useState(fechaISO)
  const [fechaRutinaModal, setFechaRutinaModal] = useState(fechaISO)
  const [diaRutinaModalIdx, setDiaRutinaModalIdx] = useState(null)

  const planActivoId = planNutricionActivoId || config?.planNutricionId || ''
  const configPlan = useMemo(
    () => configConPlanBibliotecaActivo(config, planesNutricion, planActivoId),
    [config, planesNutricion, planActivoId],
  )

  const planComida = useMemo(
    () => buildPlanComida(fechaISO, configPlan, planPropio, planEstado, planActivoId),
    [configPlan, planPropio, planEstado, planActivoId, fechaISO],
  )

  const planComidaModal = useMemo(
    () => buildPlanComida(fechaComidaModal, configPlan, planPropio, planEstado, planActivoId),
    [configPlan, planPropio, planEstado, planActivoId, fechaComidaModal],
  )

  const rutinaHoy = useMemo(
    () => buildRutinaView(fechaISO, null, rutinasRaw, rutinaActivaId, registrosRutinaRaw),
    [rutinasRaw, rutinaActivaId, registrosRutinaRaw, fechaISO],
  )

  const fechaLabel = useMemo(() => etiquetaFechaPlan(fechaISO), [fechaISO])
  const fechaLabelModalComida = useMemo(() => etiquetaFechaPlan(fechaComidaModal), [fechaComidaModal])
  const fechaLabelModalRutina = useMemo(() => etiquetaFechaPlan(fechaRutinaModal), [fechaRutinaModal])

  const cerrarPanel = () => {
    setPanel(null)
  }

  const tienePlanComidaVista = planComida.tipo !== 'sin-plan'
  const tieneRutinaVista = rutinaHoy.tipo !== 'sin-rutina'

  const abrirPanel = (id) => {
    if (id === 'comida' && !tienePlanComidaVista) return
    if (id === 'rutina' && !tieneRutinaVista) return
    setPanel((prev) => (prev === id ? null : id))
  }

  useEffect(() => {
    if (!panel) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') cerrarPanel()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [panel])

  useEffect(() => {
    setPanel(null)
  }, [fechaISO])

  useEffect(() => {
    if (panel === 'comida') setFechaComidaModal(fechaISO)
  }, [panel, fechaISO])

  useEffect(() => {
    if (panel === 'rutina') {
      setFechaRutinaModal(fechaISO)
      setDiaRutinaModalIdx(null)
    }
  }, [panel, fechaISO])

  const moverFechaRutinaModal = useCallback((delta) => {
    const d = new Date(`${fechaRutinaModal}T12:00:00`)
    d.setDate(d.getDate() + delta)
    setFechaRutinaModal(fechaToISO(d))
    setDiaRutinaModalIdx(null)
  }, [fechaRutinaModal])

  const moverDiaPlanModal = useCallback(
    (delta) => {
      const inicio = configPlan?.planMes1Inicio
      if (!inicio || !planMes1TieneInicio(configPlan)) return
      let dia = diaPlanMes1(inicio, fechaComidaModal)
      if (dia == null) {
        dia = delta > 0 ? 1 : PLAN_MES1_TOTAL_DIAS
      } else {
        dia += delta
      }
      if (dia < 1 || dia > PLAN_MES1_TOTAL_DIAS) return
      const nextFecha = fechaCalendarioDiaPlan(inicio, dia)
      if (nextFecha) setFechaComidaModal(nextFecha)
    },
    [configPlan, fechaComidaModal],
  )

  const estadoSlice = getEstadoPlanActivo(planEstado, planActivoId)

  const toggleOpcionEnPlan = useCallback(
    (slot, opIdx) => {
      if (planComidaModal.tipo !== 'ok' || !planActivoId || !slot) return
      const txt = textoOpcion(slot.opciones?.[opIdx])
      if (!txt) return
      const inicio = configPlan.planMes1Inicio
      const diaPlan = planComidaModal.diaPlan

      setPlanEstado((prevRoot) => {
        const slice = getEstadoPlanActivo(prevRoot, planActivoId)
        const { nextSlice, syncPayload } = togglePlanOpcionCheck({
          slice,
          diaPlan,
          slot,
          opIdx,
          inicioISO: inicio,
          configPlan,
        })
        if (syncPayload) {
          queueMicrotask(() => applyPlanRegistroSyncPayload(setRegistrosComida, syncPayload))
        }
        return setEstadoPlanActivo(normalizarEstadoMultiplan(prevRoot), planActivoId, nextSlice)
      })
    },
    [planComidaModal, planActivoId, configPlan, setPlanEstado, setRegistrosComida],
  )

  const puedeDiaPlanAnterior =
    planComidaModal.tipo === 'ok' && planComidaModal.diaPlan > 1
  const puedeDiaPlanSiguiente =
    planComidaModal.tipo === 'ok' && planComidaModal.diaPlan < PLAN_MES1_TOTAL_DIAS

  const sheetModal =
    panel && (
      <div className="inicio-plan-hoy-root" role="presentation">
        <button
          type="button"
          className="inicio-plan-hoy-backdrop"
          aria-label="Cerrar"
          onClick={cerrarPanel}
        />
        <div
          className={`inicio-plan-hoy-sheet inicio-plan-hoy-sheet--${panel}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inicio-plan-hoy-sheet-title"
        >
          <header
            className={`inicio-plan-hoy-sheet-head${panel === 'comida' || panel === 'rutina' ? ' is-compact-panel' : ''}`}
          >
            {panel === 'comida' ? (
              <h2 id="inicio-plan-hoy-sheet-title" className="inicio-plan-hoy-head-fecha mb-0">
                {fechaLabelModalComida}
              </h2>
            ) : panel === 'rutina' ? (
              <div className="inicio-plan-hoy-head-fecha-nav mb-0">
                <button
                  type="button"
                  className="inicio-plan-hoy-head-fecha-flecha"
                  aria-label="Día anterior"
                  onClick={() => moverFechaRutinaModal(-1)}
                >
                  ‹
                </button>
                <h2 id="inicio-plan-hoy-sheet-title" className="inicio-plan-hoy-head-fecha mb-0">
                  {fechaLabelModalRutina}
                </h2>
                <button
                  type="button"
                  className="inicio-plan-hoy-head-fecha-flecha"
                  aria-label="Día siguiente"
                  onClick={() => moverFechaRutinaModal(1)}
                >
                  ›
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="inicio-plan-hoy-close"
              onClick={cerrarPanel}
              aria-label="Cerrar"
            >
              ×
            </button>
          </header>

          <div className="inicio-plan-hoy-sheet-body">
            {panel === 'comida' && (
              <>
                {planComidaModal.tipo === 'sin-plan' && (
                  <p className="inicio-plan-hoy-empty mb-0">
                    Todavía no tenés plan activo.{' '}
                    <Link to="/comida" state={{ vistaComida: 'plan' }} onClick={cerrarPanel}>
                      Crear o activar plan
                    </Link>
                  </p>
                )}
                {planComidaModal.tipo === 'fuera-rango' && (
                  <p className="inicio-plan-hoy-empty mb-0">
                    Esta fecha no cae en los 30 días del plan (
                    {planComidaModal.esMes2 ? 'Mes 2' : 'Mes 1'}).{' '}
                    <Link to="/comida" state={{ vistaComida: 'plan' }} onClick={cerrarPanel}>
                      Ver tablero
                    </Link>
                  </p>
                )}
                {planComidaModal.tipo === 'ok' && (
                  <>
                    <div className="inicio-plan-hoy-tabla-wrap">
                      <table className="inicio-plan-hoy-tabla">
                        <thead>
                          <tr>
                            <th
                              colSpan={1 + planComidaModal.numColsOpciones}
                              className="inicio-plan-hoy-tabla-dia"
                              scope="colgroup"
                            >
                              <div className="inicio-plan-hoy-tabla-dia-nav">
                                <button
                                  type="button"
                                  className="inicio-plan-hoy-tabla-dia-flecha"
                                  disabled={!puedeDiaPlanAnterior}
                                  aria-label="Día anterior del plan"
                                  onClick={() => moverDiaPlanModal(-1)}
                                >
                                  ‹
                                </button>
                                <span className="inicio-plan-hoy-tabla-dia-text">
                                  Día {planComidaModal.diaPlan}
                                  <span className="inicio-plan-hoy-tabla-dia-meta">
                                    {' · '}
                                    {planComidaModal.mesLabel} · {planComidaModal.hechas}/
                                    {planComidaModal.total} marcadas
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  className="inicio-plan-hoy-tabla-dia-flecha"
                                  disabled={!puedeDiaPlanSiguiente}
                                  aria-label="Día siguiente del plan"
                                  onClick={() => moverDiaPlanModal(1)}
                                >
                                  ›
                                </button>
                              </div>
                            </th>
                          </tr>
                          <tr>
                            <th scope="col" className="inicio-plan-hoy-tabla-corner" aria-hidden />
                            {Array.from({ length: planComidaModal.numColsOpciones }, (_, i) => (
                              <th key={i} scope="col" className="inicio-plan-hoy-tabla-op-head">
                                Opción {i + 1}
                              </th>
                            ))}
                          </tr>
                        </thead>
                          <tbody>
                            {planComidaModal.slots.map((slot) => {
                              const opciones = slot.opciones || []
                              const momento = slot.label || slot.momentoComida
                              return (
                                <tr key={slot.id}>
                                  <th scope="row" className="inicio-plan-hoy-tabla-momento">
                                    <div className="inicio-plan-hoy-tabla-momento-inner">
                                      <span className="inicio-plan-hoy-tabla-momento-ico" aria-hidden>
                                        {PLAN_SLOT_ICON[slot.id] || '🍽️'}
                                      </span>
                                      <span className="inicio-plan-hoy-tabla-momento-lab">{momento}</span>
                                    </div>
                                  </th>
                                  {Array.from({ length: planComidaModal.numColsOpciones }, (_, i) => {
                                    const txt = textoOpcion(opciones[i])
                                    const marcada = opcionMarcada(
                                      estadoSlice,
                                      planComidaModal.diaPlan,
                                      slot.id,
                                      i,
                                    )
                                    const vacia = !txt
                                    return (
                                      <td
                                        key={i}
                                        className={`inicio-plan-hoy-tabla-cel${marcada ? ' is-selected' : ''}${vacia ? ' is-empty' : ' is-tappable'}`}
                                        {...(vacia
                                          ? {}
                                          : {
                                              role: 'button',
                                              tabIndex: 0,
                                              'aria-pressed': marcada,
                                              onClick: () => toggleOpcionEnPlan(slot, i),
                                              onKeyDown: (e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                  e.preventDefault()
                                                  toggleOpcionEnPlan(slot, i)
                                                }
                                              },
                                            })}
                                      >
                                        <span className="inicio-plan-hoy-tabla-cel-inner">
                                          {marcada ? (
                                            <span className="inicio-plan-hoy-tabla-cel-check" aria-hidden>
                                              ✓
                                            </span>
                                          ) : null}
                                          <span className="inicio-plan-hoy-tabla-cel-txt">{txt || '—'}</span>
                                        </span>
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                    </div>
                    <div className="inicio-plan-hoy-actions">
                      <Link
                        to="/comida"
                        state={{ vistaComida: 'plan' }}
                        className="button is-link is-small"
                        onClick={cerrarPanel}
                      >
                        Ver plan completo
                      </Link>
                      <Link to="/comida" className="button is-light is-small" onClick={cerrarPanel}>
                        Registro detallado
                      </Link>
                    </div>
                  </>
                )}
              </>
            )}

            {panel === 'rutina' && (
              <RutinaMarcadoRapido
                fechaISO={fechaRutinaModal}
                diaIndice={diaRutinaModalIdx}
                onDiaIndiceChange={setDiaRutinaModalIdx}
                onAntesIrRutinaCompleta={cerrarPanel}
              />
            )}
          </div>
        </div>
      </div>
    )

  const ariaBarLabel =
    tienePlanComidaVista && tieneRutinaVista
      ? 'Plan comida y rutina'
      : tieneRutinaVista
        ? 'Rutina'
        : 'Plan comida'

  if (!tienePlanComidaVista && !tieneRutinaVista) {
    return typeof document !== 'undefined' && panel ? createPortal(sheetModal, document.body) : null
  }

  return (
    <>
      <section className="box inicio-plan-hoy-card" aria-labelledby="inicio-vista-rapida-title">
        <h2 id="inicio-vista-rapida-title" className="inicio-card-title inicio-plan-hoy-title">
          Vista rápida del día
        </h2>
        <div
          className={`inicio-plan-hoy-bar${!tienePlanComidaVista || !tieneRutinaVista ? ' inicio-plan-hoy-bar--uno' : ''}`}
          role="group"
          aria-label={ariaBarLabel}
        >
          {tienePlanComidaVista ? (
            <button
              type="button"
              className={`inicio-plan-hoy-trigger inicio-plan-hoy-trigger--comida${panel === 'comida' ? ' is-active' : ''}`}
              onClick={() => abrirPanel('comida')}
              aria-expanded={panel === 'comida'}
            >
              <span className="inicio-plan-hoy-trigger-ico" aria-hidden>
                📋
              </span>
              <span className="inicio-plan-hoy-trigger-text">
                <strong>Plan comida</strong>
                <span className="inicio-plan-hoy-trigger-sub">{subtituloPlanComida(planComida)}</span>
              </span>
            </button>
          ) : null}
          {tieneRutinaVista ? (
            <button
              type="button"
              className={`inicio-plan-hoy-trigger inicio-plan-hoy-trigger--rutina${panel === 'rutina' ? ' is-active' : ''}`}
              onClick={() => abrirPanel('rutina')}
              aria-expanded={panel === 'rutina'}
            >
              <span className="inicio-plan-hoy-trigger-ico" aria-hidden>
                🏋️
              </span>
              <span className="inicio-plan-hoy-trigger-text">
                <strong>Rutina</strong>
                <span className="inicio-plan-hoy-trigger-sub">{subtituloRutina(rutinaHoy)}</span>
              </span>
            </button>
          ) : null}
        </div>
      </section>

      {typeof document !== 'undefined' && panel ? createPortal(sheetModal, document.body) : null}
    </>
  )
}
