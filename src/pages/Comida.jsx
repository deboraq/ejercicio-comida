import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { getConsejos, buildContextoDia, buildContextoSemana } from '../utils/consejos'
import { formatearFecha, fechaToISO, fechaSoloDia } from '../utils/calorias'
import { REFERENCIA_ALIMENTOS, buscarAlimentos } from '../utils/referenciaComidas'
import { PERIODOS, getRangoPorPeriodo, filtrarPorRango, getUltimosNDias } from '../utils/estadisticas'
import MacroBarCard from '../components/MacroBarCard'
import PageHeader from '../components/PageHeader'
import ConsejosPanel from '../components/ConsejosPanel'

const COMIDAS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena']
const ALIAS_MOMENTO = { Snack: 'Merienda' }
const MOMENTO_ICON = { Desayuno: '☕', Almuerzo: '🍔', Merienda: '🧁', Cena: '🍽️', Otros: '📋' }

function normalizarMomento(comida) {
  if (comida == null || comida === '') return comida
  return ALIAS_MOMENTO[comida] || comida
}

/** Agrupa los registros de un mismo día por momento del día (orden fijo + “Otros”). */
function agruparComidasPorMomento(registrosDia) {
  const bloques = []
  for (const tipo of COMIDAS) {
    const items = registrosDia.filter((r) => normalizarMomento(r.comida) === tipo)
    if (items.length) bloques.push({ tipo, items })
  }
  const otros = registrosDia.filter((r) => {
    const m = normalizarMomento(r.comida)
    return m == null || m === '' || !COMIDAS.includes(m)
  })
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
  if (n === 1) return t
  return `${n} × (${t})`
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

/** Cantidad de porciones: admite medios (0.5), cuartos (0.25), etc. */
function normalizarCantidad(valor, fallback = 1) {
  const n = numeroFlexible(valor)
  if (n == null || n <= 0) return fallback
  return Math.max(0.25, Math.min(99, Math.round(n * 100) / 100))
}

/** Última cantidad válida usada para escalar macros si el campo quedó vacío un momento. */
function cantidadBaseParaEscala(it) {
  const actual = numeroFlexible(it.cantidad)
  if (actual != null && actual > 0) return actual
  const prev = numeroFlexible(it._cantidadPrev)
  return prev != null && prev > 0 ? prev : 1
}

/** Aplica cantidad (admite decimales) y recalcula kcal/P/C desde referencia o por ratio. */
function itemConCantidadAplicada(it, newQ) {
  const q = normalizarCantidad(newQ, 1)
  if (it._macrosPorUnidad) {
    const { cal, pro, car } = it._macrosPorUnidad
    return {
      ...it,
      cantidad: q,
      _cantidadPrev: q,
      calorias: String(Math.round(cal * q)),
      proteinas: String(redondear1(pro * q)),
      carbohidratos: String(redondear1(car * q)),
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
  const [registrosRutina] = useStorage('rutinaPesos', [])
  const [historialMedidas] = useStorage('medidasHistorial', [])
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
    const n = normalizarCantidad(raw, 1)
    const base = { cal: itemRef.calorias, pro: itemRef.proteinas, car: itemRef.carbohidratos }
    const porcionRef = itemRef.porcion || 'porción'
    const nuevo = {
      id: crypto.randomUUID(),
      descripcion: itemRef.nombre,
      cantidad: n,
      _cantidadPrev: n,
      calorias: String(Math.round(base.cal * n)),
      proteinas: String(redondear1(base.pro * n)),
      carbohidratos: String(redondear1(base.car * n)),
      porciones: textoPorcionDesdeRef(porcionRef, n),
      _macrosPorUnidad: base,
      _porcionRef: porcionRef,
    }
    setItems((prev) => [nuevo, ...prev])
    setBusquedaRef('')
  }

  const actualizarItemCantidad = (id, raw) => {
    const s = String(raw).trim().replace(',', '.')
    if (s === '') {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, cantidad: '' } : it)))
      return
    }
    // Permitir escribir "0." / "0,5" a medias
    if (!/^\d*\.?\d*$/.test(s)) return
    if (s.endsWith('.')) {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, cantidad: s } : it)))
      return
    }
    const parsed = Number(s)
    if (!Number.isFinite(parsed)) return
    if (parsed === 0) {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, cantidad: s } : it)))
      return
    }
    const newQ = normalizarCantidad(parsed, 1)
    setItems((prev) => prev.map((it) => (it.id === id ? itemConCantidadAplicada(it, newQ) : it)))
  }

  const blurCantidadItem = (id) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const n = numeroFlexible(it.cantidad)
        if (n != null && n > 0) return itemConCantidadAplicada(it, n)
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
  const grasasHoy = redondear1(hoyRegistros.reduce((s, r) => s + numeroFlexibleO(r.grasas), 0))

  const metaKcal = config.metaCalorias || 2400
  const metaPro = config.metaProteina || 150
  const metaCarb = config.metaCarbohidratos || 250
  const metaGrasa = config.metaGrasa || 70


  const contextoDia = buildContextoDia({
    comidas: registros,
    ejercicios,
    registrosRutina,
    fecha: hoy,
    pesoKg: config?.pesoKg || 70,
    config,
  })
  const contextoSemana = buildContextoSemana({
    comidas: registros,
    ejercicios,
    registrosRutina,
    dias: getUltimosNDias(7),
    pesoKg: config?.pesoKg || 70,
    config,
  })
  const { diarios: consejosDiarios, semanales: consejosSemanales } = getConsejos(
    config?.objetivo,
    contextoDia,
    contextoSemana,
    config,
    { historialMedidas, hoy }
  )

  const puedeGuardar = items.some((it) => it.descripcion.trim())

  const bloquesHoy = agruparComidasPorMomento(hoyRegistros)
  const momentosRegistrados = new Set(bloquesHoy.map((b) => b.tipo))
  const momentosPendientes = COMIDAS.filter((m) => !momentosRegistrados.has(m))

  const scrollHistorial = () => {
    document.getElementById('comida-historial-completo')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="section py-4 comida-page">
      <div className="container app-page-container">
        <PageHeader
          icon="🥗"
          iconTone="green"
          title="Comida"
          subtitle="Resumen del día, registro rápido e historial."
          metrics={[
            `${caloriasHoy || 0} kcal`,
            `${proteinasHoy || 0} g proteína`,
            `${hoyRegistros.length} registros`,
          ]}
        />

        <ConsejosPanel diarios={consejosDiarios} semanales={consejosSemanales} />

        <section className="comida-tu-dia mb-4" aria-label="Resumen del día">
          <h2 className="title is-6 mb-3">Tu día</h2>
          <div className="comida-macro-bars">
            <MacroBarCard label="Calorías" value={caloriasHoy} goal={metaKcal} color="#3b82f6" unit="kcal" />
            <MacroBarCard label="Proteínas" value={proteinasHoy} goal={metaPro} color="#10b981" unit="g" />
            <MacroBarCard label="Carbohidratos" value={carbosHoy} goal={metaCarb} color="#a78bfa" unit="g" />
            <MacroBarCard label="Grasas" value={grasasHoy} goal={metaGrasa} color="#f472b6" unit="g" />
          </div>
        </section>

        <div className="comida-layout">
          <div className="comida-layout-main">
            <div className="box comida-form-card mb-0">
          <h2 className="title is-6 mb-1">Registrar comida</h2>
          <p className="comida-form-subtitle mb-4">Buscá en la base de datos o ingresá manualmente.</p>
          <form onSubmit={guardarComida}>
            <div className="columns is-mobile mb-3">
              <div className="column is-half">
                <label className="ej-form-label mb-1" htmlFor="comida-momento">Momento del día</label>
                <div className="select is-fullwidth">
                  <select id="comida-momento" value={comida} onChange={(e) => setComida(e.target.value)}>
                    {COMIDAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="column is-half">
                <label className="ej-form-label mb-1" htmlFor="comida-fecha">Fecha</label>
                <input id="comida-fecha" className="input" type="date" value={fechaInput} onChange={(e) => setFechaInput(e.target.value)} />
              </div>
            </div>

            <div className="field mb-3">
              <label className="ej-form-label mb-1" htmlFor="comida-buscar">Buscar alimento</label>
              <div className="module-search comida-buscar">
                <span className="module-search-icon" aria-hidden>🔍</span>
                <input
                  id="comida-buscar"
                  type="text"
                  value={busquedaRef}
                  onChange={(e) => setBusquedaRef(e.target.value)}
                  placeholder="Ej: pollo, arroz, manzana..."
                  autoComplete="off"
                />
              </div>
            </div>

            {(items.length === 0 && !busquedaRef.trim()) && (
              <div className="comida-empty-drop mb-3">
                <span className="comida-empty-icon" aria-hidden="true">🍽</span>
                <p className="mb-3">Todavía no agregaste alimentos a esta entrada.</p>
                <div className="comida-empty-actions">
                  <button type="button" className="button is-link" onClick={() => document.getElementById('comida-buscar')?.focus()}>
                    + Buscar
                  </button>
                  <button type="button" className="button is-light" onClick={añadirLineaVacia}>
                    Manual
                  </button>
                </div>
              </div>
            )}
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
            {items.length > 0 && (
              <>
            <p className="is-size-7 has-text-weight-semibold mb-1 mt-3">Ítems a guardar</p>
              {items.map((it) => (
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
                        Cant. (ej. 0.5)
                      </label>
                      <input
                        id={`comida-cant-${it.id}`}
                        className="input is-small"
                        type="number"
                        min="0.25"
                        max="99"
                        step="0.25"
                        inputMode="decimal"
                        value={it.cantidad === '' || it.cantidad == null ? '' : it.cantidad}
                        onChange={(e) => actualizarItem(it.id, 'cantidad', e.target.value)}
                        onBlur={() => blurCantidadItem(it.id)}
                        title="Porciones (podés usar 0.5 = media). Multiplica kcal, P y C"
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
              ))}
              </>
            )}

            {items.length > 0 && (
            <div className="field">
              <button type="button" className="button is-light is-small is-fullwidth mb-2" onClick={añadirLineaVacia}>
                + Añadir otra fila
              </button>
            </div>
            )}

            <div className="field">
              <label className="label is-size-7" htmlFor="comida-notas">Notas (opcional)</label>
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
                <button type="submit" className="button is-link is-fullwidth comida-guardar-btn" disabled={!puedeGuardar}>
                  Guardar en el historial
                </button>
              </div>
            </div>
          </form>
            </div>
          </div>

          <aside className="comida-layout-aside">
            <div className="box comida-hist-hoy-card">
              <div className="comida-hist-hoy-header">
                <h2 className="title is-6 mb-0">Historial de hoy</h2>
                <button type="button" className="comida-hist-ver-todo" onClick={scrollHistorial}>Ver todo</button>
              </div>
              {bloquesHoy.length === 0 && momentosPendientes.length === COMIDAS.length ? (
                <p className="is-size-7 has-text-grey mb-0 mt-3">Todavía no registraste comidas hoy.</p>
              ) : (
                <div className="comida-hist-hoy-list mt-3">
                  {bloquesHoy.map(({ tipo, items: itemsGrupo }) => {
                    const calGrupo = itemsGrupo.reduce((s, r) => s + numeroFlexibleO(r.calorias), 0)
                    return (
                      <div key={tipo} className="comida-hist-hoy-bloque">
                        <div className="comida-hist-hoy-head">
                          <span className={`comida-hist-hoy-icon comida-hist-hoy-icon--${tipo.toLowerCase()}`} aria-hidden>{MOMENTO_ICON[tipo] || '📋'}</span>
                          <div>
                            <span className="comida-hist-hoy-tipo">{tipo}</span>
                          </div>
                        </div>
                        <ul className="comida-hist-hoy-items">
                          {itemsGrupo.map((r) => (
                            <li key={r.id}>
                              <span>{r.descripcion}</span>
                              <span className="comida-hist-hoy-kcal">{r.calorias || '—'} kcal</span>
                            </li>
                          ))}
                        </ul>
                        <p className="comida-hist-hoy-total mb-0">Total: <strong>{calGrupo} kcal</strong></p>
                      </div>
                    )
                  })}
                  {momentosPendientes.map((momento) => (
                    <div key={momento} className="comida-hist-hoy-bloque is-pending">
                      <div className="comida-hist-hoy-head">
                        <span className="comida-hist-hoy-icon is-muted" aria-hidden>{MOMENTO_ICON[momento]}</span>
                        <span className="comida-hist-hoy-tipo is-muted">{momento}</span>
                        <button
                          type="button"
                          className="comida-hist-agregar"
                          onClick={() => setComida(momento)}
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        <div id="comida-historial-completo">
        <h2 className="title is-6 mb-2 mt-2">Historial</h2>
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
      </div>
    </section>
  )
}
