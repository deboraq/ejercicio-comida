import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { caloriasQuemadas, formatearFecha, TIPOS_EJERCICIO_AGRUPADOS, etiquetaTipo } from '../utils/calorias'

const TIPO_DEFAULT = TIPOS_EJERCICIO_AGRUPADOS[0].opciones[0].value
const TIPOS_FLAT = TIPOS_EJERCICIO_AGRUPADOS.flatMap((g) => g.opciones)

export default function Ejercicios() {
  const [ejercicios, setEjercicios] = useStorage('ejercicios', [])
  const [config] = useStorage('config', { pesoKg: 70 })
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState(TIPO_DEFAULT)
  const [duracion, setDuracion] = useState('')
  const [notas, setNotas] = useState('')
  const [fechaInput, setFechaInput] = useState(new Date().toISOString().slice(0, 10))
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const pesoKg = config?.pesoKg || 70

  const agregar = (e) => {
    e.preventDefault()
    if (!nombre.trim() || !duracion || Number(duracion) <= 0) return
    const fecha = fechaInput || new Date().toISOString().slice(0, 10)
    setEjercicios([
      {
        id: crypto.randomUUID(),
        nombre: nombre.trim(),
        tipo,
        duracion: Number(duracion),
        notas: notas.trim(),
        fecha,
      },
      ...ejercicios,
    ])
    setNombre('')
    setDuracion('')
    setNotas('')
    setFechaInput(new Date().toISOString().slice(0, 10))
  }

  const eliminar = (id) => {
    setEjercicios(ejercicios.filter((e) => e.id !== id))
  }

  const ejerciciosFiltrados = ejercicios.filter((e) => {
    if (filtroTexto.trim()) {
      const t = filtroTexto.trim().toLowerCase()
      const matchNombre = e.nombre?.toLowerCase().includes(t)
      const matchNotas = e.notas?.toLowerCase().includes(t)
      const matchTipo = etiquetaTipo(e.tipo).toLowerCase().includes(t)
      if (!matchNombre && !matchNotas && !matchTipo) return false
    }
    if (filtroTipo && e.tipo !== filtroTipo) return false
    if (filtroDesde && e.fecha < filtroDesde) return false
    if (filtroHasta && e.fecha > filtroHasta) return false
    return true
  })

  const porFecha = ejerciciosFiltrados.reduce((acc, e) => {
    if (!acc[e.fecha]) acc[e.fecha] = []
    acc[e.fecha].push(e)
    return acc
  }, {})

  const minutosHoy = ejercicios
    .filter((e) => e.fecha === new Date().toISOString().slice(0, 10))
    .reduce((s, e) => s + e.duracion, 0)

  const caloriasHoy = ejercicios
    .filter((e) => e.fecha === new Date().toISOString().slice(0, 10))
    .reduce((s, e) => s + caloriasQuemadas(e.tipo, e.duracion, pesoKg), 0)

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: '560px' }}>
        <header className="mb-5">
          <h1 className="title is-4">Ejercicios</h1>
          <p className="subtitle is-6 has-text-grey">Registra por día. Calorías quemadas son aproximadas según tipo y duración.</p>
        </header>

        <div className="columns mb-5">
          <div className="column">
            <div className="box">
              <p className="is-size-7 has-text-grey">Minutos hoy</p>
              <p className="title is-4 has-text-link">{minutosHoy}</p>
            </div>
          </div>
          <div className="column">
            <div className="box">
              <p className="is-size-7 has-text-grey">Calorías quemadas hoy (aprox.)</p>
              <p className="title is-4 has-text-success">{caloriasHoy}</p>
            </div>
          </div>
        </div>

        <div className="box mb-6">
          <h2 className="title is-6 mb-4">Nuevo ejercicio</h2>
          <form onSubmit={agregar}>
            <div className="field">
              <label className="label">Fecha</label>
              <div className="control">
                <input
                  className="input"
                  type="date"
                  value={fechaInput}
                  onChange={(e) => setFechaInput(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label className="label">Nombre</label>
              <div className="control">
                <input
                  className="input"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Correr, Yoga, Pesas..."
                />
              </div>
            </div>
            <div className="columns">
              <div className="column">
                <div className="field">
                  <label className="label">Tipo de actividad</label>
                  <div className="control">
                    <div className="select is-fullwidth">
                      <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                        {TIPOS_EJERCICIO_AGRUPADOS.map((grupo) => (
                          <optgroup key={grupo.categoria} label={grupo.categoria}>
                            {grupo.opciones.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="column">
                <div className="field">
                  <label className="label">Duración (min)</label>
                  <div className="control">
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={duracion}
                      onChange={(e) => setDuracion(e.target.value)}
                      placeholder="30"
                    />
                  </div>
                </div>
              </div>
            </div>
            {duracion && tipo && (
              <p className="is-size-7 has-text-grey mb-3">
                Aprox. {caloriasQuemadas(tipo, duracion, pesoKg)} kcal quemadas (según tu peso en Config).
              </p>
            )}
            <div className="field">
              <label className="label">Notas (opcional)</label>
              <div className="control">
                <input
                  className="input"
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Intensidad, cómo te sentiste..."
                />
              </div>
            </div>
            <div className="field">
              <div className="control">
                <button type="submit" className="button is-link is-fullwidth">Guardar ejercicio</button>
              </div>
            </div>
          </form>
        </div>

        <h2 className="title is-6 mb-2">Historial por día</h2>
        <div className="box mb-4 py-3">
          <p className="is-size-7 has-text-grey mb-2">Filtrar historial</p>
          <div className="columns is-mobile is-multiline is-variable is-1">
            <div className="column is-full">
              <input
                className="input is-small"
                type="text"
                placeholder="Buscar por nombre, notas o tipo..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
              />
            </div>
            <div className="column is-half">
              <div className="select is-small is-fullwidth">
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                  <option value="">Todos los tipos</option>
                  {TIPOS_FLAT.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="column is-half">
              <input
                className="input is-small"
                type="date"
                placeholder="Desde"
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
                title="Desde fecha"
              />
            </div>
            <div className="column is-half">
              <input
                className="input is-small"
                type="date"
                placeholder="Hasta"
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
                title="Hasta fecha"
              />
            </div>
            <div className="column is-half is-flex is-align-items-center">
              <button
                type="button"
                className="button is-small is-light"
                onClick={() => { setFiltroTexto(''); setFiltroTipo(''); setFiltroDesde(''); setFiltroHasta('') }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
          {(filtroTexto || filtroTipo || filtroDesde || filtroHasta) && (
            <p className="is-size-7 has-text-grey mt-2 mb-0">
              {ejerciciosFiltrados.length} resultado{ejerciciosFiltrados.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {Object.keys(porFecha).length === 0 ? (
          <div className="box has-text-centered has-text-grey">
            Aún no hay ejercicios registrados.
          </div>
        ) : (
          <ul className="mb-0" style={{ listStyle: 'none', padding: 0 }}>
            {Object.entries(porFecha)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([fecha, lista]) => {
                const totalCal = lista.reduce((s, e) => s + caloriasQuemadas(e.tipo, e.duracion, pesoKg), 0)
                const totalMin = lista.reduce((s, e) => s + e.duracion, 0)
                return (
                  <li key={fecha} className="mb-5">
                    <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
                      <p className="is-size-7 has-text-grey mb-0" style={{ textTransform: 'capitalize' }}>
                        {formatearFecha(fecha)}
                      </p>
                      <span className="tag is-success is-light">
                        {totalCal} kcal · {totalMin} min
                      </span>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {lista.map((e) => (
                        <li key={e.id} className="box py-3 px-4 mb-2">
                          <div className="is-flex is-justify-content-space-between is-align-items-flex-start">
                            <div className="is-flex-wrap-wrap is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                              <strong>{e.nombre}</strong>
                              <span className="tag is-link is-light">{etiquetaTipo(e.tipo)}</span>
                              <span>{e.duracion} min</span>
                              <span className="tag is-success is-light">
                                ~{caloriasQuemadas(e.tipo, e.duracion, pesoKg)} kcal
                              </span>
                              {e.notas && (
                                <span className="is-size-7 has-text-grey" style={{ width: '100%' }}>
                                  — {e.notas}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="button is-small is-text has-text-grey"
                              onClick={() => eliminar(e.id)}
                              aria-label="Eliminar"
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
          </ul>
        )}
      </div>
    </section>
  )
}
