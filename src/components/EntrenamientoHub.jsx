import { useEffect, useMemo, useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import {
  caloriasEjercicioRegistro,
  caloriasQuemadasRegistrosRutina,
  fechaSoloDia,
  fechaToISO,
  formatearFecha,
} from '../utils/calorias'
import { getDiasDelMes } from '../utils/calendarioMes'
import { getIconoActividad } from '../utils/iconosActividad'
import { getRangoPorPeriodo, getRachaDias, getUltimosNDias } from '../utils/estadisticas'

/**
 * Vista principal de Entrenamiento: calendario, resumen y accesos a gym / cardio.
 * @param {{
 *   fechaSeleccionada: string,
 *   onFechaSeleccionada: (iso: string) => void,
 *   onAbrirHoy: () => void,
 *   onAbrirMusculacion: (navState?: object) => void,
 *   onAbrirCardio: () => void,
 *   onVerDeportesHistorial?: () => void,
 *   mostrarMusculacion?: boolean,
 *   mostrarCardio?: boolean,
 * }} props
 */
export default function EntrenamientoHub({
  fechaSeleccionada,
  onFechaSeleccionada,
  onAbrirHoy,
  onAbrirMusculacion,
  onAbrirCardio,
  onVerDeportesHistorial,
  mostrarMusculacion = true,
  mostrarCardio = true,
}) {
  const [registros] = useStorage('rutinaPesos', [])
  const [ejercicios] = useStorage('ejercicios', [])
  const [config] = useStorage('config', { pesoKg: 70 })
  const pesoKg = config?.pesoKg || 70

  const hoy = fechaToISO(new Date())
  const fecha = fechaSoloDia(fechaSeleccionada) || hoy

  const [mesCalendario, setMesCalendario] = useState(() => fecha.slice(0, 7))
  const [diaGymAbierto, setDiaGymAbierto] = useState(false)
  const [diaCardioAbierto, setDiaCardioAbierto] = useState(false)
  const [diaGymListaCompleta, setDiaGymListaCompleta] = useState(false)
  const [diaCardioListaCompleta, setDiaCardioListaCompleta] = useState(false)

  useEffect(() => {
    setDiaGymAbierto(false)
    setDiaCardioAbierto(false)
    setDiaGymListaCompleta(false)
    setDiaCardioListaCompleta(false)
  }, [fecha])

  const diasDelMes = useMemo(() => getDiasDelMes(mesCalendario), [mesCalendario])

  const fechasGym = useMemo(
    () => new Set(registros.map((r) => fechaSoloDia(r.fecha)).filter(Boolean)),
    [registros],
  )
  const fechasCardio = useMemo(
    () => new Set(ejercicios.map((e) => fechaSoloDia(e.fecha)).filter(Boolean)),
    [ejercicios],
  )

  const { desde: desdeMes, hasta: hastaMes } = getRangoPorPeriodo('mes', null, null)
  const ultimos30 = useMemo(() => getUltimosNDias(30), [])
  const desde30 = ultimos30[0]
  const hasta30 = hoy

  const registros30 = useMemo(
    () =>
      registros.filter((r) => {
        const f = fechaSoloDia(r.fecha)
        return f >= desde30 && f <= hasta30
      }),
    [registros, desde30, hasta30],
  )

  const sesionesGym30 = useMemo(() => new Set(registros30.map((r) => fechaSoloDia(r.fecha))).size, [registros30])

  const volumenTon = useMemo(() => {
    const kg = registros30.reduce((sum, r) => {
      const peso = r.pesoKg != null ? Number(r.pesoKg) : 0
      if (!(peso > 0)) return sum
      const series = Number(r.series) || 1
      const reps = parseFloat(String(r.repeticiones || '').replace(',', '.')) || 0
      return sum + peso * series * (reps > 0 ? reps : 1)
    }, 0)
    return kg / 1000
  }, [registros30])

  const ultimos7 = getUltimosNDias(7)
  const minutosCardioSemana = useMemo(() => {
    return ejercicios
      .filter((e) => ultimos7.includes(fechaSoloDia(e.fecha)))
      .reduce((s, e) => s + (Number(e.duracion) || 0), 0)
  }, [ejercicios, ultimos7])

  const kcalCardioSemana = useMemo(() => {
    return ejercicios
      .filter((e) => ultimos7.includes(fechaSoloDia(e.fecha)))
      .reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoKg), 0)
  }, [ejercicios, ultimos7, pesoKg])

  const rachaActividad = useMemo(() => {
    const fechasUnificadas = [
      ...registros.map((r) => ({ fecha: r.fecha })),
      ...ejercicios.map((e) => ({ fecha: e.fecha })),
    ]
    return getRachaDias(fechasUnificadas, hoy)
  }, [registros, ejercicios, hoy])

  const diasActivosMes = useMemo(() => {
    const set = new Set()
    registros.forEach((r) => {
      const f = fechaSoloDia(r.fecha)
      if (f >= desdeMes && f <= hastaMes) set.add(f)
    })
    ejercicios.forEach((e) => {
      const f = fechaSoloDia(e.fecha)
      if (f >= desdeMes && f <= hastaMes) set.add(f)
    })
    return set.size
  }, [registros, ejercicios, desdeMes, hastaMes])

  const diasGymMes = useMemo(() => {
    const set = new Set()
    registros.forEach((r) => {
      const f = fechaSoloDia(r.fecha)
      if (f >= desdeMes && f <= hastaMes) set.add(f)
    })
    return set.size
  }, [registros, desdeMes, hastaMes])

  const diasDeportesMes = useMemo(() => {
    const set = new Set()
    ejercicios.forEach((e) => {
      const f = fechaSoloDia(e.fecha)
      if (f >= desdeMes && f <= hastaMes) set.add(f)
    })
    return set.size
  }, [ejercicios, desdeMes, hastaMes])

  const diasDeportesSemana = useMemo(() => {
    return new Set(
      ejercicios.filter((e) => ultimos7.includes(fechaSoloDia(e.fecha))).map((e) => fechaSoloDia(e.fecha)),
    ).size
  }, [ejercicios, ultimos7])

  const gymDelDia = useMemo(() => {
    const regs = registros.filter((r) => fechaSoloDia(r.fecha) === fecha)
    const ejerciciosSet = new Set(regs.map((r) => r.ejercicio).filter(Boolean))
    const kcal = caloriasQuemadasRegistrosRutina(regs, pesoKg)
    const porNombre = new Map()
    for (const r of regs) {
      const raw = r.ejercicio || 'Ejercicio'
      const prev = porNombre.get(raw)
      if (prev) prev.series += 1
      else porNombre.set(raw, { series: 1 })
    }
    const lineasTodas = [...porNombre.entries()].map(([raw, { series }]) => {
      const label = raw.replace(/^\s*\d+\s*[-–.)]\s*/, '').trim().slice(0, 44)
      const ultimo = regs.filter((r) => r.ejercicio === raw).slice(-1)[0]
      let extra = series > 1 ? `${series} s.` : ''
      if (ultimo?.pesoKg != null && Number(ultimo.pesoKg) > 0) {
        const p = `${ultimo.pesoKg} kg`
        extra = extra ? `${p} · ${extra}` : p
      }
      return { key: raw, label, extra }
    })
    const previewMax = 6
    return {
      registros: regs.length,
      ejercicios: ejerciciosSet.size,
      kcal: Math.round(kcal),
      lineasTodas,
      lineasPreview: lineasTodas.slice(0, previewMax),
      mas: lineasTodas.length > previewMax ? lineasTodas.length - previewMax : 0,
    }
  }, [registros, fecha, pesoKg])

  const deportesDelDia = useMemo(() => {
    const acts = ejercicios.filter((e) => fechaSoloDia(e.fecha) === fecha)
    const min = acts.reduce((s, e) => s + (Number(e.duracion) || 0), 0)
    const kcal = acts.reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoKg), 0)
    return { acts, min, kcal: Math.round(kcal) }
  }, [ejercicios, fecha, pesoKg])

  const fechaLabel = fecha === hoy ? 'Hoy' : formatearFecha(fecha)

  return (
    <div className="entren-hub">
      <div className="entrenamiento-acciones" role="group" aria-label="Accesos de entrenamiento">
        {mostrarMusculacion ? (
          <div className="entrenamiento-accion entrenamiento-accion--gym">
            <div className="entrenamiento-accion-main entrenamiento-accion-main--static">
              <span className="entrenamiento-accion-ico" aria-hidden>
                🏋️
              </span>
              <span className="entrenamiento-accion-text">
                <strong>Musculación &amp; Rutina gym</strong>
                <span>Elegí abajo: hoy, armar o progreso</span>
              </span>
            </div>
            <div className="entrenamiento-accion-foot entrenamiento-accion-foot--3">
              <button type="button" className="entrenamiento-accion-foot-btn" onClick={onAbrirHoy}>
                Hoy
              </button>
              <button type="button" className="entrenamiento-accion-foot-btn" onClick={() => onAbrirMusculacion({ rutinaVista: 'configurar' })}>
                Armar
              </button>
              <button type="button" className="entrenamiento-accion-foot-btn" onClick={() => onAbrirMusculacion({ rutinaVista: 'progreso' })}>
                Progreso
              </button>
            </div>
          </div>
        ) : null}

        {mostrarCardio ? (
          <div className="entrenamiento-accion entrenamiento-accion--cardio">
            <button
              type="button"
              className="entrenamiento-accion-main"
              onClick={onAbrirCardio}
              aria-haspopup="dialog"
            >
              <span className="entrenamiento-accion-ico" aria-hidden>
                🎾
              </span>
              <span className="entrenamiento-accion-text">
                <strong>Deportes &amp; Cardio</strong>
                <span>Tocá para cargar actividad</span>
              </span>
            </button>
            {onVerDeportesHistorial ? (
              <div className="entrenamiento-accion-foot entrenamiento-accion-foot--1">
                <button
                  type="button"
                  className="entrenamiento-accion-foot-btn entrenamiento-accion-foot-btn--ghost"
                  onClick={onVerDeportesHistorial}
                >
                  Ver historial
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="entren-hub-fecha-sesion mb-0">
        Día seleccionado: <strong>{fechaLabel}</strong>
        {fecha !== hoy ? (
          <button type="button" className="entren-hub-fecha-hoy" onClick={() => onFechaSeleccionada(hoy)}>
            Ir a hoy
          </button>
        ) : null}
      </p>

      <section className="entren-hub-dia-dual" aria-label={`Actividad del ${fechaLabel}`}>
        {mostrarMusculacion ? (
          <div
            className={`entren-hub-dia-pane entren-hub-dia-pane--gym${gymDelDia.registros > 0 ? ' is-expandable' : ''}${diaGymAbierto ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="entren-hub-dia-pane-head"
              disabled={gymDelDia.registros === 0}
              aria-expanded={gymDelDia.registros > 0 ? diaGymAbierto : undefined}
              onClick={() => {
                if (gymDelDia.registros === 0) return
                setDiaGymAbierto((v) => {
                  if (v) setDiaGymListaCompleta(false)
                  return !v
                })
              }}
            >
              <span className="entren-hub-dia-pane-title mb-0">🏋️ Musculación</span>
              {gymDelDia.registros > 0 ? (
                <span className="entren-hub-dia-pane-main mb-0">
                  <strong>{gymDelDia.ejercicios}</strong> ejercicio{gymDelDia.ejercicios !== 1 ? 's' : ''} · ~{gymDelDia.kcal}{' '}
                  kcal
                  <span className="entren-hub-dia-chev" aria-hidden>
                    ›
                  </span>
                </span>
              ) : (
                <span className="entren-hub-dia-pane-empty mb-0">Sin rutina de gym este día</span>
              )}
            </button>
            {diaGymAbierto && gymDelDia.lineasTodas.length > 0 ? (
              <ul className="entren-hub-dia-list mb-0">
                {(diaGymListaCompleta ? gymDelDia.lineasTodas : gymDelDia.lineasPreview).map((ln) => (
                  <li key={ln.key}>
                    {ln.label}
                    {ln.extra ? <span className="entren-hub-dia-list-meta"> · {ln.extra}</span> : null}
                  </li>
                ))}
                {gymDelDia.mas > 0 && !diaGymListaCompleta ? (
                  <li className="entren-hub-dia-list-more">
                    <button
                      type="button"
                      className="entren-hub-dia-list-more-btn"
                      onClick={() => setDiaGymListaCompleta(true)}
                    >
                      +{gymDelDia.mas} más
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
        {mostrarCardio ? (
          <div
            className={`entren-hub-dia-pane entren-hub-dia-pane--cardio${deportesDelDia.acts.length > 0 ? ' is-expandable' : ''}${diaCardioAbierto ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="entren-hub-dia-pane-head"
              disabled={deportesDelDia.acts.length === 0}
              aria-expanded={deportesDelDia.acts.length > 0 ? diaCardioAbierto : undefined}
              onClick={() => {
                if (deportesDelDia.acts.length === 0) return
                setDiaCardioAbierto((v) => {
                  if (v) setDiaCardioListaCompleta(false)
                  return !v
                })
              }}
            >
              <span className="entren-hub-dia-pane-title mb-0">🎾 Deportes</span>
              {deportesDelDia.acts.length > 0 ? (
                <span className="entren-hub-dia-pane-main mb-0">
                  <strong>{deportesDelDia.acts.length}</strong> actividad{deportesDelDia.acts.length !== 1 ? 'es' : ''} ·{' '}
                  {deportesDelDia.min} min · ~{deportesDelDia.kcal} kcal
                  <span className="entren-hub-dia-chev" aria-hidden>
                    ›
                  </span>
                </span>
              ) : (
                <span className="entren-hub-dia-pane-empty mb-0">Sin deportes este día</span>
              )}
            </button>
            {diaCardioAbierto && deportesDelDia.acts.length > 0 ? (
              <ul className="entren-hub-dia-list mb-0">
                {(diaCardioListaCompleta ? deportesDelDia.acts : deportesDelDia.acts.slice(0, 6)).map((a) => {
                  const ui = getIconoActividad(a.tipo, a.nombre)
                  return (
                    <li key={a.id || `${a.nombre}-${a.duracion}-${a.fecha}`}>
                      <span aria-hidden>{ui.icon}</span> {a.nombre}
                      <span className="entren-hub-dia-list-meta"> · {a.duracion} min</span>
                    </li>
                  )
                })}
                {deportesDelDia.acts.length > 6 && !diaCardioListaCompleta ? (
                  <li className="entren-hub-dia-list-more">
                    <button
                      type="button"
                      className="entren-hub-dia-list-more-btn"
                      onClick={() => setDiaCardioListaCompleta(true)}
                    >
                      +{deportesDelDia.acts.length - 6} más
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="entren-hub-grid">
        <section className="entren-hub-card entren-hub-cal" aria-label="Mes y días de actividad">
          <div className="rut-mini-cal-nav entren-hub-cal-nav">
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
          <div className="rut-mini-cal entren-hub-mini-cal">
            <div className="rut-mini-cal-head">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="rut-mini-cal-grid">
              {diasDelMes.map((cel, i) => {
                if (cel.vacio) return <span key={`e${i}`} className="rut-mini-cal-cell is-empty" />
                const gym = fechasGym.has(cel.fecha)
                const cardio = fechasCardio.has(cel.fecha)
                const esHoy = cel.fecha === hoy
                const sel = cel.fecha === fecha
                let tone = ''
                if (gym && cardio) tone = ' is-mix'
                else if (gym) tone = ' is-trained'
                else if (cardio) tone = ' is-cardio'
                return (
                  <button
                    key={cel.fecha}
                    type="button"
                    className={`rut-mini-cal-cell${tone}${esHoy ? ' is-today' : ''}${sel ? ' is-sel' : ''}`}
                    onClick={() => onFechaSeleccionada(cel.fecha)}
                    title={
                      gym && cardio
                        ? 'Gym y deportes'
                        : gym
                          ? 'Rutina de gym'
                          : cardio
                            ? 'Deportes / cardio'
                            : 'Seleccionar día'
                    }
                  >
                    {cel.dia}
                    {(gym || cardio) && <i />}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="entren-hub-cal-leyenda mb-0">
            <span className="entren-hub-leyenda entren-hub-leyenda--gym">Gym</span>
            <span className="entren-hub-leyenda entren-hub-leyenda--cardio">Deportes</span>
            <span className="entren-hub-leyenda entren-hub-leyenda--mix">Ambos</span>
          </p>
        </section>

        <section className="entren-hub-card entren-hub-stats" aria-labelledby="entren-hub-stats-title">
          <h2 id="entren-hub-stats-title" className="entren-hub-card-title">
            Resumen
          </h2>
          <div className="entren-hub-kpis entren-hub-kpis--general">
            <div className="entren-hub-kpi">
              <span className="entren-hub-kpi-label">Racha activa</span>
              <strong className="entren-hub-kpi-value">{rachaActividad}</strong>
              <span className="entren-hub-kpi-hint">días seguidos (gym + deportes)</span>
            </div>
            <div className="entren-hub-kpi">
              <span className="entren-hub-kpi-label">Días del mes</span>
              <strong className="entren-hub-kpi-value">{diasActivosMes}</strong>
              <span className="entren-hub-kpi-hint">con alguna actividad</span>
            </div>
          </div>

          {mostrarMusculacion ? (
            <div className="entren-hub-stats-block entren-hub-stats-block--gym">
              <h3 className="entren-hub-stats-block-title">Musculación · 30 días</h3>
              <div className="entren-hub-kpis">
                <div className="entren-hub-kpi">
                  <span className="entren-hub-kpi-label">Sesiones</span>
                  <strong className="entren-hub-kpi-value is-blue">{sesionesGym30}</strong>
                  <span className="entren-hub-kpi-hint">{diasGymMes} días este mes</span>
                </div>
                <div className="entren-hub-kpi">
                  <span className="entren-hub-kpi-label">Volumen</span>
                  <strong className="entren-hub-kpi-value is-blue">
                    {volumenTon >= 10 ? volumenTon.toFixed(1) : volumenTon.toFixed(2)} t
                  </strong>
                  <span className="entren-hub-kpi-hint">tonelaje</span>
                </div>
              </div>
            </div>
          ) : null}

          {mostrarCardio ? (
            <div className="entren-hub-stats-block entren-hub-stats-block--cardio">
              <h3 className="entren-hub-stats-block-title">Deportes · semana</h3>
              <div className="entren-hub-kpis">
                <div className="entren-hub-kpi">
                  <span className="entren-hub-kpi-label">Minutos</span>
                  <strong className="entren-hub-kpi-value is-green">{minutosCardioSemana}</strong>
                  <span className="entren-hub-kpi-hint">~{Math.round(kcalCardioSemana)} kcal</span>
                </div>
                <div className="entren-hub-kpi">
                  <span className="entren-hub-kpi-label">Días activos</span>
                  <strong className="entren-hub-kpi-value is-green">{diasDeportesSemana}</strong>
                  <span className="entren-hub-kpi-hint">{diasDeportesMes} días con deporte en el mes</span>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
