import { useState, useEffect, useMemo } from 'react'
import { useStorage } from '../hooks/useStorage'
import {
  caloriasEjercicioRegistro,
  fechaToISO,
  fechaSoloDia,
  minutosDesdeKm,
  sinAcentos,
  tipoAdmiteKilometros,
  TIPOS_EJERCICIO_AGRUPADOS,
  etiquetaTipo,
  getCategoriaTipo,
} from '../utils/calorias'
import PageHeader from '../components/PageHeader'
import { getUltimosNDias } from '../utils/estadisticas'
import { getIconoActividad } from '../utils/iconosActividad'

const TIPO_DEFAULT = TIPOS_EJERCICIO_AGRUPADOS[0].opciones[0].value

const RAPIDOS_BASE = [
  { nombre: 'Pádel', tipo: 'padel', duracion: 90 },
  { nombre: 'Natación', tipo: 'nadar_moderado', duracion: 40 },
  { nombre: 'Trote suave', tipo: 'correr_8', duracion: 45 },
  { nombre: 'Musculación', tipo: 'pesas_general', duracion: 60 },
]

const CATEGORIAS_FILTRO = ['Todos', 'Deportes', 'Cardio', 'Fuerza']

function tituloDiaHistorial(fecha) {
  const d = new Date(`${fecha}T12:00:00`)
  return d
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()
}

function pctBar(valor, meta) {
  if (!meta || meta <= 0) return 0
  return Math.min(100, Math.round((Number(valor) / Number(meta)) * 100))
}

function rachaSemanasConActividad(ejercicios) {
  let racha = 0
  let offset = 0
  for (let w = 0; w < 52; w++) {
    const dias = []
    const base = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(base)
      d.setDate(d.getDate() - offset - i)
      dias.push(fechaToISO(d))
    }
    const activo = ejercicios.some((e) => dias.includes(fechaSoloDia(e.fecha)))
    if (!activo) {
      if (w === 0) {
        offset += 7
        continue
      }
      break
    }
    racha += 1
    offset += 7
  }
  return racha
}

function exportarEjerciciosJson(ejercicios) {
  const blob = new Blob([JSON.stringify(ejercicios, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ejercicios-${fechaToISO(new Date())}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Ejercicios() {
  const [ejercicios, setEjercicios] = useStorage('ejercicios', [])
  const [config] = useStorage('config', { pesoKg: 70 })
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState(TIPO_DEFAULT)
  const [duracion, setDuracion] = useState('')
  const [modoMedida, setModoMedida] = useState('minutos')
  const [distanciaKm, setDistanciaKm] = useState('')
  const [caloriasManual, setCaloriasManual] = useState('')
  const [notas, setNotas] = useState('')
  const [fechaInput, setFechaInput] = useState(() => fechaToISO(new Date()))
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [histLimit, setHistLimit] = useState(12)
  const [formAbierto, setFormAbierto] = useState(false)

  useEffect(() => {
    if (!tipoAdmiteKilometros(tipo) && modoMedida === 'km') setModoMedida('minutos')
  }, [tipo, modoMedida])

  useEffect(() => {
    if (!formAbierto) return
    const onKey = (ev) => {
      if (ev.key === 'Escape') cerrarFormulario()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [formAbierto])

  const pesoKg = config?.pesoKg || 70
  const metaMinHoy = Number(config?.metaMinutosEjercicio) || 60

  const limpiarFormulario = () => {
    setNombre('')
    setTipo(TIPO_DEFAULT)
    setDuracion('')
    setModoMedida('minutos')
    setDistanciaKm('')
    setCaloriasManual('')
    setNotas('')
    setFechaInput(fechaToISO(new Date()))
    setEditandoId(null)
  }

  const abrirNuevoEjercicio = () => {
    limpiarFormulario()
    setFormAbierto(true)
  }

  const cerrarFormulario = () => {
    limpiarFormulario()
    setFormAbierto(false)
  }

  const parseManualCal = () => {
    const n = parseFloat(String(caloriasManual).replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }

  const kcalEstimadasPreview = (() => {
    const m = parseManualCal()
    const kmP = modoMedida === 'km' && tipoAdmiteKilometros(tipo) && Number(distanciaKm) > 0
    const minP = modoMedida === 'minutos' && Number(duracion) > 0
    if (!tipo || (!m && !kmP && !minP)) return null
    const durEst = kmP ? minutosDesdeKm(tipo, Number(distanciaKm)) : Number(duracion) || 0
    return caloriasEjercicioRegistro({ tipo, duracion: durEst, caloriasManual: m || undefined }, pesoKg)
  })()

  const agregar = (e) => {
    e.preventDefault()
    if (!nombre.trim()) return
    const fecha = fechaInput || fechaToISO(new Date())
    const manualVal = parseManualCal()
    const kmVal = Number(distanciaKm)
    const kmOk = modoMedida === 'km' && tipoAdmiteKilometros(tipo) && kmVal > 0
    const minVal = Number(duracion)
    const minOk = modoMedida === 'minutos' && minVal > 0
    if (!manualVal && !kmOk && !minOk) return

    let duracionFinal = 0
    let distanciaKmSave
    if (kmOk) {
      distanciaKmSave = kmVal
      duracionFinal = minutosDesdeKm(tipo, kmVal)
    } else if (minOk) {
      duracionFinal = Math.round(minVal)
    }

    const camposBase = {
      nombre: nombre.trim(),
      tipo,
      duracion: duracionFinal,
      notas: notas.trim(),
      fecha,
    }
    if (manualVal) camposBase.caloriasManual = manualVal
    if (kmOk) camposBase.distanciaKm = distanciaKmSave

    if (editandoId) {
      setEjercicios((prev) =>
        prev.map((item) => {
          if (item.id !== editandoId) return item
          const durF = kmOk || minOk ? duracionFinal : manualVal ? Number(item.duracion) || 0 : duracionFinal
          const merged = { ...item, ...camposBase, duracion: durF }
          if (!manualVal) delete merged.caloriasManual
          if (kmOk) merged.distanciaKm = distanciaKmSave
          else delete merged.distanciaKm
          return merged
        })
      )
    } else {
      const nuevo = { id: crypto.randomUUID(), ...camposBase }
      if (!kmOk) delete nuevo.distanciaKm
      setEjercicios((prev) => [nuevo, ...prev])
    }
    cerrarFormulario()
  }

  const registrarRapido = (preset) => {
    setEjercicios((prev) => [
      {
        id: crypto.randomUUID(),
        nombre: preset.nombre,
        tipo: preset.tipo,
        duracion: preset.duracion,
        notas: '',
        fecha: fechaToISO(new Date()),
      },
      ...prev,
    ])
  }

  const iniciarEdicion = (item) => {
    setEditandoId(item.id)
    setNombre(item.nombre || '')
    const t = item.tipo || TIPO_DEFAULT
    setTipo(t)
    if (item.distanciaKm != null && Number(item.distanciaKm) > 0 && tipoAdmiteKilometros(t)) {
      setModoMedida('km')
      setDistanciaKm(String(item.distanciaKm))
      setDuracion('')
    } else {
      setModoMedida('minutos')
      setDistanciaKm('')
      setDuracion(item.duracion != null ? String(item.duracion) : '')
    }
    setCaloriasManual(item.caloriasManual != null && Number(item.caloriasManual) > 0 ? String(item.caloriasManual) : '')
    setNotas(item.notas || '')
    setFechaInput(fechaSoloDia(item.fecha) || fechaToISO(new Date()))
    setFormAbierto(true)
  }

  const eliminar = (id) => {
    if (editandoId === id) cerrarFormulario()
    setEjercicios((prev) => prev.filter((e) => e.id !== id))
  }

  const ajustarDuracion = (delta) => {
    const actual = Number(duracion) || 0
    setDuracion(String(Math.max(0, actual + delta)))
  }

  const ejerciciosFiltrados = ejercicios.filter((e) => {
    if (filtroTexto.trim()) {
      const t = sinAcentos(filtroTexto.trim())
      const matchNombre = sinAcentos(e.nombre || '').includes(t)
      const matchNotas = sinAcentos(e.notas || '').includes(t)
      const matchTipo = sinAcentos(etiquetaTipo(e.tipo)).includes(t)
      if (!matchNombre && !matchNotas && !matchTipo) return false
    }
    if (filtroCategoria !== 'Todos') {
      if (getCategoriaTipo(e.tipo) !== filtroCategoria) return false
    }
    const fKey = fechaSoloDia(e.fecha)
    if (filtroDesde && fKey < filtroDesde) return false
    if (filtroHasta && fKey > filtroHasta) return false
    return true
  })

  const porFecha = ejerciciosFiltrados.reduce((acc, e) => {
    const key = fechaSoloDia(e.fecha)
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  const fechasOrdenadas = Object.keys(porFecha).sort((a, b) => b.localeCompare(a))
  const fechasVisibles = fechasOrdenadas.slice(0, histLimit)
  const hayMasHistorial = fechasOrdenadas.length > histLimit

  const hoyIso = fechaToISO(new Date())
  const ejerciciosHoy = ejercicios.filter((e) => fechaSoloDia(e.fecha) === hoyIso)
  const minutosHoy = ejerciciosHoy.reduce((s, e) => s + (Number(e.duracion) || 0), 0)
  const caloriasHoy = ejerciciosHoy.reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoKg), 0)
  const sesionesHoy = ejerciciosHoy.length

  const dias14 = getUltimosNDias(14)
  const dias7 = dias14.slice(7)
  const diasPrev7 = dias14.slice(0, 7)
  const ejercicios7 = ejercicios.filter((e) => dias7.includes(fechaSoloDia(e.fecha)))
  const caloriasUltimos7 = ejercicios7.reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoKg), 0)
  const caloriasPrev7 = ejercicios
    .filter((e) => diasPrev7.includes(fechaSoloDia(e.fecha)))
    .reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoKg), 0)
  const deltaKcalPct =
    caloriasPrev7 > 0
      ? Math.round(((caloriasUltimos7 - caloriasPrev7) / caloriasPrev7) * 100)
      : caloriasUltimos7 > 0
        ? 100
        : null
  const diasActivosSet = new Set(ejercicios7.map((e) => fechaSoloDia(e.fecha)))
  const diasActivos7 = diasActivosSet.size
  const rachaSemanas = rachaSemanasConActividad(ejercicios)
  const minutosTotales7 = ejercicios7.reduce((s, e) => s + (Number(e.duracion) || 0), 0)

  const disciplinaTop = useMemo(() => {
    const map = {}
    for (const e of ejercicios7) {
      const key = e.nombre?.trim() || etiquetaTipo(e.tipo)
      if (!map[key]) {
        map[key] = {
          nombre: key,
          tipo: e.tipo,
          categoria: getCategoriaTipo(e.tipo),
          sesiones: 0,
          minutos: 0,
        }
      }
      map[key].sesiones += 1
      map[key].minutos += Number(e.duracion) || 0
    }
    return Object.values(map).sort((a, b) => b.sesiones - a.sesiones || b.minutos - a.minutos)[0] || null
  }, [ejercicios7])

  const chipsRapidos = useMemo(() => {
    const frecuentes = {}
    for (const e of ejercicios) {
      const k = sinAcentos((e.nombre || '').trim()) || sinAcentos(etiquetaTipo(e.tipo))
      if (!k) continue
      if (!frecuentes[k]) {
        frecuentes[k] = {
          nombre: e.nombre || etiquetaTipo(e.tipo),
          tipo: e.tipo,
          duracion: Number(e.duracion) || 30,
          count: 0,
        }
      }
      frecuentes[k].count += 1
      // conservar la duración más usada
      if (!frecuentes[k]._durMap) frecuentes[k]._durMap = {}
      const d = Number(e.duracion) || 30
      frecuentes[k]._durMap[d] = (frecuentes[k]._durMap[d] || 0) + 1
      const bestDur = Object.entries(frecuentes[k]._durMap).sort((a, b) => b[1] - a[1])[0]
      if (bestDur) frecuentes[k].duracion = Number(bestDur[0])
    }

    const top = Object.values(frecuentes)
      .sort((a, b) => b.count - a.count)
      .map(({ _durMap, ...rest }) => rest)

    const out = []
    const seen = new Set()
    const pushUnique = (chip) => {
      const k = sinAcentos((chip.nombre || '').trim())
      if (!k || seen.has(k) || out.length >= 4) return
      seen.add(k)
      out.push({
        nombre: chip.nombre,
        tipo: chip.tipo,
        duracion: chip.duracion,
      })
    }

    // Primero los presets fijos (evita “Pádel” + “padel”)
    for (const r of RAPIDOS_BASE) pushUnique(r)
    for (const t of top) pushUnique(t)
    return out
  }, [ejercicios])

  const pctTiempoHoy = pctBar(minutosHoy, metaMinHoy)
  const pctKcalSemana = pctBar(caloriasUltimos7, Math.max(caloriasUltimos7, 2500))
  const pctTopTiempo =
    disciplinaTop && minutosTotales7 > 0
      ? Math.round((disciplinaTop.minutos / minutosTotales7) * 100)
      : null

  return (
    <section className="section py-4 ejercicios-page">
      <div className="container app-page-container ejercicios-container">
        <PageHeader
          title="Ejercicios"
          subtitle="Registra y monitorea tu actividad física, gasto calórico y rendimiento diario."
          action={(
            <div className="ej-header-actions">
              <button
                type="button"
                className="button ej-export-btn"
                onClick={() => exportarEjerciciosJson(ejercicios)}
              >
                ↗ Exportar
              </button>
              <button
                type="button"
                className="button ej-nuevo-btn"
                onClick={abrirNuevoEjercicio}
              >
                + Nuevo ejercicio
              </button>
            </div>
          )}
        />

        {/* Chips rápidos */}
        <div className="ej-rapidos">
          <span className="ej-rapidos-label">⚡ Registros rápidos:</span>
          <div className="ej-rapidos-row">
            {chipsRapidos.map((chip) => {
              const ui = getIconoActividad(chip.tipo, chip.nombre)
              return (
                <button
                  key={`${chip.nombre}-${chip.tipo}-${chip.duracion}`}
                  type="button"
                  className="ej-rapido-chip"
                  onClick={() => registrarRapido(chip)}
                  title={`Registrar ${chip.nombre} · ${chip.duracion} min`}
                >
                  <span aria-hidden>{ui.icon}</span>
                  <span>{chip.nombre}</span>
                  <span className="ej-rapido-min">({chip.duracion} min)</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 4 KPIs — mock */}
        <div className="ej-kpi-grid">
          <article className="ej-kpi-card">
            <div className="ej-kpi-top">
              <p className="ej-kpi-label">Hoy</p>
              <span className="ej-kpi-icon ej-kpi-icon--blue" aria-hidden>⏱️</span>
            </div>
            <p className="ej-kpi-value mb-0">
              {minutosHoy}
              <span className="ej-kpi-unit"> min</span>
            </p>
            <p className={`ej-kpi-hint mb-0${pctTiempoHoy >= 100 ? ' is-ok' : ''}`}>
              {sesionesHoy > 0
                ? pctTiempoHoy >= 100
                  ? `Meta cumplida · ${sesionesHoy} sesión${sesionesHoy !== 1 ? 'es' : ''}`
                  : `${pctTiempoHoy}% de la meta · ${sesionesHoy} sesión${sesionesHoy !== 1 ? 'es' : ''}`
                : 'Sin sesiones hoy'}
            </p>
            <div className="ej-kpi-bar">
              <span className="ej-kpi-bar-fill ej-kpi-bar-fill--blue" style={{ width: `${Math.max(pctTiempoHoy, minutosHoy > 0 ? 8 : 0)}%` }} />
            </div>
          </article>

          <article className="ej-kpi-card">
            <div className="ej-kpi-top">
              <p className="ej-kpi-label">Últimos 7 días</p>
              <span className="ej-kpi-icon ej-kpi-icon--green" aria-hidden>🔥</span>
            </div>
            <p className="ej-kpi-value ej-kpi-value--green mb-0">
              {caloriasUltimos7.toLocaleString('es-AR')}
              <span className="ej-kpi-unit"> kcal</span>
            </p>
            <p className={`ej-kpi-hint mb-0${deltaKcalPct != null && deltaKcalPct >= 0 ? ' is-ok' : ''}`}>
              {deltaKcalPct != null
                ? `${deltaKcalPct >= 0 ? '↗ +' : '↘ '}${Math.abs(deltaKcalPct)}% vs semana previa`
                : `Hoy ${caloriasHoy} kcal`}
            </p>
            <div className="ej-kpi-bar">
              <span className="ej-kpi-bar-fill ej-kpi-bar-fill--green" style={{ width: `${Math.max(pctKcalSemana, caloriasUltimos7 > 0 ? 8 : 0)}%` }} />
            </div>
          </article>

          <article className="ej-kpi-card">
            <div className="ej-kpi-top">
              <p className="ej-kpi-label">Frecuencia semanal</p>
              <span className="ej-kpi-icon ej-kpi-icon--blue" aria-hidden>✓</span>
            </div>
            <p className="ej-kpi-value mb-0">
              {diasActivos7}
              <span className="ej-kpi-unit"> / 7 días</span>
            </p>
            <p className={`ej-kpi-hint mb-0${rachaSemanas > 0 ? ' is-blue' : ''}`}>
              {rachaSemanas > 0
                ? `Racha activa de ${rachaSemanas} semana${rachaSemanas !== 1 ? 's' : ''}`
                : 'Sin racha activa'}
            </p>
            <div className="ej-kpi-days" aria-hidden>
              {dias7.map((f) => (
                <i key={f} className={diasActivosSet.has(f) ? 'is-on' : ''} />
              ))}
            </div>
          </article>

          <article className="ej-kpi-card">
            <div className="ej-kpi-top">
              <p className="ej-kpi-label">Disciplina top</p>
              <span className="ej-kpi-icon ej-kpi-icon--gold" aria-hidden>🏆</span>
            </div>
            <p className="ej-kpi-value ej-kpi-value--sm mb-0">
              {disciplinaTop?.nombre || '—'}
            </p>
            <p className="ej-kpi-hint mb-0">
              {disciplinaTop
                ? `${disciplinaTop.sesiones} sesión${disciplinaTop.sesiones !== 1 ? 'es' : ''} registradas (${disciplinaTop.minutos} min)`
                : 'Sin datos esta semana'}
            </p>
            {disciplinaTop && (
              <div className="ej-kpi-foot">
                <span className="is-blue">{pctTopTiempo}% del tiempo total</span>
                <span>{disciplinaTop.categoria}</span>
              </div>
            )}
          </article>
        </div>

        {/* Historial */}
        <div className="ejercicios-hist-panel">
          <div className="ej-hist-toolbar mb-3">
            <div className="ej-hist-search">
              <span className="ej-hist-search-icon" aria-hidden>🔍</span>
              <input
                type="text"
                placeholder="Buscar por nombre, actividad..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
              />
            </div>
            <div className="ej-hist-cats">
              {CATEGORIAS_FILTRO.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`ej-hist-cat-chip${filtroCategoria === cat ? ' is-active' : ''}`}
                  onClick={() => setFiltroCategoria(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`ej-hist-filtros-btn${filtrosOpen ? ' is-active' : ''}`}
              onClick={() => setFiltrosOpen((v) => !v)}
            >
              ☰ Filtros
            </button>
          </div>

          {filtrosOpen && (
            <div className="box ej-hist-filtros-panel mb-3 py-3">
              <div className="columns is-mobile mb-2">
                <div className="column">
                  <label className="ej-form-label">Desde</label>
                  <input className="input is-small" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
                </div>
                <div className="column">
                  <label className="ej-form-label">Hasta</label>
                  <input className="input is-small" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
                </div>
              </div>
              <button
                type="button"
                className="button is-small is-light"
                onClick={() => {
                  setFiltroTexto('')
                  setFiltroCategoria('Todos')
                  setFiltroDesde('')
                  setFiltroHasta('')
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {fechasVisibles.length === 0 ? (
            <div className="box ej-hist-empty has-text-centered py-5">
              <p className="mb-2">Aún no hay ejercicios registrados.</p>
              <button type="button" className="button is-link is-small" onClick={abrirNuevoEjercicio}>
                + Nuevo ejercicio
              </button>
            </div>
          ) : (
            <div className="ej-hist-list">
              {fechasVisibles.map((fecha) => (
                <section key={fecha} className="ej-hist-dia">
                  <h3 className="ej-hist-dia-titulo">{tituloDiaHistorial(fecha)}</h3>
                  <ul className="ej-hist-items">
                    {porFecha[fecha].map((e) => {
                      const ui = getIconoActividad(e.tipo, e.nombre)
                      const kcal = caloriasEjercicioRegistro(e, pesoKg)
                      return (
                        <li key={e.id} className="ej-hist-item">
                          <span className={`ej-hist-icon ej-hist-icon--${ui.tone}`} aria-hidden>{ui.icon}</span>
                          <div className="ej-hist-body">
                            <strong className="ej-hist-nombre">{e.nombre}</strong>
                            <span className={`ej-hist-cat ej-hist-cat--${ui.tone}`}>{getCategoriaTipo(e.tipo)}</span>
                            {e.notas ? <p className="ej-hist-notas mb-0">{e.notas}</p> : null}
                          </div>
                          <div className="ej-hist-stats">
                            <span>{e.duracion} min</span>
                            <span className="ej-hist-kcal">~{kcal} kcal</span>
                          </div>
                          <div className="ej-hist-actions">
                            <button type="button" className="ej-hist-edit" onClick={() => iniciarEdicion(e)} aria-label="Editar">
                              ✏️
                            </button>
                            <button type="button" className="ej-hist-delete" onClick={() => eliminar(e.id)} aria-label="Eliminar">
                              ×
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {hayMasHistorial && (
            <button type="button" className="ej-hist-more" onClick={() => setHistLimit((n) => n + 10)}>
              Cargar más historial
            </button>
          )}
        </div>
      </div>

      {/* Modal Nuevo / Editar */}
      {formAbierto && (
        <div className="ej-modal" role="dialog" aria-modal="true" aria-labelledby="ej-modal-title">
          <button type="button" className="ej-modal-backdrop" aria-label="Cerrar" onClick={cerrarFormulario} />
          <div className="ej-modal-panel">
            <div className="ej-modal-head">
              <div className="ej-modal-head-left">
                <span className="ej-modal-icon" aria-hidden>+</span>
                <div>
                  <h2 id="ej-modal-title" className="ej-modal-title mb-0">
                    {editandoId ? 'Editar ejercicio' : 'Nuevo ejercicio'}
                  </h2>
                  <p className="ej-modal-sub mb-0">
                    Registra los detalles de tu actividad para el cálculo calórico.
                  </p>
                </div>
              </div>
              <button type="button" className="ej-modal-close" onClick={cerrarFormulario}>
                Cerrar
              </button>
            </div>

            <form onSubmit={agregar} className="ej-form">
              <div className="ej-form-grid">
                <div className="ej-form-col">
                  <div className="field">
                    <label className="ej-form-label" htmlFor="ej-fecha">Fecha</label>
                    <div className="control">
                      <input
                        id="ej-fecha"
                        className="input"
                        type="date"
                        value={fechaInput}
                        onChange={(e) => setFechaInput(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="ej-form-label" htmlFor="ej-nombre">Nombre del ejercicio</label>
                    <div className="control">
                      <input
                        id="ej-nombre"
                        className="input"
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Ej: Padel, Correr, Pesas..."
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                    <p className="ej-form-suggest mb-0">Sugerencia rápida: Tenis, Calistenia, Spinning, Boxeo.</p>
                  </div>

                  <div className="field">
                    <label className="ej-form-label" htmlFor="ej-tipo">Tipo de actividad</label>
                    <div className="control">
                      <div className="select is-fullwidth">
                        <select
                          id="ej-tipo"
                          value={tipo}
                          onChange={(e) => {
                            const v = e.target.value
                            setTipo(v)
                            if (!tipoAdmiteKilometros(v)) setModoMedida('minutos')
                          }}
                        >
                          {TIPOS_EJERCICIO_AGRUPADOS.map((g) => (
                            <optgroup key={g.categoria} label={g.categoria}>
                              {g.opciones.map((op) => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ej-form-col">
                  {tipoAdmiteKilometros(tipo) ? (
                    <div className="field">
                      <label className="ej-form-label">Medida</label>
                      <div className="ti-segmented ej-medida-seg">
                        <button
                          type="button"
                          className={modoMedida === 'minutos' ? 'is-active' : ''}
                          onClick={() => setModoMedida('minutos')}
                        >
                          Minutos
                        </button>
                        <button
                          type="button"
                          className={modoMedida === 'km' ? 'is-active' : ''}
                          onClick={() => setModoMedida('km')}
                        >
                          Kilómetros
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="field">
                      <label className="ej-form-label">Medida</label>
                      <div className="ti-segmented ej-medida-seg">
                        <button type="button" className="is-active">Minutos</button>
                      </div>
                    </div>
                  )}

                  <div className="field">
                    <label className="ej-form-label" htmlFor="ej-duracion">
                      {tipoAdmiteKilometros(tipo) && modoMedida === 'km' ? 'Distancia (km)' : 'Duración (min)'}
                    </label>
                    {tipoAdmiteKilometros(tipo) && modoMedida === 'km' ? (
                      <div className="control">
                        <input
                          id="ej-duracion"
                          className="input"
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={distanciaKm}
                          onChange={(e) => setDistanciaKm(e.target.value)}
                          placeholder="Ej: 5"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="ej-form-step-hint mb-1">+15 min por clic</p>
                        <div className="ej-duracion-stepper">
                          <input
                            id="ej-duracion"
                            className="input"
                            type="number"
                            min="1"
                            value={duracion}
                            onChange={(e) => setDuracion(e.target.value)}
                            placeholder="30"
                          />
                          <button type="button" className="ej-step-btn" onClick={() => ajustarDuracion(-15)} aria-label="Restar 15 min">−</button>
                          <button type="button" className="ej-step-btn" onClick={() => ajustarDuracion(15)} aria-label="Sumar 15 min">+</button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="field">
                    <div className="ej-kcal-label-row">
                      <label className="ej-form-label mb-0" htmlFor="ej-kcal">Kcal manual (opcional)</label>
                      {kcalEstimadasPreview != null && (
                        <span className="ej-kcal-badge">~{kcalEstimadasPreview} kcal estimadas</span>
                      )}
                    </div>
                    <div className="control">
                      <input
                        id="ej-kcal"
                        className="input"
                        type="number"
                        min="1"
                        step="1"
                        value={caloriasManual}
                        onChange={(e) => setCaloriasManual(e.target.value)}
                        placeholder="Reemplaza el cálculo automático"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="field ej-form-notas">
                <label className="ej-form-label" htmlFor="ej-notas">Notas (opcional)</label>
                <div className="control">
                  <textarea
                    id="ej-notas"
                    className="textarea"
                    rows={3}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Intensidad, cómo te sentiste, sets, sensaciones..."
                  />
                </div>
              </div>

              <div className="ej-form-actions">
                <button type="submit" className="button is-link ej-form-submit">
                  ✓ {editandoId ? 'Guardar cambios' : 'Guardar ejercicio'}
                </button>
                <button type="button" className="button is-light ej-form-cancel" onClick={cerrarFormulario}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
