import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { fechaSoloDia, fechaToISO, formatearFecha } from '../utils/calorias'
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
import {
  itemEjercicioDiaNormalizado,
  nombreDisplayPlan,
  nombresEjercicioCoinciden,
  parseNumSeriesPlan,
  seriesEfectivasDeItem,
} from '../utils/rutinaEjercicioDia'
import { asArray } from '../hooks/useLocalStorage'
import { nuevoIdRegistro } from '../utils/ids'

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

function etiquetaFechaPlan(fechaRef) {
  const d = new Date(`${fechaRef}T12:00:00`)
  const hoy = new Date()
  const hoyISO = fechaToISO(hoy)
  const base = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })
  const cap = base.charAt(0).toUpperCase() + base.slice(1)
  return fechaRef === hoyISO ? `${cap} · hoy` : cap
}

function subtituloPlanComida(planComida) {
  if (planComida.tipo === 'sin-plan') return 'Sin plan activo'
  if (planComida.tipo === 'fuera-rango') return 'Fuera de los 30 días'
  if (planComida.tipo === 'ok') {
    return `${planComida.mesLabel} · Día ${planComida.diaPlan} · ${planComida.hechas}/${planComida.total} marcadas`
  }
  return 'Ver menú'
}

function etiquetaCortaDiaRutina(nombre) {
  if (!nombre) return 'Día'
  const antesDosPuntos = nombre.split(':')[0]?.trim()
  if (antesDosPuntos && antesDosPuntos.length <= 28) return antesDosPuntos
  if (nombre.length <= 28) return nombre
  return `${nombre.slice(0, 26)}…`
}

function indiceDiaRutinaParaFecha(dias, fechaRef, registrosRutinaRaw) {
  const registros = asArray(registrosRutinaRaw).filter((r) => fechaSoloDia(r.fecha) === fechaRef)
  let diaId = registros.find((r) => r.diaRutinaId)?.diaRutinaId
  if (!diaId || !dias.some((d) => d.id === diaId)) {
    const dow = new Date(`${fechaRef}T12:00:00`).getDay()
    return dow === 0 ? dias.length - 1 : Math.min(dow - 1, dias.length - 1)
  }
  const idx = dias.findIndex((d) => d.id === diaId)
  return idx >= 0 ? idx : 0
}

function buildRutinaView(fechaRef, diaIndice, rutinasRaw, rutinaActivaId, registrosRutinaRaw) {
  const rutinas = asArray(rutinasRaw)
  if (!rutinas.length) return { tipo: 'sin-rutina' }
  const rutina = rutinas.find((r) => r.id === rutinaActivaId) || rutinas[0]
  const dias = rutina?.dias || []
  if (!dias.length) return { tipo: 'sin-dias', nombre: rutina?.nombre }

  const idx =
    diaIndice != null && diaIndice >= 0 && diaIndice < dias.length
      ? diaIndice
      : indiceDiaRutinaParaFecha(dias, fechaRef, registrosRutinaRaw)
  const dia = dias[idx]
  const ejercicios = (dia.ejercicios || []).map(itemEjercicioDiaNormalizado).filter(Boolean)
  const registros = asArray(registrosRutinaRaw).filter((r) => fechaSoloDia(r.fecha) === fechaRef)
  const hechos = ejercicios.filter((ex) =>
    registros.some((r) => nombresEjercicioCoinciden(r.ejercicio, ex.nombre)),
  ).length

  return {
    tipo: 'ok',
    rutinaNombre: rutina.nombre,
    dia,
    diaIndice: idx,
    totalDias: dias.length,
    ejercicios,
    hechos,
    total: ejercicios.length,
    diaId: dia.id,
    rutinaId: rutina.id,
  }
}

function registrosEjercicioEnFecha(registrosRaw, fechaRef, nombreEj) {
  return asArray(registrosRaw).filter(
    (r) =>
      fechaSoloDia(r.fecha) === fechaRef && nombresEjercicioCoinciden(r.ejercicio, nombreEj),
  )
}

function parsePesoKgInicio(pesoKg) {
  if (pesoKg === '' || pesoKg == null) return undefined
  const n = Number(String(pesoKg).replace(',', '.').trim())
  return Number.isFinite(n) ? n : undefined
}

function pesoKgDeRegistro(r) {
  if (r.pesoKg != null && r.pesoKg !== '') {
    const n = Number(String(r.pesoKg).replace(',', '.').trim())
    return Number.isFinite(n) ? n : null
  }
  if (r.peso != null && r.peso !== '') {
    const n = Number(String(r.peso).replace(',', '.').trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Registro más reciente con peso cargado (cualquier fecha). */
function ultimoRegistroConPeso(registrosRaw, nombreEj) {
  return asArray(registrosRaw)
    .filter((r) => nombresEjercicioCoinciden(r.ejercicio, nombreEj))
    .filter((r) => pesoKgDeRegistro(r) != null)
    .sort((a, b) => {
      const cmp = fechaSoloDia(b.fecha).localeCompare(fechaSoloDia(a.fecha))
      if (cmp !== 0) return cmp
      return String(b.id || '').localeCompare(String(a.id || ''))
    })[0] || null
}

function textoUltimoPesoEjercicio(reg) {
  if (!reg) return null
  const kg = pesoKgDeRegistro(reg)
  if (kg == null) return null
  const reps = String(reg.repeticiones || '').trim()
  const fecha = formatearFecha(fechaSoloDia(reg.fecha))
  const partes = [`${kg} kg`]
  if (reps) partes.push(`${reps} reps`)
  partes.push(fecha)
  return partes.join(' · ')
}

function planEjercicioTexto(ex) {
  return [
    ex.series && `${ex.series} series`,
    ex.repeticiones && `${ex.repeticiones} reps`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Registros en rutinaPesos al marcar desde Inicio (compatible con SesionRegistroTitanium). */
function crearRegistrosMarcadoEjercicio(ex, opts) {
  const {
    fecha,
    rutinaId,
    diaRutinaId,
    idConservar,
    pesoKg,
    repeticiones,
    notas,
  } = opts
  const fechaIso = fechaSoloDia(fecha)
  const reps = String(repeticiones ?? ex.repeticiones ?? '').trim() || '8'
  const notasStr = (notas || '').trim()
  const base = {
    fecha: fechaIso,
    rutinaId,
    diaRutinaId,
    ejercicio: ex.nombre,
    repeticiones: reps,
    notas: notasStr,
  }

  if (ex.superserie?.trim()) {
    const vueltas = parseNumSeriesPlan(ex.series, 3)
    return Array.from({ length: vueltas }, (_, i) => ({
      ...base,
      id: i === 0 && idConservar ? idConservar : nuevoIdRegistro(),
      series: 1,
      serieNum: i + 1,
      pesoKg: pesoKg !== undefined ? pesoKg : undefined,
    }))
  }

  const nSeries = seriesEfectivasDeItem(ex)
  return [
    {
      ...base,
      id: idConservar || nuevoIdRegistro(),
      series: nSeries,
      pesoKg: pesoKg !== undefined ? pesoKg : undefined,
    },
  ]
}

function quitarRegistrosEjercicioEnFecha(prev, fechaRef, nombreEj) {
  return prev.filter(
    (r) =>
      !(
        fechaSoloDia(r.fecha) === fechaSoloDia(fechaRef)
        && nombresEjercicioCoinciden(r.ejercicio, nombreEj)
      ),
  )
}

function subtituloRutina(rutinaHoy) {
  if (rutinaHoy.tipo === 'sin-rutina') return 'Sin rutina'
  if (rutinaHoy.tipo === 'sin-dias') return 'Completar días'
  if (rutinaHoy.tipo === 'ok') {
    const dia = etiquetaCortaDiaRutina(rutinaHoy.dia?.nombre)
    return `${dia} · ${rutinaHoy.hechos}/${rutinaHoy.total} registrados`
  }
  return 'Ver entrenamiento'
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
  const [registrosRutinaRaw, setRegistrosRutina] = useStorage('rutinaPesos', [])

  const [panel, setPanel] = useState(null)
  const [fechaComidaModal, setFechaComidaModal] = useState(fechaISO)
  const [fechaRutinaModal, setFechaRutinaModal] = useState(fechaISO)
  const [diaRutinaModalIdx, setDiaRutinaModalIdx] = useState(null)
  const [rutinaEjExpandido, setRutinaEjExpandido] = useState(null)
  const [rutinaEjDraft, setRutinaEjDraft] = useState(null)

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

  const rutinaModal = useMemo(
    () =>
      buildRutinaView(
        fechaRutinaModal,
        diaRutinaModalIdx,
        rutinasRaw,
        rutinaActivaId,
        registrosRutinaRaw,
      ),
    [rutinasRaw, rutinaActivaId, registrosRutinaRaw, fechaRutinaModal, diaRutinaModalIdx],
  )

  const fechaLabel = useMemo(() => etiquetaFechaPlan(fechaISO), [fechaISO])
  const fechaLabelModalComida = useMemo(() => etiquetaFechaPlan(fechaComidaModal), [fechaComidaModal])
  const fechaLabelModalRutina = useMemo(() => etiquetaFechaPlan(fechaRutinaModal), [fechaRutinaModal])

  const cerrarPanel = () => {
    setPanel(null)
    setRutinaEjExpandido(null)
    setRutinaEjDraft(null)
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

  useEffect(() => {
    setRutinaEjExpandido(null)
    setRutinaEjDraft(null)
  }, [fechaRutinaModal, diaRutinaModalIdx])

  const moverDiaRutinaModal = useCallback(
    (delta) => {
      if (rutinaModal.tipo !== 'ok') return
      const next = rutinaModal.diaIndice + delta
      if (next < 0 || next >= rutinaModal.totalDias) return
      setDiaRutinaModalIdx(next)
    },
    [rutinaModal],
  )

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

  const puedeDiaRutinaAnterior =
    rutinaModal.tipo === 'ok' && rutinaModal.diaIndice > 0
  const puedeDiaRutinaSiguiente =
    rutinaModal.tipo === 'ok' && rutinaModal.diaIndice < rutinaModal.totalDias - 1

  const toggleEjercicioHoy = useCallback(
    (ex) => {
      if (rutinaModal.tipo !== 'ok') return
      const fecha = fechaRutinaModal
      const existentes = registrosEjercicioEnFecha(registrosRutinaRaw, fecha, ex.nombre)
      if (existentes.length) {
        setRegistrosRutina((prev) => quitarRegistrosEjercicioEnFecha(prev, fecha, ex.nombre))
        if (rutinaEjExpandido === ex.nombre) {
          setRutinaEjExpandido(null)
          setRutinaEjDraft(null)
        }
        return
      }
      const nuevos = crearRegistrosMarcadoEjercicio(ex, {
        fecha,
        rutinaId: rutinaModal.rutinaId,
        diaRutinaId: rutinaModal.diaId,
      })
      setRegistrosRutina((prev) => [...nuevos, ...quitarRegistrosEjercicioEnFecha(prev, fecha, ex.nombre)])
    },
    [rutinaModal, fechaRutinaModal, registrosRutinaRaw, setRegistrosRutina, rutinaEjExpandido],
  )

  const alternarDetalleEjercicio = useCallback(
    (ex) => {
      if (rutinaEjExpandido === ex.nombre) {
        setRutinaEjExpandido(null)
        setRutinaEjDraft(null)
        return
      }
      const regs = registrosEjercicioEnFecha(registrosRutinaRaw, fechaRutinaModal, ex.nombre)
      const first = regs[0]
      const ultimo = ultimoRegistroConPeso(registrosRutinaRaw, ex.nombre)
      const pesoHoy =
        first?.pesoKg != null && first.pesoKg !== '' ? String(first.pesoKg) : ''
      const pesoSugerido =
        pesoHoy || (ultimo ? String(pesoKgDeRegistro(ultimo)) : '')
      setRutinaEjExpandido(ex.nombre)
      setRutinaEjDraft({
        nombre: ex.nombre,
        peso: pesoSugerido,
        reps: first?.repeticiones || ex.repeticiones || '',
        notas: first?.notas || '',
      })
    },
    [rutinaEjExpandido, registrosRutinaRaw, fechaRutinaModal],
  )

  const guardarDetalleEjercicio = useCallback(
    (ex) => {
      if (rutinaModal.tipo !== 'ok' || !rutinaEjDraft || rutinaEjDraft.nombre !== ex.nombre) return
      const fecha = fechaRutinaModal
      const existentes = registrosEjercicioEnFecha(registrosRutinaRaw, fecha, ex.nombre)
      const nuevos = crearRegistrosMarcadoEjercicio(ex, {
        fecha,
        rutinaId: rutinaModal.rutinaId,
        diaRutinaId: rutinaModal.diaId,
        idConservar: existentes[0]?.id,
        pesoKg: parsePesoKgInicio(rutinaEjDraft.peso),
        repeticiones: rutinaEjDraft.reps,
        notas: rutinaEjDraft.notas,
      })
      setRegistrosRutina((prev) => [...nuevos, ...quitarRegistrosEjercicioEnFecha(prev, fecha, ex.nombre)])
    },
    [rutinaModal, rutinaEjDraft, fechaRutinaModal, registrosRutinaRaw, setRegistrosRutina],
  )

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
              <>
                {rutinaModal.tipo === 'sin-rutina' && (
                  <p className="inicio-plan-hoy-empty mb-0">
                    No hay rutina guardada.{' '}
                    <Link to="/rutina" state={{ rutinaVista: 'configurar' }} onClick={cerrarPanel}>
                      Armar rutina
                    </Link>
                  </p>
                )}
                {rutinaModal.tipo === 'sin-dias' && (
                  <p className="inicio-plan-hoy-empty mb-0">
                    La rutina «{rutinaModal.nombre}» no tiene días.{' '}
                    <Link to="/rutina" state={{ rutinaVista: 'configurar' }} onClick={cerrarPanel}>
                      Configurar
                    </Link>
                  </p>
                )}
                {rutinaModal.tipo === 'ok' && (
                  <>
                    <div className="inicio-plan-hoy-tabla-wrap inicio-plan-hoy-tabla-wrap--rutina">
                      <table className="inicio-plan-hoy-tabla inicio-plan-hoy-tabla--rutina">
                        <colgroup>
                          <col className="inicio-plan-hoy-rut-col-ej" />
                          <col className="inicio-plan-hoy-rut-col-plan" />
                          <col className="inicio-plan-hoy-rut-col-hoy" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th colSpan={3} className="inicio-plan-hoy-tabla-dia inicio-plan-hoy-tabla-dia--rutina">
                              <div className="inicio-plan-hoy-tabla-dia-nav">
                                <button
                                  type="button"
                                  className="inicio-plan-hoy-tabla-dia-flecha inicio-plan-hoy-tabla-dia-flecha--rutina"
                                  disabled={!puedeDiaRutinaAnterior}
                                  aria-label="Entrenamiento anterior"
                                  onClick={() => moverDiaRutinaModal(-1)}
                                >
                                  ‹
                                </button>
                                <span className="inicio-plan-hoy-tabla-dia-text">
                                  {etiquetaCortaDiaRutina(rutinaModal.dia?.nombre)}
                                  <span className="inicio-plan-hoy-tabla-dia-meta inicio-plan-hoy-tabla-dia-meta--rutina">
                                    {' · '}
                                    {rutinaModal.rutinaNombre} · {rutinaModal.hechos}/{rutinaModal.total}{' '}
                                    registrados
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  className="inicio-plan-hoy-tabla-dia-flecha inicio-plan-hoy-tabla-dia-flecha--rutina"
                                  disabled={!puedeDiaRutinaSiguiente}
                                  aria-label="Entrenamiento siguiente"
                                  onClick={() => moverDiaRutinaModal(1)}
                                >
                                  ›
                                </button>
                              </div>
                            </th>
                          </tr>
                          <tr>
                            <th scope="col" className="inicio-plan-hoy-tabla-corner inicio-plan-hoy-tabla-corner--rutina">
                              Ejercicio
                            </th>
                            <th scope="col" className="inicio-plan-hoy-tabla-op-head inicio-plan-hoy-tabla-op-head--rutina">
                              Plan
                            </th>
                            <th
                              scope="col"
                              className="inicio-plan-hoy-tabla-op-head inicio-plan-hoy-tabla-op-head--rutina inicio-plan-hoy-tabla-op-head--rutina-hoy"
                            >
                              Hoy
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rutinaModal.ejercicios.map((ex) => {
                            const registros = registrosEjercicioEnFecha(
                              registrosRutinaRaw,
                              fechaRutinaModal,
                              ex.nombre,
                            )
                            const hecho = registros.length > 0
                            const planTxt = planEjercicioTexto(ex)
                            const abierto = rutinaEjExpandido === ex.nombre
                            const draft =
                              rutinaEjDraft?.nombre === ex.nombre
                                ? rutinaEjDraft
                                : {
                                    peso: '',
                                    reps: ex.repeticiones || '',
                                    notas: '',
                                  }
                            const resumenHoy = hecho
                              ? registros
                                  .map((r) => {
                                    const p =
                                      r.pesoKg != null && r.pesoKg !== ''
                                        ? `${r.pesoKg} kg`
                                        : r.peso
                                          ? `${r.peso} kg`
                                          : ''
                                    return p || null
                                  })
                                  .filter(Boolean)
                                  .join(', ')
                              : ''
                            const ultimoConPeso = ultimoRegistroConPeso(registrosRutinaRaw, ex.nombre)
                            const textoUltimo = textoUltimoPesoEjercicio(ultimoConPeso)
                            return (
                              <Fragment key={ex.nombre}>
                                <tr>
                                  <td className="inicio-plan-hoy-tabla-cel inicio-plan-hoy-tabla-cel--rutina inicio-plan-hoy-tabla-cel--ej">
                                    {nombreDisplayPlan(ex.nombre)}
                                  </td>
                                  <td className="inicio-plan-hoy-tabla-cel inicio-plan-hoy-tabla-cel--rutina">
                                    {planTxt || '—'}
                                  </td>
                                  <td className="inicio-plan-hoy-tabla-cel inicio-plan-hoy-tabla-cel--rutina inicio-plan-hoy-tabla-cel--hoy">
                                    <div className="inicio-plan-hoy-rut-hoy">
                                      <button
                                        type="button"
                                        className={`inicio-plan-hoy-rut-check${hecho ? ' is-on' : ''}`}
                                        aria-pressed={hecho}
                                        aria-label={
                                          hecho
                                            ? `Desmarcar ${nombreDisplayPlan(ex.nombre)}`
                                            : `Marcar ${nombreDisplayPlan(ex.nombre)}`
                                        }
                                        onClick={() => toggleEjercicioHoy(ex)}
                                        title={resumenHoy || undefined}
                                      >
                                        {hecho ? '✓' : ''}
                                      </button>
                                      <button
                                        type="button"
                                        className={`inicio-plan-hoy-rut-expand${abierto ? ' is-open' : ''}`}
                                        aria-expanded={abierto}
                                        aria-label={`Detalle de ${nombreDisplayPlan(ex.nombre)}`}
                                        onClick={() => alternarDetalleEjercicio(ex)}
                                      >
                                        {abierto ? '▾' : '›'}
                                      </button>
                                      {!abierto && resumenHoy ? (
                                        <span className="inicio-plan-hoy-rut-resumen">{resumenHoy}</span>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                                {abierto ? (
                                  <tr className="inicio-plan-hoy-rut-detail-row">
                                    <td colSpan={3} className="inicio-plan-hoy-rut-detail-cell">
                                      <div className="inicio-plan-hoy-rut-detail">
                                        {textoUltimo ? (
                                          <p className="inicio-plan-hoy-rut-ultimo">
                                            Último peso: <strong>{textoUltimo}</strong>
                                          </p>
                                        ) : null}
                                        <label className="inicio-plan-hoy-rut-field">
                                          <span>Peso (kg)</span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            className="input is-small"
                                            value={draft.peso}
                                            onChange={(e) =>
                                              setRutinaEjDraft((d) =>
                                                d?.nombre === ex.nombre
                                                  ? { ...d, peso: e.target.value }
                                                  : {
                                                      nombre: ex.nombre,
                                                      peso: e.target.value,
                                                      reps: draft.reps,
                                                      notas: draft.notas,
                                                    },
                                              )
                                            }
                                          />
                                        </label>
                                        <label className="inicio-plan-hoy-rut-field">
                                          <span>Reps</span>
                                          <input
                                            type="text"
                                            className="input is-small"
                                            value={draft.reps}
                                            onChange={(e) =>
                                              setRutinaEjDraft((d) =>
                                                d?.nombre === ex.nombre
                                                  ? { ...d, reps: e.target.value }
                                                  : {
                                                      nombre: ex.nombre,
                                                      peso: draft.peso,
                                                      reps: e.target.value,
                                                      notas: draft.notas,
                                                    },
                                              )
                                            }
                                          />
                                        </label>
                                        <label className="inicio-plan-hoy-rut-field inicio-plan-hoy-rut-field--wide">
                                          <span>Notas</span>
                                          <input
                                            type="text"
                                            className="input is-small"
                                            placeholder="Opcional"
                                            value={draft.notas}
                                            onChange={(e) =>
                                              setRutinaEjDraft((d) =>
                                                d?.nombre === ex.nombre
                                                  ? { ...d, notas: e.target.value }
                                                  : {
                                                      nombre: ex.nombre,
                                                      peso: draft.peso,
                                                      reps: draft.reps,
                                                      notas: e.target.value,
                                                    },
                                              )
                                            }
                                          />
                                        </label>
                                        <button
                                          type="button"
                                          className="button is-link is-small inicio-plan-hoy-rut-save"
                                          onClick={() => guardarDetalleEjercicio(ex)}
                                        >
                                          Guardar
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="inicio-plan-hoy-actions">
                      <Link
                        to={`/rutina?iniciar=1&fecha=${encodeURIComponent(fechaRutinaModal)}`}
                        state={{ rutinaDiaId: rutinaModal.diaId }}
                        className="button is-link is-small"
                        onClick={cerrarPanel}
                      >
                        Registrar sesión
                      </Link>
                      <Link
                        to={`/rutina?iniciar=1&fecha=${encodeURIComponent(fechaRutinaModal)}`}
                        state={{ rutinaDiaId: rutinaModal.diaId }}
                        className="button is-light is-small"
                        onClick={cerrarPanel}
                      >
                        Ver rutina completa
                      </Link>
                    </div>
                  </>
                )}
              </>
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
