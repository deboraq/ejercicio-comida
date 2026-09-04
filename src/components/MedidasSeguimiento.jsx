import { useMemo, useState } from 'react'
import { fechaToISO, fechaSoloDia, formatearFecha } from '../utils/calorias'
import {
  CAMPOS_MEDIDAS,
  parseCm,
  valoresDeToma,
  labelCampo,
  deltaCampo,
  formatDeltaCm,
} from '../utils/medidas'
import SeguimientoCaja from './SeguimientoCaja'

/**
 * Seguimiento de medidas corporales (cm).
 * @param {Array} historial
 * @param {function} setHistorial
 */
export default function MedidasSeguimiento({ historial, setHistorial }) {
  const [fechaInput, setFechaInput] = useState(() => fechaToISO(new Date()))
  const [notasInput, setNotasInput] = useState('')
  const [valores, setValores] = useState(() =>
    Object.fromEntries(CAMPOS_MEDIDAS.map((c) => [c.key, '']))
  )
  const [campoGraf, setCampoGraf] = useState('cinturaBaja')

  const ordenadosAsc = useMemo(
    () => [...(historial || [])].sort((a, b) => fechaSoloDia(a.fecha).localeCompare(fechaSoloDia(b.fecha))),
    [historial]
  )

  const listaOrdenDesc = useMemo(
    () => [...(historial || [])].sort((a, b) => fechaSoloDia(b.fecha).localeCompare(fechaSoloDia(a.fecha))),
    [historial]
  )

  const serieGraf = useMemo(() => {
    return ordenadosAsc
      .map((t) => {
        const v = Number(t[campoGraf])
        if (!Number.isFinite(v) || v <= 0) return null
        return { id: t.id, fecha: t.fecha, valor: v }
      })
      .filter(Boolean)
      .slice(-14)
  }, [ordenadosAsc, campoGraf])

  const escalaGraf = useMemo(() => {
    if (serieGraf.length < 2) return null
    const vals = serieGraf.map((x) => x.valor)
    const minV = Math.min(...vals)
    const maxV = Math.max(...vals)
    const rango = Math.max(0.5, maxV - minV)
    return { minV, maxV, rango }
  }, [serieGraf])

  const ultima = listaOrdenDesc[0]
  const resumenCerrado = ultima
    ? `Última toma: ${formatearFecha(ultima.fecha)} · ${Object.keys(valoresDeToma(ultima)).length} medidas`
    : 'Todavía no hay tomas'

  const setCampo = (key, value) => {
    setValores((prev) => ({ ...prev, [key]: value }))
  }

  const guardar = (e) => {
    e.preventDefault()
    const parseados = {}
    for (const { key } of CAMPOS_MEDIDAS) {
      const cm = parseCm(valores[key])
      if (cm != null) parseados[key] = cm
    }
    if (Object.keys(parseados).length === 0) {
      window.alert('Ingresá al menos una medida en cm.')
      return
    }
    const fecha = fechaSoloDia(fechaInput) || fechaToISO(new Date())
    const nuevo = {
      id: crypto.randomUUID(),
      fecha,
      notas: (notasInput || '').trim(),
      ...parseados,
    }
    setHistorial((prev) => [nuevo, ...(prev || [])])
    setValores(Object.fromEntries(CAMPOS_MEDIDAS.map((c) => [c.key, ''])))
    setNotasInput('')
    setFechaInput(fechaToISO(new Date()))
  }

  const eliminar = (id) => {
    setHistorial((prev) => (prev || []).filter((x) => x.id !== id))
  }

  return (
    <SeguimientoCaja
      id="medidas-seguimiento"
      titulo="Medidas corporales"
      resumen={resumenCerrado}
      ctaCerrado="Registrar medidas"
    >
      <p className="is-size-7 has-text-grey mb-3">
        Registrá circunferencias en <strong>cm</strong>. Podés dejar campos vacíos y guardar solo lo que midas ese día.
        Medí siempre en el mismo punto y a la misma hora.
      </p>

      <form onSubmit={guardar} className="mb-4">
        <div className="columns is-mobile is-multiline mb-2">
          <div className="column is-half">
            <label className="label is-size-7">Fecha</label>
            <input
              className="input is-small"
              type="date"
              value={fechaInput}
              onChange={(e) => setFechaInput(e.target.value)}
            />
          </div>
          <div className="column is-half">
            <label className="label is-size-7">Notas (opcional)</label>
            <input
              className="input is-small"
              type="text"
              value={notasInput}
              onChange={(e) => setNotasInput(e.target.value)}
              placeholder="Ej: ayunas, mismo lado siempre…"
            />
          </div>
        </div>

        <div className="medidas-campos-grid mb-3">
          {CAMPOS_MEDIDAS.map((c) => (
            <div key={c.key} className="medidas-campo">
              <label className="label is-size-7 mb-1" htmlFor={`medida-${c.key}`} title={c.hint}>
                {c.label} <span className="has-text-grey">(cm)</span>
              </label>
              <input
                id={`medida-${c.key}`}
                className="input is-small"
                type="number"
                min="1"
                max="300"
                step="0.1"
                inputMode="decimal"
                value={valores[c.key]}
                onChange={(e) => setCampo(c.key, e.target.value)}
                placeholder="—"
                title={c.hint}
              />
            </div>
          ))}
        </div>

        <button type="submit" className="button is-link is-small is-fullwidth">
          Guardar medidas
        </button>
      </form>

      <div className="is-flex is-align-items-center is-justify-content-space-between is-flex-wrap-wrap mb-2" style={{ gap: '0.5rem' }}>
        <h3 className="title is-7 mb-0 has-text-grey">Evolución</h3>
        <div className="select is-small">
          <select value={campoGraf} onChange={(e) => setCampoGraf(e.target.value)} aria-label="Medida a graficar">
            {CAMPOS_MEDIDAS.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {escalaGraf ? (
        <div className="peso-graf-wrap mb-4">
          <div className="peso-graf-barras">
            {serieGraf.map((m) => {
              const alt = 8 + ((m.valor - escalaGraf.minV) / escalaGraf.rango) * 52
              return (
                <div
                  key={m.id}
                  className="peso-graf-col has-text-centered"
                  title={`${m.valor} cm — ${formatearFecha(m.fecha)}`}
                >
                  <div className="peso-graf-bar-area">
                    <div className="peso-graf-bar medidas-graf-bar" style={{ height: `${alt}px` }} />
                  </div>
                  <span className="is-size-7 peso-graf-eje">{m.fecha.slice(8)}/{m.fecha.slice(5, 7)}</span>
                </div>
              )
            })}
          </div>
          <p className="is-size-7 has-text-grey mt-1 mb-0">
            {labelCampo(campoGraf)}: {escalaGraf.minV}–{escalaGraf.maxV} cm (últimas {serieGraf.length} tomas con dato).
          </p>
        </div>
      ) : (
        <p className="is-size-7 has-text-grey mb-4">
          Agregá al menos dos tomas con <strong>{labelCampo(campoGraf)}</strong> para ver la gráfica.
        </p>
      )}

      <h3 className="title is-7 mb-2 has-text-grey">Historial</h3>
      {listaOrdenDesc.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0">Todavía no hay registros de medidas.</p>
      ) : (
        <ul className="peso-historial-lista mb-0">
          {listaOrdenDesc.map((toma, idx) => {
            const vals = valoresDeToma(toma)
            const anterior = listaOrdenDesc[idx + 1]
            return (
              <li key={toma.id} className="peso-historial-fila medidas-historial-fila py-2">
                <div className="is-flex is-justify-content-space-between is-align-items-flex-start">
                  <div className="medidas-historial-main">
                    <p className="mb-1">
                      <strong>{formatearFecha(toma.fecha)}</strong>
                      <span className="is-size-7 has-text-grey ml-2">
                        {Object.keys(vals).length} medida{Object.keys(vals).length !== 1 ? 's' : ''}
                      </span>
                    </p>
                    <div className="medidas-chips">
                      {CAMPOS_MEDIDAS.filter((c) => vals[c.key] != null).map((c) => {
                        const d = anterior ? deltaCampo(toma, anterior, c.key) : null
                        return (
                          <span key={c.key} className="medidas-chip">
                            <span className="medidas-chip-label">{c.label}</span>
                            <strong>{vals[c.key]}</strong>
                            <span className="has-text-grey"> cm</span>
                            {d != null && (
                              <span className={`medidas-chip-delta ${d <= 0 ? 'is-down' : 'is-up'}`}>
                                {formatDeltaCm(d)}
                              </span>
                            )}
                          </span>
                        )
                      })}
                    </div>
                    {toma.notas ? <p className="is-size-7 has-text-grey mb-0 mt-1">{toma.notas}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="button is-small is-text has-text-grey"
                    onClick={() => eliminar(toma.id)}
                    aria-label="Eliminar"
                  >
                    ×
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SeguimientoCaja>
  )
}
