import { useState, useMemo } from 'react'
import { fechaToISO, fechaSoloDia, formatearFecha } from '../utils/calorias'

/**
 * @param {Array<{ id: string, fecha: string, pesoKg: number, notas?: string }>} historial
 * @param {function} setHistorial
 * @param {function} onActualizarPesoConfig (kg: number) => void  actualiza config.pesoKg para cálculos
 */
export default function PesoSeguimiento({ historial, setHistorial, onActualizarPesoConfig }) {
  const [fechaInput, setFechaInput] = useState(() => fechaToISO(new Date()))
  const [pesoInput, setPesoInput] = useState('')
  const [notasInput, setNotasInput] = useState('')

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

  const guardarMedicion = (e) => {
    e.preventDefault()
    const kg = parseFloat(String(pesoInput).replace(',', '.'))
    if (!Number.isFinite(kg) || kg <= 0 || kg > 400) return
    const fecha = fechaSoloDia(fechaInput) || fechaToISO(new Date())
    const redondeado = Math.round(kg * 10) / 10
    const nuevo = {
      id: crypto.randomUUID(),
      fecha,
      pesoKg: redondeado,
      notas: (notasInput || '').trim(),
    }
    setHistorial((prev) => [nuevo, ...(prev || [])])
    onActualizarPesoConfig(redondeado)
    setPesoInput('')
    setNotasInput('')
    setFechaInput(fechaToISO(new Date()))
  }

  const eliminar = (id) => {
    setHistorial((prev) => (prev || []).filter((x) => x.id !== id))
  }

  const listaOrdenDesc = useMemo(
    () => [...(historial || [])].sort((a, b) => fechaSoloDia(b.fecha).localeCompare(fechaSoloDia(a.fecha))),
    [historial]
  )

  return (
    <div id="peso-seguimiento" className="box mb-4 py-3">
      <h2 className="title is-6 mb-2">Seguimiento de peso corporal</h2>
      <p className="is-size-7 has-text-grey mb-3">
        Registrá mediciones con fecha. Se actualiza también el <strong>peso en Config</strong> (el que usan las kcal estimadas).
        Los datos se guardan en este dispositivo y, si tenés sesión, en la nube.
      </p>

      <form onSubmit={guardarMedicion} className="mb-4">
        <div className="columns is-mobile is-multiline">
          <div className="column is-half">
            <label className="label is-size-7">Fecha</label>
            <input className="input is-small" type="date" value={fechaInput} onChange={(e) => setFechaInput(e.target.value)} />
          </div>
          <div className="column is-half">
            <label className="label is-size-7">Peso (kg)</label>
            <input
              className="input is-small"
              type="number"
              min="0.1"
              max="400"
              step="0.1"
              value={pesoInput}
              onChange={(e) => setPesoInput(e.target.value)}
              placeholder="Ej: 68.5"
              required
            />
          </div>
          <div className="column is-full">
            <label className="label is-size-7">Notas (opcional)</label>
            <input
              className="input is-small"
              type="text"
              value={notasInput}
              onChange={(e) => setNotasInput(e.target.value)}
              placeholder="Ej: ayunas, después del entreno…"
            />
          </div>
        </div>
        <button type="submit" className="button is-link is-small is-fullwidth">
          Guardar medición
        </button>
      </form>

      <h3 className="title is-7 mb-2 has-text-grey">Evolución (últimas {ultimosGraf.length} mediciones)</h3>
      {escalaGraf ? (
        <div className="peso-graf-wrap mb-4">
          <div className="peso-graf-barras">
            {ultimosGraf.map((m) => {
              const p = Number(m.pesoKg)
              const alt = 8 + ((p - escalaGraf.minP) / escalaGraf.rango) * 52
              return (
                <div key={m.id} className="peso-graf-col has-text-centered" title={`${p} kg — ${formatearFecha(m.fecha)}`}>
                  <div className="peso-graf-bar-area">
                    <div className="peso-graf-bar has-background-info" style={{ height: `${alt}px` }} />
                  </div>
                  <span className="is-size-7 peso-graf-eje">{m.fecha.slice(8)}/{m.fecha.slice(5, 7)}</span>
                </div>
              )
            })}
          </div>
          <p className="is-size-7 has-text-grey mt-1 mb-0">
            Escala relativa entre el mínimo y el máximo de este tramo ({escalaGraf.minP}–{escalaGraf.maxP} kg).
          </p>
        </div>
      ) : (
        <p className="is-size-7 has-text-grey mb-4">Agregá al menos dos mediciones para ver la gráfica de evolución.</p>
      )}

      <h3 className="title is-7 mb-2 has-text-grey">Historial</h3>
      {listaOrdenDesc.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0">Todavía no hay registros.</p>
      ) : (
        <ul className="peso-historial-lista mb-0">
          {listaOrdenDesc.map((m) => (
            <li key={m.id} className="peso-historial-fila is-flex is-justify-content-space-between is-align-items-flex-start py-2">
              <div>
                <strong>{m.pesoKg} kg</strong>
                <span className="is-size-7 has-text-grey ml-2">{formatearFecha(m.fecha)}</span>
                {m.notas ? <p className="is-size-7 has-text-grey mb-0 mt-1">{m.notas}</p> : null}
              </div>
              <button type="button" className="button is-small is-text has-text-grey" onClick={() => eliminar(m.id)} aria-label="Eliminar">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
