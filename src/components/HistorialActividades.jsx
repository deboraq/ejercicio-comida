import { useEffect, useMemo, useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import {
  caloriasEjercicioRegistro,
  fechaSoloDia,
  fechaToISO,
  sinAcentos,
  etiquetaTipo,
  getCategoriaTipo,
} from '../utils/calorias'
import { getIconoActividad } from '../utils/iconosActividad'
import ModalNuevoEjercicio from './ModalNuevoEjercicio'

const CATEGORIAS_FILTRO = ['Todos', 'Deportes', 'Cardio', 'Fuerza']

function tituloDiaHistorial(fecha) {
  const d = new Date(`${fecha}T12:00:00`)
  return d
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()
}

function exportarEjerciciosJson(ejercicios) {
  const blob = new Blob([JSON.stringify(ejercicios, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `actividades-${fechaToISO(new Date())}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Historial de actividades (deportes/cardio) — vista simple para Entrenamiento.
 * @param {{ onRegistrarActividad?: () => void }} props
 */
export default function HistorialActividades({ onRegistrarActividad }) {
  const [ejercicios, setEjercicios] = useStorage('ejercicios', [])
  const [config] = useStorage('config', { pesoKg: 70 })
  const pesoKg = config?.pesoKg || 70

  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [histLimit, setHistLimit] = useState(7)
  const [diasExpandidos, setDiasExpandidos] = useState(() => new Set())
  const [formAbierto, setFormAbierto] = useState(false)

  useEffect(() => {
    setDiasExpandidos(new Set())
  }, [filtroTexto, filtroCategoria, filtroDesde, filtroHasta])

  const cerrarFormulario = () => {
    setEditandoId(null)
    setFormAbierto(false)
  }

  const iniciarEdicion = (item) => {
    setEditandoId(item.id)
    setFormAbierto(true)
  }

  const eliminar = (id) => {
    if (editandoId === id) cerrarFormulario()
    setEjercicios((prev) => prev.filter((e) => e.id !== id))
  }

  const toggleDiaHistorial = (fecha) => {
    setDiasExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(fecha)) next.delete(fecha)
      else next.add(fecha)
      return next
    })
  }

  const ejercicioEditando = useMemo(
    () => (editandoId ? ejercicios.find((e) => e.id === editandoId) || null : null),
    [editandoId, ejercicios],
  )

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

  const registrar = () => {
    if (onRegistrarActividad) onRegistrarActividad()
    else {
      setEditandoId(null)
      setFormAbierto(true)
    }
  }

  return (
    <section className="section ejercicios-page ejercicios-page--embedded ejercicios-page--cardio-full">
      <div className="container app-page-container ejercicios-container">
        <header className="entren-cardio-page-head entren-cardio-page-head--simple">
          <div>
            <h2 className="entren-cardio-page-title mb-0">Historial de actividades</h2>
            <p className="entren-cardio-page-sub mb-0">
              Buscá, editá o exportá. Para cargar una sesión usá el hub o «Registrar actividad».
            </p>
          </div>
          <div className="ej-header-actions">
            <button type="button" className="button ej-export-btn" onClick={() => exportarEjerciciosJson(ejercicios)}>
              ↗ Exportar
            </button>
            <button type="button" className="button ej-nuevo-btn" onClick={registrar}>
              + Registrar actividad
            </button>
          </div>
        </header>

        <div className="ejercicios-hist-panel">
          <div className="ej-hist-toolbar mb-3 ej-hist-toolbar--compact">
            <div className="ej-hist-search">
              <span className="ej-hist-search-icon" aria-hidden>
                🔍
              </span>
              <input
                type="text"
                placeholder="Buscar…"
                value={filtroTexto}
                onChange={(ev) => setFiltroTexto(ev.target.value)}
              />
            </div>
            <div className="ej-hist-filters-row">
              <div className="ej-hist-cats" role="group" aria-label="Filtrar por categoría">
                {CATEGORIAS_FILTRO.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`ej-rapido-chip ej-filter-chip${filtroCategoria === cat ? ' is-active' : ''}`}
                    onClick={() => setFiltroCategoria(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`ej-export-btn ej-hist-filtros-btn${filtrosOpen ? ' is-active' : ''}`}
                onClick={() => setFiltrosOpen((v) => !v)}
              >
                ☰ Filtros
              </button>
            </div>
          </div>

          {filtrosOpen ? (
            <div className="box ej-hist-filtros-panel mb-3 py-3">
              <div className="columns is-mobile mb-2">
                <div className="column">
                  <label className="ej-form-label">Desde</label>
                  <input className="input is-small" type="date" value={filtroDesde} onChange={(ev) => setFiltroDesde(ev.target.value)} />
                </div>
                <div className="column">
                  <label className="ej-form-label">Hasta</label>
                  <input className="input is-small" type="date" value={filtroHasta} onChange={(ev) => setFiltroHasta(ev.target.value)} />
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
                  setDiasExpandidos(new Set())
                }}
              >
                Limpiar filtros
              </button>
            </div>
          ) : null}

          {fechasVisibles.length === 0 ? (
            <div className="box ej-hist-empty has-text-centered py-5">
              <p className="mb-2">No hay actividades que coincidan.</p>
              <button type="button" className="button is-link is-small" onClick={registrar}>
                + Registrar actividad
              </button>
            </div>
          ) : (
            <div className="ej-hist-list">
              {fechasVisibles.map((fecha) => {
                const lista = porFecha[fecha]
                const abierto = diasExpandidos.has(fecha)
                const totalMin = lista.reduce((s, e) => s + (Number(e.duracion) || 0), 0)
                const totalKcal = lista.reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoKg), 0)
                return (
                  <section key={fecha} className={`ej-hist-dia${abierto ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="ej-hist-dia-toggle"
                      onClick={() => toggleDiaHistorial(fecha)}
                      aria-expanded={abierto}
                    >
                      <span className="ej-hist-dia-toggle-main">
                        <span className="ej-hist-chevron" aria-hidden />
                        <span className="ej-hist-dia-titulo">{tituloDiaHistorial(fecha)}</span>
                      </span>
                      <span className="ej-hist-dia-tag">
                        {lista.length} sesión{lista.length !== 1 ? 'es' : ''} · {totalMin} min · ~{Math.round(totalKcal)} kcal
                      </span>
                    </button>
                    {abierto ? (
                      <ul className="ej-hist-items">
                        {lista.map((e) => {
                          const ui = getIconoActividad(e.tipo, e.nombre)
                          const kcal = caloriasEjercicioRegistro(e, pesoKg)
                          return (
                            <li key={e.id} className="ej-hist-item">
                              <span className={`ej-hist-icon ej-hist-icon--${ui.tone}`} aria-hidden>
                                {ui.icon}
                              </span>
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
                    ) : null}
                  </section>
                )
              })}
            </div>
          )}

          {hayMasHistorial ? (
            <button type="button" className="ej-hist-more" onClick={() => setHistLimit((n) => n + 10)}>
              Cargar más historial
            </button>
          ) : null}
        </div>
      </div>

      <ModalNuevoEjercicio open={formAbierto} onClose={cerrarFormulario} editItem={ejercicioEditando} contexto="ejercicios" />
    </section>
  )
}
