import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { getConsejosDelDia } from '../utils/consejos'
import { caloriasQuemadas, formatearFecha, getCategoriaTipo } from '../utils/calorias'
import { REFERENCIA_ALIMENTOS, buscarAlimentos } from '../utils/referenciaComidas'
import { PERIODOS, getRangoPorPeriodo, filtrarPorRango } from '../utils/estadisticas'

const COMIDAS = ['Desayuno', 'Almuerzo', 'Cena', 'Snack']

function crearItemVacio() {
  return {
    id: crypto.randomUUID(),
    descripcion: '',
    calorias: '',
    proteinas: '',
    carbohidratos: '',
    porciones: '',
  }
}

export default function Comida() {
  const [registros, setRegistros] = useStorage('comida', [])
  const [ejercicios] = useStorage('ejercicios', [])
  const [config] = useStorage('config', { objetivo: 'mantener_peso', pesoKg: 70 })
  const [comida, setComida] = useState('Desayuno')
  const [fechaInput, setFechaInput] = useState(new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState([crearItemVacio()])
  const [busquedaRef, setBusquedaRef] = useState('')
  const [cantidadPorciones, setCantidadPorciones] = useState(1)
  const [periodo, setPeriodo] = useState('semana')
  const [desdeCustom, setDesdeCustom] = useState('')
  const [hastaCustom, setHastaCustom] = useState('')

  const resultadosBusqueda = buscarAlimentos(busquedaRef)
  const hoy = new Date().toISOString().slice(0, 10)
  const { desde, hasta } = getRangoPorPeriodo(periodo, desdeCustom, hastaCustom)
  const registrosEnRango = filtrarPorRango(registros, desde, hasta)
  const porFechaEnRango = registrosEnRango.reduce((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = []
    acc[r.fecha].push(r)
    return acc
  }, {})

  const añadirDesdeReferencia = (itemRef, cantidad = cantidadPorciones) => {
    const n = Math.max(1, Number(cantidad) || 1)
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        descripcion: itemRef.nombre,
        calorias: String(Math.round(itemRef.calorias * n)),
        proteinas: String(Math.round(itemRef.proteinas * n)),
        carbohidratos: String(Math.round(itemRef.carbohidratos * n)),
        porciones: n > 1 ? `${n} × (${itemRef.porcion || 'porción'})` : (itemRef.porcion || ''),
      },
    ])
    setBusquedaRef('')
  }

  const actualizarItem = (id, field, value) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }

  const quitarItem = (id) => {
    setItems((prev) => (prev.length <= 1 ? [crearItemVacio()] : prev.filter((it) => it.id !== id)))
  }

  const añadirLineaVacia = () => {
    setItems((prev) => [...prev, crearItemVacio()])
  }

  const totalesItems = items.reduce(
    (acc, it) => ({
      cal: acc.cal + (Number(it.calorias) || 0),
      pro: acc.pro + (Number(it.proteinas) || 0),
      car: acc.car + (Number(it.carbohidratos) || 0),
    }),
    { cal: 0, pro: 0, car: 0 }
  )

  const guardarComida = (e) => {
    e.preventDefault()
    const fecha = fechaInput || hoy
    const aGuardar = items.filter((it) => it.descripcion.trim())
    if (aGuardar.length === 0) return
    const nuevos = aGuardar.map((it) => ({
      id: crypto.randomUUID(),
      comida,
      descripcion: it.descripcion.trim(),
      calorias: it.calorias ? Number(it.calorias) : undefined,
      proteinas: it.proteinas ? Number(it.proteinas) : undefined,
      carbohidratos: it.carbohidratos ? Number(it.carbohidratos) : undefined,
      porciones: it.porciones?.trim() || undefined,
      notas: notas.trim(),
      fecha,
    }))
    setRegistros([...nuevos, ...registros])
    setItems([crearItemVacio()])
    setNotas('')
    setFechaInput(hoy)
  }

  const eliminar = (id) => {
    setRegistros(registros.filter((r) => r.id !== id))
  }

  const porFecha = registros.reduce((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = []
    acc[r.fecha].push(r)
    return acc
  }, {})

  const hoyRegistros = registros.filter((r) => r.fecha === hoy)
  const caloriasHoy = hoyRegistros.reduce((s, r) => s + (Number(r.calorias) || 0), 0)
  const proteinasHoy = hoyRegistros.reduce((s, r) => s + (Number(r.proteinas) || 0), 0)
  const carbosHoy = hoyRegistros.reduce((s, r) => s + (Number(r.carbohidratos) || 0), 0)

  const ejerciciosHoy = ejercicios.filter((ex) => ex.fecha === hoy)
  const ejerciciosPorTipo = ejerciciosHoy.reduce((acc, ex) => {
    const cat = getCategoriaTipo(ex.tipo)
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})
  const caloriasQuemadasHoy = ejerciciosHoy.reduce(
    (s, ex) => s + caloriasQuemadas(ex.tipo, ex.duracion, config?.pesoKg || 70),
    0
  )

  const diaData = {
    caloriasConsumidas: caloriasHoy,
    caloriasQuemadas: caloriasQuemadasHoy,
    proteinas: proteinasHoy,
    carbohidratos: carbosHoy,
    ejerciciosPorTipo,
  }
  const consejos = getConsejosDelDia(config?.objetivo, diaData, config?.pesoKg || 70)

  return (
    <section className="section py-4">
      <div className="container" style={{ maxWidth: '560px' }}>
        <header className="mb-4">
          <h1 className="title is-5 mb-2">Comida</h1>
          <p className="is-size-7 has-text-grey mb-0">Añade varios alimentos por comida (ej. panqueques + yogur + kiwi)</p>
        </header>

        {consejos.length > 0 && (
          <div className="mb-4">
            {consejos.map((c, i) => (
              <article key={i} className="message is-info is-light mb-2 py-3 px-3">
                <div className="message-body is-size-7 py-0">{c.texto}</div>
              </article>
            ))}
          </div>
        )}

        <div className="box mb-4 py-3">
          <h2 className="title is-6 is-size-7 mb-2">Registrar comida</h2>
          <form onSubmit={guardarComida}>
            <div className="field">
              <label className="label is-size-7">Fecha</label>
              <div className="control">
                <input className="input is-small" type="date" value={fechaInput} onChange={(e) => setFechaInput(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label className="label is-size-7">Comida</label>
              <div className="control">
                <div className="select is-fullwidth is-small">
                  <select value={comida} onChange={(e) => setComida(e.target.value)}>
                    {COMIDAS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <p className="label is-size-7 mb-2">Qué comiste (puedes añadir varias cosas)</p>
            <div className="field">
              <label className="label is-size-7">Buscar en referencia</label>
              <div className="control has-icons-left">
                <input
                  className="input is-small"
                  type="text"
                  value={busquedaRef}
                  onChange={(e) => setBusquedaRef(e.target.value)}
                  placeholder="Ej: panqueque, yogur, kiwi..."
                />
                <span className="icon is-small is-left">🔍</span>
              </div>
              {busquedaRef.length >= 1 && (
                <div className="box mt-2 p-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <p className="is-size-7 has-text-grey mb-2">Cantidad antes de elegir:</p>
                  <div className="field has-addons mb-2">
                    <div className="control">
                      <input
                        className="input is-small"
                        type="number"
                        min="1"
                        max="20"
                        value={cantidadPorciones}
                        onChange={(e) => setCantidadPorciones(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        style={{ width: '4rem' }}
                      />
                    </div>
                    <div className="control is-expanded">
                      <span className="button is-static is-small">porciones</span>
                    </div>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {resultadosBusqueda.length === 0 ? (
                      <li className="is-size-7 has-text-grey">Sin resultados.</li>
                    ) : (
                      resultadosBusqueda.map((a) => (
                        <li key={a._idx}>
                          <button
                            type="button"
                            className="button is-fullwidth is-light is-small has-text-left mb-1"
                            onClick={() => añadirDesdeReferencia(a)}
                          >
                            {a.nombre} — {a.calorias} kcal, P: {a.proteinas}g, C: {a.carbohidratos}g
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            {items.map((it) => (
              <div key={it.id} className="box py-2 px-2 mb-2">
                <div className="is-flex is-justify-content-space-between is-align-items-center mb-1">
                  <span className="is-size-7 has-text-grey">Alimento</span>
                  <button type="button" className="button is-small is-text has-text-grey" onClick={() => quitarItem(it.id)} aria-label="Quitar">
                    ×
                  </button>
                </div>
                <div className="field">
                  <div className="control">
                    <input
                      className="input is-small"
                      type="text"
                      value={it.descripcion}
                      onChange={(e) => actualizarItem(it.id, 'descripcion', e.target.value)}
                      placeholder="Nombre o elige de la búsqueda arriba"
                    />
                  </div>
                </div>
                <div className="columns is-mobile">
                  <div className="column">
                    <input
                      className="input is-small"
                      type="number"
                      min="0"
                      placeholder="kcal"
                      value={it.calorias}
                      onChange={(e) => actualizarItem(it.id, 'calorias', e.target.value)}
                    />
                  </div>
                  <div className="column">
                    <input
                      className="input is-small"
                      type="number"
                      min="0"
                      placeholder="P (g)"
                      value={it.proteinas}
                      onChange={(e) => actualizarItem(it.id, 'proteinas', e.target.value)}
                    />
                  </div>
                  <div className="column">
                    <input
                      className="input is-small"
                      type="number"
                      min="0"
                      placeholder="C (g)"
                      value={it.carbohidratos}
                      onChange={(e) => actualizarItem(it.id, 'carbohidratos', e.target.value)}
                    />
                  </div>
                  <div className="column">
                    <input
                      className="input is-small"
                      type="text"
                      placeholder="Porción"
                      value={it.porciones}
                      onChange={(e) => actualizarItem(it.id, 'porciones', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="field">
              <button type="button" className="button is-light is-fullwidth is-small mb-2" onClick={añadirLineaVacia}>
                + Añadir otro alimento
              </button>
            </div>

            {items.some((it) => it.descripcion.trim()) && (
              <p className="is-size-7 has-text-grey mb-2">
                Total: <strong>{totalesItems.cal}</strong> kcal · P: <strong>{totalesItems.pro}</strong>g · C: <strong>{totalesItems.car}</strong>g
              </p>
            )}

            <div className="field">
              <label className="label is-size-7">Notas (opcional)</label>
              <div className="control">
                <input className="input is-small" type="text" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Hambre, ánimo..." />
              </div>
            </div>
            <div className="field">
              <div className="control">
                <button type="submit" className="button is-link is-fullwidth is-small" disabled={!items.some((it) => it.descripcion.trim())}>
                  Guardar comida
                </button>
              </div>
            </div>
          </form>
        </div>

        <h2 className="title is-6 is-size-7 mb-2">Hoy — Resumen</h2>
        <div className="box mb-3 py-3">
          <div className="columns is-mobile is-multiline">
            <div className="column is-half">
              <p className="is-size-7 has-text-grey mb-1">Calorías</p>
              <p className="title is-6 mb-0">{caloriasHoy || '—'}</p>
            </div>
            <div className="column is-half">
              <p className="is-size-7 has-text-grey mb-1">Proteínas (g)</p>
              <p className="title is-6 mb-0">{proteinasHoy || '—'}</p>
            </div>
            <div className="column is-half">
              <p className="is-size-7 has-text-grey mb-1">Carbohidratos (g)</p>
              <p className="title is-6 mb-0">{carbosHoy || '—'}</p>
            </div>
            <div className="column is-half">
              <p className="is-size-7 has-text-grey mb-1">Comidas registradas</p>
              <p className="title is-6 mb-0">{hoyRegistros.length}</p>
            </div>
          </div>
          {(config.metaCalorias || config.metaProteina) && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #eee' }}>
              <p className="is-size-7 has-text-grey mb-2">Progreso hacia tu meta</p>
              {config.metaCalorias && (
                <div className="mb-3">
                  <p className="is-size-7 mb-1">Calorías: {caloriasHoy || 0} / {config.metaCalorias} kcal</p>
                  <progress className="progress is-info" value={Math.min(Number(caloriasHoy) || 0, Number(config.metaCalorias))} max={config.metaCalorias} />
                </div>
              )}
              {config.metaProteina && (
                <div>
                  <p className="is-size-7 mb-1">Proteína: {proteinasHoy || 0} / {config.metaProteina} g</p>
                  <progress className="progress is-success" value={Math.min(Number(proteinasHoy) || 0, Number(config.metaProteina))} max={config.metaProteina} />
                </div>
              )}
            </div>
          )}
        </div>

        <h2 className="title is-6 is-size-7 mb-2">Hoy — Detalle</h2>
        {hoyRegistros.length === 0 ? (
          <div className="box has-text-centered has-text-grey is-size-7 py-3 mb-4">Aún no has registrado comidas hoy.</div>
        ) : (
          <div className="mb-4">
            {COMIDAS.map((tipoComida) => {
              const itemsDelTipo = hoyRegistros.filter((r) => r.comida === tipoComida)
              if (itemsDelTipo.length === 0) return null
              const calTipo = itemsDelTipo.reduce((s, r) => s + (Number(r.calorias) || 0), 0)
              return (
                <div key={tipoComida} className="mb-3">
                  <p className="is-size-7 has-text-grey mb-2">
                    <strong>{tipoComida}</strong>
                    {calTipo > 0 && <span className="ml-2">— {calTipo} kcal</span>}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {itemsDelTipo.map((r) => (
                      <li key={r.id} className="box py-2 px-3 mb-2">
                        <div className="is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
                          <div className="is-flex-grow-1">
                            <strong>{r.descripcion}</strong>
                            {(r.calorias != null || r.proteinas != null || r.carbohidratos != null || r.porciones) && (
                              <p className="is-size-7 mt-2 mb-0">
                                {r.calorias != null && <span>{r.calorias} kcal</span>}
                                {r.proteinas != null && <span className="ml-2">P: {r.proteinas}g</span>}
                                {r.carbohidratos != null && <span className="ml-2">C: {r.carbohidratos}g</span>}
                                {r.porciones && <span className="ml-2">· {r.porciones}</span>}
                              </p>
                            )}
                            {r.notas && <p className="is-size-7 has-text-grey mt-1 mb-0">— {r.notas}</p>}
                          </div>
                          <button type="button" className="button is-small is-text has-text-grey" onClick={() => eliminar(r.id)} aria-label="Eliminar">×</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}

        <h2 className="title is-6 is-size-7 mb-2">Historial por período</h2>
        <div className="box mb-3 py-3">
          <label className="label is-size-7">Ver período</label>
          <div className="field">
            <div className="control">
              <div className="select is-fullwidth is-small">
                <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                  {PERIODOS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {periodo === 'personalizado' && (
            <div className="columns">
              <div className="column">
                <div className="field">
                  <label className="label is-size-7">Desde</label>
                  <input className="input is-small" type="date" value={desdeCustom} onChange={(e) => setDesdeCustom(e.target.value)} />
                </div>
              </div>
              <div className="column">
                <div className="field">
                  <label className="label is-size-7">Hasta</label>
                  <input className="input is-small" type="date" value={hastaCustom} onChange={(e) => setHastaCustom(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <p className="is-size-7 has-text-grey mt-2 mb-0">
            Mostrando del {desde} al {hasta}
          </p>
        </div>

        {Object.keys(porFechaEnRango).length === 0 ? (
          <div className="box has-text-centered has-text-grey">No hay comidas en este período.</div>
        ) : (
          <ul className="mb-0" style={{ listStyle: 'none', padding: 0 }}>
            {Object.entries(porFechaEnRango)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([fecha, lista]) => {
                const cal = lista.reduce((s, r) => s + (Number(r.calorias) || 0), 0)
                const pro = lista.reduce((s, r) => s + (Number(r.proteinas) || 0), 0)
                const car = lista.reduce((s, r) => s + (Number(r.carbohidratos) || 0), 0)
                return (
                  <li key={fecha} className="mb-4">
                    <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
                      <p className="is-size-7 has-text-grey mb-0" style={{ textTransform: 'capitalize' }}>
                        {formatearFecha(fecha)}
                      </p>
                      <span className="tag is-info is-light is-size-7">
                        {cal || '—'} kcal · P: {pro || '—'}g · C: {car || '—'}g
                      </span>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {lista.map((r) => (
                        <li key={r.id} className="box py-2 px-3 mb-2">
                          <div className="is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
                            <div>
                              <span className="tag is-info is-light mr-2">{r.comida}</span>
                              <span>{r.descripcion}</span>
                              {(r.calorias != null || r.proteinas != null || r.carbohidratos != null || r.porciones) && (
                                <p className="is-size-7 mt-1 mb-0">
                                  {r.calorias != null && `${r.calorias} kcal`}
                                  {r.proteinas != null && ` · P: ${r.proteinas}g`}
                                  {r.carbohidratos != null && ` · C: ${r.carbohidratos}g`}
                                  {r.porciones && ` · ${r.porciones}`}
                                </p>
                              )}
                              {r.notas && <p className="is-size-7 has-text-grey mt-1 mb-0">— {r.notas}</p>}
                            </div>
                            <button type="button" className="button is-small is-text has-text-grey" onClick={() => eliminar(r.id)} aria-label="Eliminar">×</button>
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
