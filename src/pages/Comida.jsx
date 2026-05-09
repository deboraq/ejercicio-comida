import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { getConsejosDelDia } from '../utils/consejos'
import { caloriasEjercicioRegistro, formatearFecha, fechaToISO, fechaSoloDia, getCategoriaTipo } from '../utils/calorias'
import { REFERENCIA_ALIMENTOS, buscarAlimentos } from '../utils/referenciaComidas'
import { PERIODOS, getRangoPorPeriodo, filtrarPorRango } from '../utils/estadisticas'

const COMIDAS = ['Desayuno', 'Almuerzo', 'Cena', 'Snack']

/** Agrupa los registros de un mismo día por momento del día (orden fijo + “Otros”). */
function agruparComidasPorMomento(registrosDia) {
  const bloques = []
  for (const tipo of COMIDAS) {
    const items = registrosDia.filter((r) => r.comida === tipo)
    if (items.length) bloques.push({ tipo, items })
  }
  const otros = registrosDia.filter((r) => r.comida == null || r.comida === '' || !COMIDAS.includes(r.comida))
  if (otros.length) bloques.push({ tipo: 'Otros', items: otros })
  return bloques
}

function crearItemVacio() {
  return {
    id: crypto.randomUUID(),
    descripcion: '',
    cantidad: 1,
    _cantidadPrev: 1,
    calorias: '',
    proteinas: '',
    carbohidratos: '',
    porciones: '',
  }
}

function textoPorcionDesdeRef(porcionRef, n) {
  const t = porcionRef || 'porción'
  return n > 1 ? `${n} × (${t})` : t
}

function numeroFlexible(valor) {
  if (valor == null || valor === '') return null
  const n = Number(String(valor).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function numeroFlexibleO(valor, fallback = 0) {
  const n = numeroFlexible(valor)
  return n == null ? fallback : n
}

function redondear1(n) {
  return Math.round(n * 10) / 10
}

/** Última cantidad válida usada para escalar macros si el campo quedó vacío un momento. */
function cantidadBaseParaEscala(it) {
  if (it.cantidad !== '' && it.cantidad != null && Number(it.cantidad) > 0) return Number(it.cantidad)
  return Math.max(1, it._cantidadPrev ?? 1)
}

/** Aplica cantidad entera 1–99 y recalcula kcal/P/C desde referencia o por ratio. */
function itemConCantidadAplicada(it, newQ) {
  const q = Math.max(1, Math.min(99, Math.round(Number(newQ)) || 1))
  if (it._macrosPorUnidad) {
    const { cal, pro, car } = it._macrosPorUnidad
    return {
      ...it,
      cantidad: q,
      _cantidadPrev: q,
      calorias: String(Math.round(cal * q)),
      proteinas: String(Math.round(pro * q * 10) / 10),
      carbohidratos: String(Math.round(car * q * 10) / 10),
      porciones: it._porcionRef != null ? textoPorcionDesdeRef(it._porcionRef, q) : it.porciones,
    }
  }
  const oldQ = cantidadBaseParaEscala(it)
  const r = q / oldQ
  return {
    ...it,
    cantidad: q,
    _cantidadPrev: q,
    calorias: it.calorias !== '' ? String(Math.round(numeroFlexibleO(it.calorias) * r)) : '',
    proteinas: it.proteinas !== '' ? String(redondear1(numeroFlexibleO(it.proteinas) * r)) : '',
    carbohidratos: it.carbohidratos !== '' ? String(redondear1(numeroFlexibleO(it.carbohidratos) * r)) : '',
  }
}

function ListaComidaAgrupada({ bloques, onEliminar }) {
  if (!bloques.length) return null
  return (
    <>
      {bloques.map(({ tipo, items: itemsGrupo }) => {
        const calGrupo = itemsGrupo.reduce((s, r) => s + numeroFlexibleO(r.calorias), 0)
        return (
          <div key={tipo} className="comida-grupo-bloque">
            <p className="comida-grupo-titulo mb-0">
              <span className={`tag is-light is-size-7 ${tipo === 'Otros' ? 'is-dark' : 'is-info'}`}>{tipo}</span>
              {calGrupo > 0 && (
                <span className="is-size-7 has-text-grey ml-1">{calGrupo} kcal en este momento</span>
              )}
            </p>
            <ul className="comida-lista-dia">
              {itemsGrupo.map((r) => (
                <li key={r.id} className="comida-linea-dia">
                  <div className="comida-linea-dia-inner">
                    <div className="is-flex-grow-1" style={{ minWidth: 0 }}>
                      <p className="comida-linea-nombre mb-0">{r.descripcion}</p>
                      {(r.calorias != null || r.proteinas != null || r.carbohidratos != null || r.porciones) && (
                        <div className="comida-macros comida-macros--linea">
                          {r.calorias != null && <span className="tag is-light is-size-7">{r.calorias} kcal</span>}
                          {r.proteinas != null && <span className="tag is-success is-light is-size-7">P {r.proteinas} g</span>}
                          {r.carbohidratos != null && <span className="tag is-warning is-light is-size-7">C {r.carbohidratos} g</span>}
                          {r.porciones && <span className="is-size-7 has-text-grey ml-1">{r.porciones}</span>}
                        </div>
                      )}
                      {r.notas && <p className="is-size-7 has-text-grey mt-1 mb-0">Nota: {r.notas}</p>}
                    </div>
                    <button type="button" className="button is-small is-text comida-linea-eliminar" onClick={() => onEliminar(r.id)} aria-label="Eliminar">
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </>
  )
}

export default function Comida() {
  const [registros, setRegistros] = useStorage('comida', [])
  const [ejercicios] = useStorage('ejercicios', [])
  const [config] = useStorage('config', { objetivo: 'mantener_peso', pesoKg: 70 })
  const [comida, setComida] = useState('Desayuno')
  const [fechaInput, setFechaInput] = useState(() => fechaToISO(new Date()))
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState([])
  const [busquedaRef, setBusquedaRef] = useState('')
  const [cantidadPorciones, setCantidadPorciones] = useState('1')
  const [periodo, setPeriodo] = useState('semana')
  const [desdeCustom, setDesdeCustom] = useState('')
  const [hastaCustom, setHastaCustom] = useState('')

  const resultadosBusqueda = buscarAlimentos(busquedaRef)
  const hoy = fechaToISO(new Date())
  const { desde, hasta } = getRangoPorPeriodo(periodo, desdeCustom, hastaCustom)
  const registrosEnRango = filtrarPorRango(registros, desde, hasta)
  const porFechaEnRango = registrosEnRango.reduce((acc, r) => {
    if (!acc[r.fecha]) acc[r.fecha] = []
    acc[r.fecha].push(r)
    return acc
  }, {})

  const añadirDesdeReferencia = (itemRef, cantidad = cantidadPorciones) => {
    const raw = cantidad === '' || cantidad == null ? String(cantidadPorciones) : String(cantidad)
    const n = Math.max(1, Math.min(99, parseInt(raw.trim(), 10) || 1))
    const base = { cal: itemRef.calorias, pro: itemRef.proteinas, car: itemRef.carbohidratos }
    const porcionRef = itemRef.porcion || 'porción'
    const nuevo = {
      id: crypto.randomUUID(),
      descripcion: itemRef.nombre,
      cantidad: n,
      _cantidadPrev: n,
      calorias: String(Math.round(base.cal * n)),
      proteinas: String(Math.round(base.pro * n * 10) / 10),
      carbohidratos: String(Math.round(base.car * n * 10) / 10),
      porciones: textoPorcionDesdeRef(porcionRef, n),
      _macrosPorUnidad: base,
      _porcionRef: porcionRef,
    }
    setItems((prev) => [nuevo, ...prev])
    setBusquedaRef('')
  }

  const actualizarItemCantidad = (id, raw) => {
    const s = String(raw).trim()
    if (s === '') {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, cantidad: '' } : it)))
      return
    }
    const parsed = parseInt(s, 10)
    if (!Number.isFinite(parsed)) return
    const newQ = Math.max(1, Math.min(99, parsed))
    setItems((prev) => prev.map((it) => (it.id === id ? itemConCantidadAplicada(it, newQ) : it)))
  }

  const blurCantidadItem = (id) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        if (it.cantidad !== '' && it.cantidad != null) return it
        return itemConCantidadAplicada(it, it._cantidadPrev ?? 1)
      })
    )
  }

  const actualizarItemMacro = (id, field, value) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        if (value === '') {
          return { ...it, [field]: '', _macrosPorUnidad: undefined, _porcionRef: undefined }
        }
        const q = cantidadBaseParaEscala(it)
        const num = numeroFlexible(value)
        if (!Number.isFinite(num)) {
          return { ...it, [field]: value }
        }
        if (it._macrosPorUnidad) {
          const m = { ...it._macrosPorUnidad }
          if (field === 'calorias') m.cal = num / q
          if (field === 'proteinas') m.pro = num / q
          if (field === 'carbohidratos') m.car = num / q
          return {
            ...it,
            _macrosPorUnidad: m,
            calorias: String(Math.round(m.cal * q)),
            proteinas: String(redondear1(m.pro * q)),
            carbohidratos: String(redondear1(m.car * q)),
          }
        }
        return { ...it, [field]: value, _macrosPorUnidad: undefined, _porcionRef: undefined }
      })
    )
  }

  const actualizarItem = (id, field, value) => {
    if (field === 'cantidad') {
      actualizarItemCantidad(id, value)
      return
    }
    if (field === 'calorias' || field === 'proteinas' || field === 'carbohidratos') {
      actualizarItemMacro(id, field, value)
      return
    }
    if (field === 'porciones') {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, porciones: value, _porcionRef: undefined } : it)))
      return
    }
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }

  const quitarItem = (id) => {
    setItems((prev) => (prev.length <= 1 ? [] : prev.filter((it) => it.id !== id)))
  }

  const añadirLineaVacia = () => {
    setItems((prev) => [...prev, crearItemVacio()])
  }

  const totalesItems = items.reduce(
    (acc, it) => ({
      cal: acc.cal + numeroFlexibleO(it.calorias),
      pro: redondear1(acc.pro + numeroFlexibleO(it.proteinas)),
      car: redondear1(acc.car + numeroFlexibleO(it.carbohidratos)),
    }),
    { cal: 0, pro: 0, car: 0 }
  )

  const guardarComida = (e) => {
    e.preventDefault()
    const fecha = fechaInput || hoy
    const aGuardar = items
      .filter((it) => it.descripcion.trim())
      .map((it) => (it.cantidad === '' || it.cantidad == null ? itemConCantidadAplicada(it, it._cantidadPrev ?? 1) : it))
    if (aGuardar.length === 0) return
    const nuevos = aGuardar.map((it) => ({
      id: crypto.randomUUID(),
      comida,
      descripcion: it.descripcion.trim(),
      calorias: numeroFlexible(it.calorias) ?? undefined,
      proteinas: numeroFlexible(it.proteinas) ?? undefined,
      carbohidratos: numeroFlexible(it.carbohidratos) ?? undefined,
      porciones: it.porciones?.trim() || undefined,
      notas: notas.trim(),
      fecha,
    }))
    setRegistros([...nuevos, ...registros])
    setItems([])
    setNotas('')
    setFechaInput(hoy)
  }

  const eliminar = (id) => {
    setRegistros(registros.filter((r) => r.id !== id))
  }

  const hoyRegistros = registros.filter((r) => fechaSoloDia(r.fecha) === hoy)
  const caloriasHoy = hoyRegistros.reduce((s, r) => s + numeroFlexibleO(r.calorias), 0)
  const proteinasHoy = redondear1(hoyRegistros.reduce((s, r) => s + numeroFlexibleO(r.proteinas), 0))
  const carbosHoy = redondear1(hoyRegistros.reduce((s, r) => s + numeroFlexibleO(r.carbohidratos), 0))

  const ejerciciosHoy = ejercicios.filter((ex) => fechaSoloDia(ex.fecha) === hoy)
  const ejerciciosPorTipo = ejerciciosHoy.reduce((acc, ex) => {
    const cat = getCategoriaTipo(ex.tipo)
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})
  const caloriasQuemadasHoy = ejerciciosHoy.reduce(
    (s, ex) => s + caloriasEjercicioRegistro(ex, config?.pesoKg || 70),
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

  const puedeGuardar = items.some((it) => it.descripcion.trim())

  return (
    <section className="section py-4 comida-page">
      <div className="container" style={{ maxWidth: '560px' }}>
        <header className="app-page-hero mb-4">
          <div className="app-page-hero-icon" aria-hidden="true">🥗</div>
          <h1 className="title is-5 mb-2">Comida</h1>
          <p className="subtitle has-text-grey mb-0">Resumen del día, registro rápido e historial.</p>
          <div className="app-hero-metrics">
            <span><strong>{caloriasHoy || 0}</strong> kcal</span>
            <span><strong>{proteinasHoy || 0}</strong> g proteína</span>
            <span><strong>{hoyRegistros.length}</strong> registros</span>
          </div>
        </header>

        {consejos.length > 0 && (
          <div className="mb-4">
            {consejos.map((c, i) => (
              <article key={i} className="message is-info is-light mb-2 py-3 px-3">
                <div className="message-body py-0">{c.texto}</div>
              </article>
            ))}
          </div>
        )}

        <div className="box comida-hoy-resumen mb-4">
          <div className="is-flex is-justify-content-space-between is-align-items-center mb-3">
            <h2 className="title is-6 mb-0">Tu día</h2>
            <span className="tag is-rounded is-light has-text-weight-medium">{formatearFecha(hoy)}</span>
          </div>
          <div className="columns is-mobile is-multiline comida-stats-grid mb-0">
            <div className="column is-half">
              <div className="comida-stat-tile comida-stat-kcal">
                <p className="comida-stat-label">Calorías</p>
                <p className="comida-stat-value">{caloriasHoy || 0}</p>
                <p className="comida-stat-unit">kcal</p>
              </div>
            </div>
            <div className="column is-half">
              <div className="comida-stat-tile comida-stat-pro">
                <p className="comida-stat-label">Proteínas</p>
                <p className="comida-stat-value">{proteinasHoy || 0}</p>
                <p className="comida-stat-unit">g</p>
              </div>
            </div>
            <div className="column is-half">
              <div className="comida-stat-tile comida-stat-car">
                <p className="comida-stat-label">Carbohidratos</p>
                <p className="comida-stat-value">{carbosHoy || 0}</p>
                <p className="comida-stat-unit">g</p>
              </div>
            </div>
            <div className="column is-half">
              <div className="comida-stat-tile comida-stat-count">
                <p className="comida-stat-label">Registros</p>
                <p className="comida-stat-value">{hoyRegistros.length}</p>
                <p className="comida-stat-unit">hoy</p>
              </div>
            </div>
          </div>
          {(config.metaCalorias || config.metaProteina) && (
            <div className="mt-4 pt-4 comida-meta-borde">
              <p className="is-size-7 has-text-grey mb-2">Progreso hacia tu meta (Config)</p>
              {config.metaCalorias && (
                <div className="mb-3">
                  <p className="is-size-7 mb-1">Calorías: {caloriasHoy || 0} / {config.metaCalorias} kcal</p>
                  <progress className="progress is-info is-small" value={Math.min(Number(caloriasHoy) || 0, Number(config.metaCalorias))} max={config.metaCalorias} />
                </div>
              )}
              {config.metaProteina && (
                <div>
                  <p className="is-size-7 mb-1">Proteína: {proteinasHoy || 0} / {config.metaProteina} g</p>
                  <progress className="progress is-success is-small" value={Math.min(Number(proteinasHoy) || 0, Number(config.metaProteina))} max={config.metaProteina} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="box comida-form-card mb-4">
          <h2 className="title is-6 mb-1">Registrar</h2>
          <p className="is-size-7 has-text-grey mb-3">Elegí el momento del día, la fecha si no es hoy, buscá en la lista o cargá a mano.</p>
          <form onSubmit={guardarComida}>
            <div className="field mb-3">
              <label className="label is-size-7 mb-2">Momento del día</label>
              <div className="buttons comida-moment-tabs has-addons is-flex-wrap-wrap">
                {COMIDAS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`button is-small ${comida === c ? 'is-link' : 'is-light'}`}
                    onClick={() => setComida(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="label is-size-7" htmlFor="comida-fecha">Fecha del registro</label>
              <div className="control">
                <input id="comida-fecha" className="input is-small" type="date" value={fechaInput} onChange={(e) => setFechaInput(e.target.value)} />
              </div>
            </div>

            <div className="field mb-0">
              <div className="columns is-mobile is-variable is-2 mb-0">
                <div className="column is-two-thirds">
                  <label className="label is-size-7 mb-1" htmlFor="comida-buscar">Buscar en referencia</label>
                  <div className="control has-icons-left">
                    <input
                      id="comida-buscar"
                      className="input is-small"
                      type="text"
                      value={busquedaRef}
                      onChange={(e) => setBusquedaRef(e.target.value)}
                      placeholder="Ej: milanesa, arroz, yogur…"
                      autoComplete="off"
                    />
                    <span className="icon is-small is-left">🔍</span>
                  </div>
                </div>
                <div className="column">
                  <label className="label is-size-7 has-text-grey mb-1" htmlFor="comida-cant-porciones">Cant.</label>
                  <div className="control">
                    <input
                      id="comida-cant-porciones"
                      className="input is-small"
                      type="number"
                      min="1"
                      max="99"
                      value={cantidadPorciones}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === '') {
                          setCantidadPorciones('')
                          return
                        }
                        const n = parseInt(v, 10)
                        if (!Number.isFinite(n)) return
                        setCantidadPorciones(String(Math.max(1, Math.min(99, n))))
                      }}
                      onBlur={() => {
                        if (cantidadPorciones === '') setCantidadPorciones('1')
                      }}
                      title="Solo al tocar un resultado de la lista: cuántas porciones base traer a la fila (luego podés cambiar Cant. en cada ítem abajo)"
                    />
                  </div>
                </div>
              </div>
              <p className="is-size-7 has-text-grey mt-1 mb-0">
                Cada resultado es <span className="has-text-weight-semibold">una</span> unidad base (1 taco, 1 pieza de sushi, 1 triángulo de pizza, 100 g de carne en Proteínas, etc.). Podés usar la <span className="has-text-weight-semibold">Cant.</span> de arriba al elegir de la lista, o ajustar la cantidad en cada fila más abajo.
              </p>
              {busquedaRef.trim().length >= 1 && (
                <div className="box mt-2 p-2 dropdown-panel dropdown-panel-comida comida-resultados" style={{ maxHeight: 'min(45vh, 260px)', overflowY: 'auto' }}>
                  <ul className="comida-resultados-lista">
                    {resultadosBusqueda.length === 0 ? (
                      <li className="is-size-7 has-text-grey py-2">Sin resultados. Probá otra palabra o cargá abajo a mano.</li>
                    ) : (
                      resultadosBusqueda.map((a) => (
                        <li key={a._idx}>
                          <button type="button" className="button is-fullwidth is-small comida-ref-btn" onClick={() => añadirDesdeReferencia(a)}>
                            <span className="comida-ref-btn-main">
                              <span className="comida-ref-nombre">{a.nombre}</span>
                              <span className="comida-ref-cat is-size-7">{a.categoria}</span>
                            </span>
                            <span className="comida-ref-macros">
                              <span className="tag is-info is-light is-size-7">{a.calorias} kcal</span>
                              <span className="tag is-success is-light is-size-7">P {a.proteinas}</span>
                              <span className="tag is-warning is-light is-size-7">C {a.carbohidratos}</span>
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            <p className="is-size-7 has-text-weight-semibold mb-1">Ítems a guardar (uno o varios)</p>
            <p className="is-size-7 has-text-grey mb-2">
              En cada fila podés cambiar <span className="has-text-weight-semibold">Cant.</span> abajo: recalcula kcal, P y C (si venís de la referencia, mantiene la porción base; si cargaste a mano, escala los totales).
            </p>
            {items.length === 0 ? (
              <div className="comida-vacio-cta mb-3">
                <p className="is-size-7 has-text-grey mb-2">Todavía no agregaste alimentos a esta entrada.</p>
                <button type="button" className="button is-light is-small" onClick={añadirLineaVacia}>
                  + Añadir fila manual
                </button>
              </div>
            ) : (
              items.map((it) => (
                <div key={it.id} className="comida-item-editor mb-3">
                  <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
                    <span className="is-size-7 has-text-grey">Alimento</span>
                    <button type="button" className="button is-small is-text has-text-grey py-0" onClick={() => quitarItem(it.id)} aria-label="Quitar fila">
                      Quitar
                    </button>
                  </div>
                  <div className="field mb-2">
                    <div className="control">
                      <input
                        className="input is-small"
                        type="text"
                        value={it.descripcion}
                        onChange={(e) => actualizarItem(it.id, 'descripcion', e.target.value)}
                        placeholder="Nombre del alimento"
                      />
                    </div>
                  </div>
                  <div className="comida-item-macros-grid">
                    <div className="comida-item-macro-cell">
                      <label className="is-size-7 has-text-grey comida-item-macro-label" htmlFor={`comida-cant-${it.id}`}>
                        Cant.
                      </label>
                      <input
                        id={`comida-cant-${it.id}`}
                        className="input is-small"
                        type="number"
                        min="1"
                        max="99"
                        inputMode="numeric"
                        value={it.cantidad === '' || it.cantidad == null ? '' : it.cantidad}
                        onChange={(e) => actualizarItem(it.id, 'cantidad', e.target.value)}
                        onBlur={() => blurCantidadItem(it.id)}
                        title="Porciones base de esta fila (multiplica kcal, P y C desde la referencia, o escala lo cargado a mano)"
                      />
                    </div>
                    <div className="comida-item-macro-cell">
                      <label className="is-size-7 has-text-grey comida-item-macro-label" htmlFor={`comida-kcal-${it.id}`}>
                        kcal
                      </label>
                      <input
                        id={`comida-kcal-${it.id}`}
                        className="input is-small"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={it.calorias}
                        onChange={(e) => actualizarItem(it.id, 'calorias', e.target.value)}
                      />
                    </div>
                    <div className="comida-item-macro-cell">
                      <label className="is-size-7 has-text-grey comida-item-macro-label" htmlFor={`comida-prot-${it.id}`}>
                        Prot. (g)
                      </label>
                      <input
                        id={`comida-prot-${it.id}`}
                        className="input is-small"
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={it.proteinas}
                        onChange={(e) => actualizarItem(it.id, 'proteinas', e.target.value)}
                      />
                    </div>
                    <div className="comida-item-macro-cell">
                      <label className="is-size-7 has-text-grey comida-item-macro-label" htmlFor={`comida-carb-${it.id}`}>
                        Carb. (g)
                      </label>
                      <input
                        id={`comida-carb-${it.id}`}
                        className="input is-small"
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={it.carbohidratos}
                        onChange={(e) => actualizarItem(it.id, 'carbohidratos', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="field mb-0 mt-2">
                    <label className="is-size-7 has-text-grey is-block mb-1" htmlFor={`comida-porc-${it.id}`}>
                      Porción (texto libre)
                    </label>
                    <input
                      id={`comida-porc-${it.id}`}
                      className="input is-small"
                      type="text"
                      placeholder="Ej: 1 taza, 2 rebanadas…"
                      value={it.porciones}
                      onChange={(e) => actualizarItem(it.id, 'porciones', e.target.value)}
                    />
                  </div>
                </div>
              ))
            )}

            <div className="field">
              <button type="button" className="button is-light is-small is-fullwidth mb-2" onClick={añadirLineaVacia}>
                + Añadir otra fila
              </button>
            </div>

            <div className="field">
              <label className="label is-size-7" htmlFor="comida-notas">Notas (opcional, aplican a todo el guardado)</label>
              <div className="control">
                <input id="comida-notas" className="input is-small" type="text" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: comida en restaurante, hambre…" />
              </div>
            </div>

            {puedeGuardar && (
              <div className="comida-total-bar notification is-light py-3 mb-3">
                <p className="is-size-7 has-text-grey mb-1">Total de esta entrada</p>
                <p className="title is-6 mb-0">
                  <span className="has-text-info">{totalesItems.cal}</span> kcal
                  <span className="mx-2 has-text-grey">·</span>
                  <span className="has-text-success">P {totalesItems.pro} g</span>
                  <span className="mx-2 has-text-grey">·</span>
                  <span className="has-text-warning">C {totalesItems.car} g</span>
                </p>
              </div>
            )}

            <div className="field mb-0">
              <div className="control">
                <button type="submit" className="button is-link is-fullwidth" disabled={!puedeGuardar}>
                  Guardar en el historial
                </button>
              </div>
            </div>
          </form>
        </div>

        <h2 className="title is-6 mb-2">Historial</h2>
        <div className="box comida-filtro-periodo mb-3 py-3">
          <label className="label is-size-7 mb-2">Período</label>
          <div className="field mb-0">
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
            <div className="columns is-mobile mt-2 mb-0">
              <div className="column">
                <label className="label is-size-7">Desde</label>
                <input className="input is-small" type="date" value={desdeCustom} onChange={(e) => setDesdeCustom(e.target.value)} />
              </div>
              <div className="column">
                <label className="label is-size-7">Hasta</label>
                <input className="input is-small" type="date" value={hastaCustom} onChange={(e) => setHastaCustom(e.target.value)} />
              </div>
            </div>
          )}
          <p className="is-size-7 has-text-grey mt-2 mb-0">Del {desde} al {hasta}</p>
        </div>

        {Object.keys(porFechaEnRango).length === 0 ? (
          <div className="box has-text-centered has-text-grey py-4 mb-0">No hay comidas en este período.</div>
        ) : (
          <ul className="comida-historial-lista mb-0">
            {Object.entries(porFechaEnRango)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([fecha, lista]) => {
                const cal = lista.reduce((s, r) => s + numeroFlexibleO(r.calorias), 0)
                const pro = redondear1(lista.reduce((s, r) => s + numeroFlexibleO(r.proteinas), 0))
                const car = redondear1(lista.reduce((s, r) => s + numeroFlexibleO(r.carbohidratos), 0))
                return (
                  <li key={fecha} className="comida-hist-dia">
                    <div className="is-flex is-justify-content-space-between is-align-items-center comida-hist-dia-cabecera is-flex-wrap-wrap">
                      <p className="title is-6 mb-0 comida-hist-fecha" style={{ textTransform: 'capitalize' }}>
                        {formatearFecha(fecha)}
                      </p>
                      <span className="tag is-info is-light is-size-7 comida-hist-resumen">
                        {cal || '—'} kcal · P {pro || '—'} · C {car || '—'}
                      </span>
                    </div>
                    <div className="comida-hist-grupos-dia">
                      <ListaComidaAgrupada bloques={agruparComidasPorMomento(lista)} onEliminar={eliminar} />
                    </div>
                  </li>
                )
              })}
          </ul>
        )}
      </div>
    </section>
  )
}
