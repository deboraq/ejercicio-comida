import { useState, useMemo, useEffect } from 'react'
import { fechaToISO, fechaSoloDia, formatearFecha } from '../utils/calorias'
import SeguimientoCaja from './SeguimientoCaja'

/**
 * Único lugar para registrar / modificar peso corporal.
 * Cada cambio actualiza config.pesoKg (IMC, kcal, consejos).
 */
export default function PesoSeguimiento({
  historial,
  setHistorial,
  onActualizarPesoConfig,
  pesoActualKg,
  defaultOpen = false,
  variant = 'default',
}) {
  const [fechaInput, setFechaInput] = useState(() => fechaToISO(new Date()))
  const [pesoInput, setPesoInput] = useState('')
  const [notasInput, setNotasInput] = useState('')
  const [mensaje, setMensaje] = useState(null)

  const ordenadosAsc = useMemo(
    () => [...(historial || [])].sort((a, b) => fechaSoloDia(a.fecha).localeCompare(fechaSoloDia(b.fecha))),
    [historial]
  )

  const ultimosGraf = useMemo(() => ordenadosAsc.slice(-14), [ordenadosAsc])

  const escalaGraf = useMemo(() => {
    if (ultimosGraf.length < 2) return null
    const vals = ultimosGraf.map((x) => Number(x.pesoKg))
    const minP = Math.min(...vals)
    const maxP = Math.max(...vals)
    const rango = Math.max(0.3, maxP - minP)
    return { minP, maxP, rango }
  }, [ultimosGraf])

  const listaOrdenDesc = useMemo(
    () => [...(historial || [])].sort((a, b) => fechaSoloDia(b.fecha).localeCompare(fechaSoloDia(a.fecha))),
    [historial]
  )

  const ultima = listaOrdenDesc[0]
  const penultima = listaOrdenDesc[1]
  const pesoActual = ultima?.pesoKg ?? pesoActualKg ?? null
  const delta =
    ultima && penultima
      ? Math.round((Number(ultima.pesoKg) - Number(penultima.pesoKg)) * 10) / 10
      : null

  // Prefill con el peso actual para poder modificarlo al toque
  useEffect(() => {
    if (pesoInput !== '') return
    if (pesoActual != null) setPesoInput(String(pesoActual))
  }, [pesoActual]) // eslint-disable-line react-hooks/exhaustive-deps

  const resumenCerrado = pesoActual != null
    ? `${pesoActual} kg${ultima ? ` · ${formatearFecha(ultima.fecha)}` : ''}${
        delta != null ? ` · ${delta > 0 ? '+' : ''}${delta} kg` : ''
      }`
    : 'Todavía no hay mediciones'

  const syncConfigDesdeLista = (lista) => {
    if (!onActualizarPesoConfig) return
    const latest = [...(lista || [])].sort((a, b) =>
      fechaSoloDia(b.fecha).localeCompare(fechaSoloDia(a.fecha))
    )[0]
    if (latest?.pesoKg != null) onActualizarPesoConfig(Number(latest.pesoKg))
  }

  const guardarMedicion = (e) => {
    e.preventDefault()
    setMensaje(null)
    const kg = parseFloat(String(pesoInput).replace(',', '.'))
    if (!Number.isFinite(kg) || kg <= 0 || kg > 400) {
      setMensaje('Ingresá un peso válido (ej. 68.5).')
      return
    }
    const fecha = fechaSoloDia(fechaInput) || fechaToISO(new Date())
    const redondeado = Math.round(kg * 10) / 10
    const notas = (notasInput || '').trim()

    setHistorial((prev) => {
      const lista = prev || []
      const idxHoy = lista.findIndex((x) => fechaSoloDia(x.fecha) === fecha)
      let next
      if (idxHoy >= 0) {
        // Actualizar el pesaje del mismo día (modificar, no duplicar)
        next = lista.map((x, i) =>
          i === idxHoy ? { ...x, pesoKg: redondeado, notas: notas || x.notas || '' } : x
        )
      } else {
        next = [
          {
            id: crypto.randomUUID(),
            fecha,
            pesoKg: redondeado,
            notas,
          },
          ...lista,
        ]
      }
      return next
    })
    onActualizarPesoConfig?.(redondeado)
    setMensaje(`Peso actualizado a ${redondeado} kg.`)
    setNotasInput('')
    setFechaInput(fechaToISO(new Date()))
    setPesoInput(String(redondeado))
  }

  const eliminar = (id) => {
    setHistorial((prev) => {
      const next = (prev || []).filter((x) => x.id !== id)
      syncConfigDesdeLista(next)
      return next
    })
    setMensaje(null)
  }

  const formulario = (
    <>
      <form onSubmit={guardarMedicion} className={variant === 'titanium' ? 'cfg-ti-peso-form' : 'config-form-registro mb-4'}>
        <div className={variant === 'titanium' ? 'cfg-ti-form-row' : 'config-form-row'}>
          <div className={variant === 'titanium' ? 'cfg-ti-field mb-0' : 'field mb-0'}>
            <label className={variant === 'titanium' ? 'cfg-ti-label' : 'label is-size-7'}>Fecha</label>
            <input
              className={variant === 'titanium' ? 'cfg-ti-input input' : 'input'}
              type="date"
              value={fechaInput}
              onChange={(e) => setFechaInput(e.target.value)}
            />
          </div>
          <div className={variant === 'titanium' ? 'cfg-ti-field mb-0' : 'field mb-0'}>
            <label className={variant === 'titanium' ? 'cfg-ti-label' : 'label is-size-7'}>Peso (kg)</label>
            <input
              className={variant === 'titanium' ? 'cfg-ti-input input' : 'input'}
              type="number"
              min="0.1"
              max="400"
              step="0.1"
              inputMode="decimal"
              value={pesoInput}
              onChange={(e) => {
                setPesoInput(e.target.value)
                setMensaje(null)
              }}
              placeholder="Ej: 68.5"
              required
            />
          </div>
        </div>
        <div className={variant === 'titanium' ? 'cfg-ti-field' : 'field mt-3 mb-3'}>
          <label className={variant === 'titanium' ? 'cfg-ti-label' : 'label is-size-7'}>Notas (opcional)</label>
          <input
            className={variant === 'titanium' ? 'cfg-ti-input input' : 'input'}
            type="text"
            value={notasInput}
            onChange={(e) => setNotasInput(e.target.value)}
            placeholder="Ej: ayunas, después del entreno…"
          />
        </div>
        <button
          type="submit"
          className={variant === 'titanium' ? 'cfg-ti-btn-block' : 'button is-link is-fullwidth'}
        >
          {pesoActual != null ? 'Guardar / actualizar peso' : 'Guardar peso'}
        </button>
        {mensaje && (
          <p className={variant === 'titanium' ? 'cfg-ti-msg-ok' : 'is-size-7 has-text-success mt-2 mb-0'}>{mensaje}</p>
        )}
      </form>

      {variant === 'titanium' && ultima ? (
        <div className="cfg-ti-pill">
          <span>
            <strong>{ultima.pesoKg} kg</strong>
            <span className="cfg-ti-pill-tag ml-2">Actual</span>
            <span className="has-text-grey ml-2">{formatearFecha(ultima.fecha)}</span>
          </span>
          <button
            type="button"
            className="cfg-ti-pill-del"
            onClick={() => eliminar(ultima.id)}
            aria-label="Eliminar pesaje"
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  )

  if (variant === 'titanium') {
    return (
      <article className="cfg-ti-card cfg-ti-card--blue" id="peso-seguimiento">
        <header className="cfg-ti-card-head">
          <div>
            <h2 className="cfg-ti-card-title">Peso corporal &amp; Registro</h2>
            <p className="cfg-ti-card-sub">Registrá tu peso para actualizar IMC y metas calóricas.</p>
          </div>
        </header>
        {formulario}
      </article>
    )
  }

  return (
    <SeguimientoCaja
      id="peso-seguimiento"
      titulo="Peso corporal"
      resumen={resumenCerrado}
      ctaCerrado="Modificar / registrar"
      defaultOpen={defaultOpen}
    >
      <p className="config-hint mb-3">
        Acá podés <strong>cambiar tu peso</strong> o registrar un pesaje nuevo. El último valor se usa en IMC, calorías y consejos.
      </p>

      {formulario}

      {escalaGraf ? (
        <div className="peso-graf-wrap mb-4">
          <p className="config-section-label mb-2">Evolución</p>
          <div className="peso-graf-barras">
            {ultimosGraf.map((m) => {
              const p = Number(m.pesoKg)
              const alt = 8 + ((p - escalaGraf.minP) / escalaGraf.rango) * 52
              return (
                <div key={m.id} className="peso-graf-col has-text-centered" title={`${p} kg — ${formatearFecha(m.fecha)}`}>
                  <div className="peso-graf-bar-area">
                    <div className="peso-graf-bar" style={{ height: `${alt}px` }} />
                  </div>
                  <span className="is-size-7 peso-graf-eje">{m.fecha.slice(8)}/{m.fecha.slice(5, 7)}</span>
                </div>
              )
            })}
          </div>
          <p className="is-size-7 has-text-grey mt-1 mb-0">
            {escalaGraf.minP}–{escalaGraf.maxP} kg · últimas {ultimosGraf.length} mediciones
          </p>
        </div>
      ) : listaOrdenDesc.length < 2 ? (
        <p className="is-size-7 has-text-grey mb-4">Con dos pesajes o más vas a ver la evolución acá.</p>
      ) : null}

      <p className="config-section-label mb-2">Historial</p>
      {listaOrdenDesc.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0">Todavía no hay registros.</p>
      ) : (
        <ul className="peso-historial-lista mb-0">
          {listaOrdenDesc.map((m, idx) => (
            <li key={m.id} className="peso-historial-fila">
              <div>
                <strong>{m.pesoKg} kg</strong>
                {idx === 0 ? <span className="tag is-info is-light is-size-7 ml-2">Actual</span> : null}
                <span className="is-size-7 has-text-grey ml-2">{formatearFecha(m.fecha)}</span>
                {m.notas ? <p className="is-size-7 has-text-grey mb-0 mt-1">{m.notas}</p> : null}
              </div>
              <button type="button" className="delete is-small" onClick={() => eliminar(m.id)} aria-label="Eliminar" />
            </li>
          ))}
        </ul>
      )}
    </SeguimientoCaja>
  )
}
