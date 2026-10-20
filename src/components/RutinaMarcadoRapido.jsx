import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { nombreDisplayPlan } from '../utils/rutinaEjercicioDia'
import {
  agruparPlanEnBloques,
  buildRutinaView,
  crearRegistrosMarcadoEjercicio,
  ejercicioMarcadoEnFecha,
  etiquetaCortaDiaRutina,
  planEjercicioTexto,
  parsePesoKgInicio,
  pesoKgDeRegistro,
  progresoVueltasSuperserie,
  quitarRegistrosEjercicioEnFecha,
  registrosEjercicioEnFecha,
  textoUltimoPesoEjercicio,
  ultimoRegistroConPeso,
} from '../utils/rutinaVistaRapida'

/**
 * Marcado rápido de rutina (misma UX que vista rápida en Inicio).
 * @param {{
 *   fechaISO: string,
 *   diaIndice?: number | null,
 *   onDiaIndiceChange?: (idx: number | null) => void,
 *   onAntesIrRutinaCompleta?: () => void,
 *   className?: string,
 * }} props
 */
export default function RutinaMarcadoRapido({
  fechaISO,
  diaIndice: diaIndiceProp = null,
  onDiaIndiceChange,
  onAntesIrRutinaCompleta,
  className = '',
}) {
  const [rutinasRaw] = useStorage('rutinas', [])
  const [rutinaActivaId] = useStorage('rutinaActivaId', '')
  const [registrosRutinaRaw, setRegistrosRutina] = useStorage('rutinaPesos', [])

  const [diaIndiceLocal, setDiaIndiceLocal] = useState(null)
  const diaIndice = onDiaIndiceChange ? diaIndiceProp : diaIndiceLocal

  const [rutinaEjExpandido, setRutinaEjExpandido] = useState(null)
  const [rutinaEjDraft, setRutinaEjDraft] = useState(null)

  const setDiaIndiceMerged = useCallback(
    (idx) => {
      if (onDiaIndiceChange) onDiaIndiceChange(idx)
      else setDiaIndiceLocal(idx)
    },
    [onDiaIndiceChange],
  )

  useEffect(() => {
    setRutinaEjExpandido(null)
    setRutinaEjDraft(null)
  }, [fechaISO, diaIndice])

  const rutinaView = useMemo(
    () => buildRutinaView(fechaISO, diaIndice, rutinasRaw, rutinaActivaId, registrosRutinaRaw),
    [fechaISO, diaIndice, rutinasRaw, rutinaActivaId, registrosRutinaRaw],
  )

  const bloquesPlan = useMemo(() => {
    if (rutinaView.tipo !== 'ok') return []
    return agruparPlanEnBloques(rutinaView.ejercicios)
  }, [rutinaView])

  const moverDiaRutina = useCallback(
    (delta) => {
      if (rutinaView.tipo !== 'ok') return
      const next = rutinaView.diaIndice + delta
      if (next < 0 || next >= rutinaView.totalDias) return
      setDiaIndiceMerged(next)
    },
    [rutinaView, setDiaIndiceMerged],
  )

  const puedeDiaAnterior = rutinaView.tipo === 'ok' && rutinaView.diaIndice > 0
  const puedeDiaSiguiente =
    rutinaView.tipo === 'ok' && rutinaView.diaIndice < rutinaView.totalDias - 1

  const toggleEjercicio = useCallback(
    (ex) => {
      if (rutinaView.tipo !== 'ok') return
      const fecha = fechaISO
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
        rutinaId: rutinaView.rutinaId,
        diaRutinaId: rutinaView.diaId,
      })
      setRegistrosRutina((prev) => [...nuevos, ...quitarRegistrosEjercicioEnFecha(prev, fecha, ex.nombre)])
    },
    [rutinaView, fechaISO, registrosRutinaRaw, setRegistrosRutina, rutinaEjExpandido],
  )

  const alternarDetalleEjercicio = useCallback(
    (ex) => {
      if (rutinaEjExpandido === ex.nombre) {
        setRutinaEjExpandido(null)
        setRutinaEjDraft(null)
        return
      }
      const regs = registrosEjercicioEnFecha(registrosRutinaRaw, fechaISO, ex.nombre)
      const first = regs[0]
      const ultimo = ultimoRegistroConPeso(registrosRutinaRaw, ex.nombre)
      const pesoHoy = first?.pesoKg != null && first.pesoKg !== '' ? String(first.pesoKg) : ''
      const pesoSugerido = pesoHoy || (ultimo ? String(pesoKgDeRegistro(ultimo) ?? '') : '')
      setRutinaEjExpandido(ex.nombre)
      setRutinaEjDraft({
        nombre: ex.nombre,
        peso: pesoSugerido,
        reps: first?.repeticiones || ex.repeticiones || '',
        notas: first?.notas || '',
      })
    },
    [rutinaEjExpandido, registrosRutinaRaw, fechaISO],
  )

  const guardarDetalleEjercicio = useCallback(
    (ex) => {
      if (rutinaView.tipo !== 'ok' || !rutinaEjDraft || rutinaEjDraft.nombre !== ex.nombre) return
      const fecha = fechaISO
      const existentes = registrosEjercicioEnFecha(registrosRutinaRaw, fecha, ex.nombre)
      const nuevos = crearRegistrosMarcadoEjercicio(ex, {
        fecha,
        rutinaId: rutinaView.rutinaId,
        diaRutinaId: rutinaView.diaId,
        idConservar: existentes[0]?.id,
        pesoKg: parsePesoKgInicio(rutinaEjDraft.peso),
        repeticiones: rutinaEjDraft.reps,
        notas: rutinaEjDraft.notas,
      })
      setRegistrosRutina((prev) => [...nuevos, ...quitarRegistrosEjercicioEnFecha(prev, fecha, ex.nombre)])
    },
    [rutinaView, rutinaEjDraft, fechaISO, registrosRutinaRaw, setRegistrosRutina],
  )

  if (rutinaView.tipo === 'sin-rutina') {
    return (
      <p className={`inicio-plan-hoy-empty mb-0 ${className}`.trim()}>
        No hay rutina guardada.{' '}
        <Link to="/rutina?vista=gym&gym=configurar" onClick={onAntesIrRutinaCompleta}>
          Armar rutina
        </Link>
      </p>
    )
  }

  if (rutinaView.tipo === 'sin-dias') {
    return (
      <p className={`inicio-plan-hoy-empty mb-0 ${className}`.trim()}>
        La rutina «{rutinaView.nombre}» no tiene días.{' '}
        <Link to="/rutina?vista=gym&gym=configurar" onClick={onAntesIrRutinaCompleta}>
          Configurar
        </Link>
      </p>
    )
  }

  return (
    <div className={`rutina-marcado-rapido ${className}`.trim()}>
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
                    disabled={!puedeDiaAnterior}
                    aria-label="Entrenamiento anterior"
                    onClick={() => moverDiaRutina(-1)}
                  >
                    ‹
                  </button>
                  <span className="inicio-plan-hoy-tabla-dia-text">
                    {etiquetaCortaDiaRutina(rutinaView.dia?.nombre)}
                    <span className="inicio-plan-hoy-tabla-dia-meta inicio-plan-hoy-tabla-dia-meta--rutina">
                      {' · '}
                      {rutinaView.rutinaNombre} · {rutinaView.hechos}/{rutinaView.total} registrados
                    </span>
                  </span>
                  <button
                    type="button"
                    className="inicio-plan-hoy-tabla-dia-flecha inicio-plan-hoy-tabla-dia-flecha--rutina"
                    disabled={!puedeDiaSiguiente}
                    aria-label="Entrenamiento siguiente"
                    onClick={() => moverDiaRutina(1)}
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
            {bloquesPlan.map((bloque) => (
              <Fragment key={bloque.id}>
                {bloque.tipo === 'superserie' ? (
                  <tr className="inicio-plan-hoy-rut-ss-head">
                    <td colSpan={3} className="inicio-plan-hoy-rut-ss-head-cell">
                      <span className="inicio-plan-hoy-rut-ss-badge">⚡ Superserie {bloque.label}</span>
                      <span className="inicio-plan-hoy-rut-ss-meta">
                        {bloque.items.length} ejercicios · sin descanso entre ellos
                        {bloque.descansoPostRonda ? ` · ${bloque.descansoPostRonda}s al cerrar la ronda` : ''}
                      </span>
                    </td>
                  </tr>
                ) : null}
                {bloque.items.map((ex, idxEnBloque) => {
              const registros = registrosEjercicioEnFecha(registrosRutinaRaw, fechaISO, ex.nombre)
              const hecho = ejercicioMarcadoEnFecha(ex, registrosRutinaRaw, fechaISO)
              const planTxt = planEjercicioTexto(ex)
              const abierto = rutinaEjExpandido === ex.nombre
              const draft =
                rutinaEjDraft?.nombre === ex.nombre
                  ? rutinaEjDraft
                  : { peso: '', reps: ex.repeticiones || '', notas: '' }
              const progSs = progresoVueltasSuperserie(ex, registrosRutinaRaw, fechaISO)
              const resumenHoy = (() => {
                const pesos = registros
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
                if (progSs && progSs.hechas > 0 && progSs.hechas < progSs.total) {
                  return `${progSs.hechas}/${progSs.total} vueltas${pesos.length ? ` · ${pesos.join(', ')}` : ''}`
                }
                if (hecho && pesos.length) return pesos.join(', ')
                return ''
              })()
              const ultimoConPeso = ultimoRegistroConPeso(registrosRutinaRaw, ex.nombre)
              const textoUltimo = textoUltimoPesoEjercicio(ultimoConPeso)
              const enSs = Boolean(ex.superserie?.trim())
              const ssRowClass =
                bloque.tipo === 'superserie'
                  ? ` inicio-plan-hoy-rut-ss-row${idxEnBloque === 0 ? ' is-ss-first' : ''}${idxEnBloque === bloque.items.length - 1 ? ' is-ss-last' : ' is-ss-mid'}`
                  : ''
              return (
                <Fragment key={ex.nombre}>
                  <tr className={ssRowClass.trim() || undefined}>
                    <td className="inicio-plan-hoy-tabla-cel inicio-plan-hoy-tabla-cel--rutina inicio-plan-hoy-tabla-cel--ej">
                      <span className="inicio-plan-hoy-rut-ej-name">
                        {nombreDisplayPlan(ex.nombre)}
                        {enSs ? (
                          <span className="inicio-plan-hoy-rut-ss-chip" title={`Superserie ${ex.superserie}`}>
                            SS {ex.superserie}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="inicio-plan-hoy-tabla-cel inicio-plan-hoy-tabla-cel--rutina">{planTxt || '—'}</td>
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
                          onClick={() => toggleEjercicio(ex)}
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
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
