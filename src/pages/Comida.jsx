import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { getConsejos, buildContextoDia, buildContextoSemana } from '../utils/consejos'
import { formatearFecha, fechaToISO, fechaSoloDia } from '../utils/calorias'
import { REFERENCIA_ALIMENTOS, buscarAlimentos } from '../utils/referenciaComidas'
import { PERIODOS, getRangoPorPeriodo, filtrarPorRango, getUltimosNDias, getRachaDias } from '../utils/estadisticas'
import ComidaTitanium from '../components/ComidaTitanium'

const COMIDAS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena']
const ALIAS_MOMENTO = { Snack: 'Merienda' }
const MOMENTO_ICON = { Desayuno: '☕', Almuerzo: '🥗', Merienda: '🧁', Cena: '🍽️', Otros: '📋' }

function formatearHoraRegistro(date = new Date()) {
  const h = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')
  const suf = h >= 12 ? 'PM' : 'AM'
  return `${String(h).padStart(2, '0')}:${m} ${suf}`
}

function buscarReferenciaPorNombre(nombre) {
  if (!nombre) return null
  const exact = REFERENCIA_ALIMENTOS.find((a) => a.nombre === nombre)
  if (exact) return exact
  const low = nombre.toLowerCase()
  return REFERENCIA_ALIMENTOS.find((a) => {
    const n = a.nombre.toLowerCase()
    return low.includes(n) || n.includes(low)
  }) || null
}

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
    grasas: '',
    porciones: '',
  }
}

function textoPorcionDesdeRef(porcionRef, n) {
  const t = porcionRef || 'porción'
  if (n === 1) return t
  return `${n} × (${t})`
}

function grasasDesdeReferencia(itemRef) {
  if (itemRef.grasas != null && Number.isFinite(Number(itemRef.grasas))) {
    return Number(itemRef.grasas)
  }
  return Math.max(0, Math.round(((itemRef.calorias - itemRef.proteinas * 4 - itemRef.carbohidratos * 4) / 9) * 10) / 10)
}

function buildItemDesdeReferencia(itemRef, cantidad) {
  const n = normalizarCantidad(cantidad, 1)
  const gra = grasasDesdeReferencia(itemRef)
  const base = { cal: itemRef.calorias, pro: itemRef.proteinas, car: itemRef.carbohidratos, gra }
  const porcionRef = itemRef.porcion || 'porción'
  return {
    id: crypto.randomUUID(),
    descripcion: itemRef.nombre,
    cantidad: n,
    _cantidadPrev: n,
    calorias: String(Math.round(base.cal * n)),
    proteinas: String(redondear1(base.pro * n)),
    carbohidratos: String(redondear1(base.car * n)),
    grasas: String(redondear1(base.gra * n)),
    porciones: textoPorcionDesdeRef(porcionRef, n),
    _macrosPorUnidad: base,
    _porcionRef: porcionRef,
    _categoria: itemRef.categoria || undefined,
  }
}

function previewReferencia(itemRef, cantidad) {
  if (!itemRef) return null
  const n = normalizarCantidad(cantidad, 1)
  const gra = grasasDesdeReferencia(itemRef)
  return {
    cal: Math.round(itemRef.calorias * n),
    pro: redondear1(itemRef.proteinas * n),
    car: redondear1(itemRef.carbohidratos * n),
    gra: redondear1(gra * n),
    porcion: textoPorcionDesdeRef(itemRef.porcion || 'porción', n),
  }
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

/** Aplica cantidad (admite decimales) y recalcula kcal/P/C/G desde referencia o por ratio. */
function itemConCantidadAplicada(it, newQ) {
  const q = normalizarCantidad(newQ, 1)
  if (it._macrosPorUnidad) {
    const { cal, pro, car, gra } = it._macrosPorUnidad
    return {
      ...it,
      cantidad: q,
      _cantidadPrev: q,
      calorias: String(Math.round(cal * q)),
      proteinas: String(redondear1(pro * q)),
      carbohidratos: String(redondear1(car * q)),
      grasas: gra != null ? String(redondear1(gra * q)) : it.grasas,
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
    grasas: it.grasas !== '' && it.grasas != null ? String(redondear1(numeroFlexibleO(it.grasas) * r)) : it.grasas,
  }
}

function ListaComidaAgrupada({ bloques, onEliminar, onEditar }) {
  if (!bloques.length) return null
  return (
    <div className="cd-hist-grupos">
      {bloques.map(({ tipo, items: itemsGrupo }) => {
        const calGrupo = itemsGrupo.reduce((s, r) => s + numeroFlexibleO(r.calorias), 0)
        return (
          <div key={tipo} className="cd-hist-grupo">
            <p className="cd-hist-grupo-head mb-0">
              <span className="cd-hist-grupo-badge">{tipo}</span>
              {calGrupo > 0 && (
                <span className="cd-hist-grupo-kcal">{Math.round(calGrupo)} kcal en este momento</span>
              )}
            </p>
            <ul className="cd-hist-items mb-0">
              {itemsGrupo.map((r) => (
                <li key={r.id} className="cd-hist-item-card">
                  <div className="cd-hist-item-main">
                    <p className="cd-hist-item-nombre mb-0">{r.descripcion}</p>
                    {(r.calorias != null || r.proteinas != null || r.carbohidratos != null || r.grasas != null) && (
                      <div className="cd-hist-item-pills">
                        {r.calorias != null && (
                          <span className="cd-pill cd-pill--kcal cd-pill--sm">
                            <span className="cd-pill-val">{Math.round(numeroFlexibleO(r.calorias))} kcal</span>
                          </span>
                        )}
                        {r.proteinas != null && (
                          <span className="cd-pill cd-pill--p cd-pill--sm">
                            <span className="cd-pill-lbl">P</span>
                            <span className="cd-pill-val">{r.proteinas} g</span>
                          </span>
                        )}
                        {r.carbohidratos != null && (
                          <span className="cd-pill cd-pill--c cd-pill--sm">
                            <span className="cd-pill-lbl">C</span>
                            <span className="cd-pill-val">{r.carbohidratos} g</span>
                          </span>
                        )}
                        {r.grasas != null && (
                          <span className="cd-pill cd-pill--g cd-pill--sm">
                            <span className="cd-pill-lbl">G</span>
                            <span className="cd-pill-val">{r.grasas} g</span>
                          </span>
                        )}
                      </div>
                    )}
                    {r.porciones && <p className="cd-hist-item-porcion mb-0">{r.porciones}</p>}
                    {r.notas && <p className="cd-hist-item-nota mb-0">Nota: {r.notas}</p>}
                  </div>
                  <div className="cd-hist-item-actions">
                    {onEditar && (
                      <button type="button" className="cd-hist-item-btn" onClick={() => onEditar(r)} aria-label="Editar">
                        ✎
                      </button>
                    )}
                    <button type="button" className="cd-hist-item-btn cd-hist-item-btn--del" onClick={() => onEliminar(r.id)} aria-label="Eliminar">
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
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
  const [referenciaActiva, setReferenciaActiva] = useState(null)
  const [cantidadPorciones, setCantidadPorciones] = useState('1')
  const [hidratacionStore, setHidratacionStore] = useStorage('hidratacionDia', { fecha: '', vasos: 0 })
  const [periodo, setPeriodo] = useState('15_dias')
  const [desdeCustom, setDesdeCustom] = useState('')
  const [hastaCustom, setHastaCustom] = useState('')
  const [vistaComida, setVistaComida] = useState('hoy')
  const [historialMostrado, setHistorialMostrado] = useState(true)
  const [diasExpandidos, setDiasExpandidos] = useState(() => new Set())

  const resultadosBusqueda = buscarAlimentos(busquedaRef)
  const hoy = fechaToISO(new Date())
  const { desde, hasta } = getRangoPorPeriodo(periodo, desdeCustom, hastaCustom)
  const registrosEnRango = filtrarPorRango(registros, desde, hasta)
  const porFechaEnRango = registrosEnRango.reduce((acc, r) => {
    const f = fechaSoloDia(r.fecha)
    if (!acc[f]) acc[f] = []
    acc[f].push(r)
    return acc
  }, {})

  const añadirDesdeReferencia = (itemRef, cantidad = '1') => {
    const n = normalizarCantidad(cantidad === '' || cantidad == null ? cantidadPorciones : cantidad, 1)
    setReferenciaActiva(itemRef)
    setItems([buildItemDesdeReferencia(itemRef, n)])
    setCantidadPorciones(String(n))
  }

  const seleccionarReferencia = (itemRef) => {
    setReferenciaActiva(itemRef)
    setItems([])
    setBusquedaRef('')
    setCantidadPorciones('1')
  }

  const limpiarSeleccion = () => {
    setReferenciaActiva(null)
    setItems([])
    setCantidadPorciones('1')
  }

  const cambiarBusqueda = (value) => {
    setBusquedaRef(value)
    if (value.trim() && referenciaActiva) {
      setReferenciaActiva(null)
      setItems([])
    }
  }

  const recalcularItemsPorCantidad = (raw) => {
    const s = String(raw).trim().replace(',', '.')
    if (s === '' || s.endsWith('.')) return
    const parsed = Number(s)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    const n = normalizarCantidad(parsed, 1)
    setItems((prev) => prev.map((it) => itemConCantidadAplicada(it, n)))
  }

  const cambiarCantidadPorciones = (raw) => {
    const s = String(raw)
    setCantidadPorciones(s)
    recalcularItemsPorCantidad(s)
    if (referenciaActiva && items.length === 0) {
      const n = normalizarCantidad(s, 1)
      if (s !== '' && !s.endsWith('.')) {
        setItems([buildItemDesdeReferencia(referenciaActiva, n)])
      }
    }
  }

  const blurCantidadPorciones = () => {
    const n = normalizarCantidad(cantidadPorciones, 1)
    setCantidadPorciones(String(n))
    setItems((prev) => {
      if (prev.length) return prev.map((it) => itemConCantidadAplicada(it, n))
      if (referenciaActiva) return [buildItemDesdeReferencia(referenciaActiva, n)]
      return prev
    })
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
          if (field === 'grasas') m.gra = num / q
          return {
            ...it,
            _macrosPorUnidad: m,
            calorias: String(Math.round(m.cal * q)),
            proteinas: String(redondear1(m.pro * q)),
            carbohidratos: String(redondear1(m.car * q)),
            grasas: m.gra != null ? String(redondear1(m.gra * q)) : '',
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
    if (field === 'calorias' || field === 'proteinas' || field === 'carbohidratos' || field === 'grasas') {
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
      gra: redondear1(acc.gra + numeroFlexibleO(it.grasas)),
    }),
    { cal: 0, pro: 0, car: 0, gra: 0 }
  )

  const guardarComida = (e) => {
    e.preventDefault()
    let aGuardar = items
      .filter((it) => it.descripcion.trim())
      .map((it) => (it.cantidad === '' || it.cantidad == null ? itemConCantidadAplicada(it, it._cantidadPrev ?? 1) : it))
    if (aGuardar.length === 0 && referenciaActiva) {
      aGuardar = [buildItemDesdeReferencia(referenciaActiva, cantidadPorciones)]
    }
    if (aGuardar.length === 0) return
    const fecha = fechaInput || hoy
    const hora = formatearHoraRegistro(new Date())
    const nuevos = aGuardar.map((it) => {
      const ref = buscarReferenciaPorNombre(it.descripcion.trim())
      return {
        id: crypto.randomUUID(),
        comida,
        descripcion: it.descripcion.trim(),
        calorias: numeroFlexible(it.calorias) ?? undefined,
        proteinas: numeroFlexible(it.proteinas) ?? undefined,
        carbohidratos: numeroFlexible(it.carbohidratos) ?? undefined,
        grasas: numeroFlexible(it.grasas) ?? undefined,
        porciones: it.porciones?.trim() || undefined,
        categoria: it._categoria || referenciaActiva?.categoria || ref?.categoria || undefined,
        hora,
        notas: notas.trim(),
        fecha,
      }
    })
    setRegistros([...nuevos, ...registros])
    setItems([])
    setReferenciaActiva(null)
    setNotas('')
    setBusquedaRef('')
    setCantidadPorciones('1')
    setComida('Desayuno')
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

  const puedeGuardar = referenciaActiva != null || items.some((it) => it.descripcion.trim())

  const previewSeleccion = previewReferencia(referenciaActiva, cantidadPorciones)

  const cambiarVistaComida = (vista) => {
    setVistaComida(vista)
    if (vista === 'historial') {
      setHistorialMostrado(true)
      const first = Object.entries(porFechaEnRango).sort(([a], [b]) => b.localeCompare(a))[0]?.[0]
      setDiasExpandidos(first ? new Set([first]) : new Set())
    }
  }

  const consultarHistorial = (e) => {
    e?.preventDefault?.()
    setHistorialMostrado(true)
    setDiasExpandidos(new Set())
  }

  const editarRegistro = (r) => {
    setVistaComida('hoy')
    setComida(normalizarMomento(r.comida) || 'Desayuno')
    setNotas(r.notas || '')
    const ref = buscarReferenciaPorNombre(r.descripcion)
    if (ref) {
      añadirDesdeReferencia(ref, '1')
      setBusquedaRef('')
    } else {
      setReferenciaActiva(null)
      setItems([{
        id: crypto.randomUUID(),
        descripcion: r.descripcion,
        cantidad: 1,
        _cantidadPrev: 1,
        calorias: r.calorias != null ? String(r.calorias) : '',
        proteinas: r.proteinas != null ? String(r.proteinas) : '',
        carbohidratos: r.carbohidratos != null ? String(r.carbohidratos) : '',
        grasas: r.grasas != null ? String(r.grasas) : '',
        porciones: r.porciones || '',
      }])
    }
    requestAnimationFrame(() => document.getElementById('cd-buscar')?.focus())
  }

  const toggleDiaHistorial = (fecha) => {
    setDiasExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(fecha)) next.delete(fecha)
      else next.add(fecha)
      return next
    })
  }

  const diasHistorial = Object.entries(porFechaEnRango)
    .sort(([a], [b]) => b.localeCompare(a))
  const rachaDias = getRachaDias(registros, hoy)
  const vasosHoy = hidratacionStore.fecha === hoy ? hidratacionStore.vasos : 0
  const mesActual = hoy.slice(0, 7)
  const registrosMesCount = registros.filter((r) => fechaSoloDia(r.fecha).startsWith(mesActual)).length
  const bannerConsejo = consejosDiarios[0] || consejosSemanales[0] || null
  const proteinasRestantes = Math.max(0, redondear1(metaPro - proteinasHoy))
  const tipNutricionFallback = proteinasRestantes >= 5
    ? `Para tu cena de hoy, 1 lata de atún al natural o 150g de pechuga completarán tus ${proteinasRestantes}g de proteína restantes sin comprometer tus grasas esenciales.`
    : proteinasRestantes > 0
      ? `Te faltan ${proteinasRestantes}g de proteína para la meta del día. Sumá huevos, yogur griego o atún en la cena.`
      : 'Vas bien con la proteína de hoy. Cerrá el día con verduras y una porción magra para mantener el balance.'
  const tipNutricion = consejosDiarios.find((c) => c.tipo === 'nutricion')?.texto
    || consejosSemanales.find((c) => c.tipo === 'nutricion')?.texto
    || tipNutricionFallback

  const onToggleVaso = (index) => {
    const n = index + 1
    const current = hidratacionStore.fecha === hoy ? hidratacionStore.vasos : 0
    if (n <= current) {
      setHidratacionStore({ fecha: hoy, vasos: Math.max(0, n - 1) })
    } else {
      setHidratacionStore({ fecha: hoy, vasos: Math.min(8, n) })
    }
  }

  const onAdd250ml = () => {
    const current = hidratacionStore.fecha === hoy ? hidratacionStore.vasos : 0
    setHidratacionStore({ fecha: hoy, vasos: Math.min(8, current + 1) })
  }

  const caloriasActivas = Math.round(contextoDia?.caloriasQuemadas || 0)

  return (
    <section className="section py-2 comida-page comida-titanium">
      <div className="container app-page-container comida-container">
        <ComidaTitanium
          hoy={hoy}
          rachaDias={rachaDias}
          caloriasHoy={caloriasHoy}
          proteinasHoy={proteinasHoy}
          carbosHoy={carbosHoy}
          grasasHoy={grasasHoy}
          metaKcal={metaKcal}
          metaPro={metaPro}
          metaCarb={metaCarb}
          metaGrasa={metaGrasa}
          vasos={vasosHoy}
          caloriasActivas={caloriasActivas}
          onToggleVaso={onToggleVaso}
          onAdd250ml={onAdd250ml}
          comidas={COMIDAS}
          momentoIcon={MOMENTO_ICON}
          hoyRegistros={hoyRegistros}
          comida={comida}
          setComida={setComida}
          eliminar={eliminar}
          busquedaRef={busquedaRef}
          setBusquedaRef={cambiarBusqueda}
          limpiarSeleccion={limpiarSeleccion}
          resultadosBusqueda={resultadosBusqueda}
          referenciaActiva={referenciaActiva}
          seleccionarReferencia={seleccionarReferencia}
          previewSeleccion={previewSeleccion}
          cantidadPorciones={cantidadPorciones}
          setCantidadPorciones={cambiarCantidadPorciones}
          blurCantidadPorciones={blurCantidadPorciones}
          items={items}
          totalesItems={totalesItems}
          puedeGuardar={puedeGuardar}
          añadirDesdeReferencia={añadirDesdeReferencia}
          actualizarItem={actualizarItem}
          quitarItem={quitarItem}
          blurCantidadItem={blurCantidadItem}
          añadirLineaVacia={añadirLineaVacia}
          notas={notas}
          setNotas={setNotas}
          guardarComida={guardarComida}
          registros={registros}
          tipNutricion={tipNutricion}
          bannerConsejo={bannerConsejo}
          objetivo={config?.objetivo}
          registrosMesCount={registrosMesCount}
          vistaComida={vistaComida}
          setVistaComida={cambiarVistaComida}
          periodo={periodo}
          setPeriodo={setPeriodo}
          desdeCustom={desdeCustom}
          setDesdeCustom={setDesdeCustom}
          hastaCustom={hastaCustom}
          setHastaCustom={setHastaCustom}
          consultarHistorial={consultarHistorial}
          historialMostrado={historialMostrado}
          setHistorialMostrado={setHistorialMostrado}
          rangoDesde={desde}
          rangoHasta={hasta}
          diasHistorial={diasHistorial}
          diasExpandidos={diasExpandidos}
          toggleDiaHistorial={toggleDiaHistorial}
          onEditarRegistro={editarRegistro}
          renderDiaHistorial={(lista) => (
            <ListaComidaAgrupada bloques={agruparComidasPorMomento(lista)} onEliminar={eliminar} onEditar={editarRegistro} />
          )}
        />
      </div>
    </section>
  )
}
