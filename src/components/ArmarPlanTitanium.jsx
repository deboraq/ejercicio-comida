import { useMemo, useState, useRef } from 'react'
import {
  itemEjercicioDiaNormalizado,
  nombreDisplayPlan,
  inferirGruposMuscularesDia,
  inferirGrupoMuscular,
  esCalentamientoPlan,
  agruparPlanEnBloques,
  resumenPlanDia,
  FILTROS_BIBLIOTECA,
  matchFiltroBiblioteca,
} from '../utils/rutinaEjercicioDia'
import { buscarEjercicios } from '../utils/rutinaEjercicios'

const SS_OPTIONS = ['', 'A', 'B', 'C', 'D']

function IconChevronUp({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 15 6-6 6 6" />
    </svg>
  )
}

function IconChevronDown({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function IconPencil({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function IconClose({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

const DIST_COLORS = {
  Espalda: '#3b82f6',
  Pecho: '#60a5fa',
  Piernas: '#34d399',
  Hombros: '#a78bfa',
  Bíceps: '#c084fc',
  Tríceps: '#818cf8',
  Core: '#fb923c',
  'Core & Calentamiento': '#fb923c',
  Calentamiento: '#34d399',
  Otro: '#64748b',
}

function badgeMusculo(grupo) {
  if (!grupo || grupo === 'Otro') return null
  if (grupo === 'Calentamiento') return 'Calentamiento Activo'
  if (grupo === 'Espalda') return 'Espalda / Dorsal'
  if (grupo === 'Piernas') return 'Piernas / Cuádriceps'
  if (grupo === 'Bíceps') return 'Bíceps / Flexores'
  if (grupo === 'Tríceps') return 'Tríceps'
  return grupo
}

function formatVolumen(kg) {
  if (!kg || kg <= 0) return '—'
  if (kg >= 1000) return `~${(kg / 1000).toFixed(1)}k kg`
  return `~${Math.round(kg)} kg`
}

/**
 * Configurador Titanium: Armá tu plan.
 */
export default function ArmarPlanTitanium({
  dias,
  diaEditando,
  setDiaEditando,
  diaActual,
  ejerciciosDelDia,
  origenEditable = true,
  onAñadirDia,
  onDuplicarDia: _onDuplicarDia,
  onMoverDia,
  onRenombrarDia,
  onQuitarDia,
  onAñadirEjercicio,
  onQuitarEjercicio,
  onGuardarEjercicio,
  onReordenar,
  onVincularSuperserie,
  onDesvincularSuperserie,
  onExportarPdf,
}) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('Todos')
  const [editIdx, setEditIdx] = useState(null)
  const [draft, setDraft] = useState(null)
  const [notasAbiertas, setNotasAbiertas] = useState({})
  const [drag, setDrag] = useState(null)
  const dragRef = useRef(null)
  const listRef = useRef(null)

  const enfoque = useMemo(
    () => inferirGruposMuscularesDia(ejerciciosDelDia) || 'Sin enfoque',
    [ejerciciosDelDia]
  )
  const resumen = useMemo(() => resumenPlanDia(ejerciciosDelDia), [ejerciciosDelDia])
  const bloques = useMemo(() => agruparPlanEnBloques(ejerciciosDelDia), [ejerciciosDelDia])

  const catalogo = useMemo(() => {
    const base = busqueda.trim() ? buscarEjercicios(busqueda) : buscarEjercicios('')
    return base.filter((n) => matchFiltroBiblioteca(n, filtro)).slice(0, 10)
  }, [busqueda, filtro])

  const displayNum = (idx, it) => {
    if (esCalentamientoPlan(it)) return 0
    let n = 0
    for (let i = 0; i <= idx; i += 1) {
      const cur = itemEjercicioDiaNormalizado(ejerciciosDelDia[i])
      if (!cur) continue
      if (esCalentamientoPlan(cur)) continue
      n += 1
    }
    return n
  }

  const iniciarEdit = (idx) => {
    const it = itemEjercicioDiaNormalizado(ejerciciosDelDia[idx])
    if (!it) return
    setEditIdx(idx)
    setDraft({
      nombre: it.nombre,
      series: it.series,
      repeticiones: it.repeticiones,
      superserie: it.superserie || '',
      descansoPostRonda: it.descansoPostRonda || '',
      grupoMuscular: it.grupoMuscular || inferirGrupoMuscular(it),
      carga: it.carga || '',
      notas: it.notas || '',
    })
  }

  const cancelarEdit = () => {
    setEditIdx(null)
    setDraft(null)
  }

  const guardarEdit = () => {
    if (editIdx == null || !draft?.nombre?.trim()) return
    onGuardarEjercicio(editIdx, draft)
    cancelarEdit()
  }

  const idxDesdePuntero = (clientY) => {
    const list = listRef.current
    if (!list) return null
    const rows = [...list.querySelectorAll('[data-plan-idx]')]
    if (!rows.length) return null
    for (const row of rows) {
      const rect = row.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return Number(row.dataset.planIdx)
    }
    return Number(rows[rows.length - 1].dataset.planIdx)
  }

  const onPointerDown = (e, idx) => {
    if (!origenEditable || editIdx != null) return
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    dragRef.current = { fromIdx: idx, overIdx: idx }
    setDrag({ fromIdx: idx, overIdx: idx })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    const state = dragRef.current
    if (!state) return
    const overIdx = idxDesdePuntero(e.clientY)
    if (overIdx == null || overIdx === state.overIdx) return
    state.overIdx = overIdx
    setDrag({ fromIdx: state.fromIdx, overIdx })
  }

  const onPointerUp = () => {
    const state = dragRef.current
    if (!state) return
    onReordenar(state.fromIdx, state.overIdx)
    dragRef.current = null
    setDrag(null)
  }

  const promptRenombrar = (d) => {
    const n = window.prompt('Nombre del día (ej. Día 1: Pecho & Espalda)', d.nombre)
    if (n != null) onRenombrarDia(d.id, n)
  }

  const tituloDia = (d, di) => {
    const raw = String(d.nombre || '').trim()
    if (raw && !/^d[ií]a\s*\d+$/i.test(raw)) return raw
    const enf = inferirGruposMuscularesDia(d.ejercicios || [])
    return enf ? `Día ${di + 1}: ${enf}` : `Día ${di + 1}`
  }

  const renderCard = (it, idx, { enSs = false, ssLabel = '' } = {}) => {
    const editando = editIdx === idx
    const warm = esCalentamientoPlan(it)
    const num = displayNum(idx, it)
    const musculo = badgeMusculo(it.grupoMuscular || inferirGrupoMuscular(it))
    const isDragging = drag?.fromIdx === idx
    const isDrop = drag && drag.overIdx === idx && drag.fromIdx !== idx
    const notasOpen = notasAbiertas[idx]

    if (editando && draft) {
      return (
        <div
          key={`edit-${idx}`}
          data-plan-idx={idx}
          className="ap-ex-card ap-ex-card--edit"
        >
          <div className="ap-edit-head">
            <span className="ap-edit-badge">{num}</span>
            <div>
              <p className="ap-edit-kicker mb-0">Modo edición rápida</p>
              <p className="ap-edit-hint mb-0">Modificando parámetros de ejecución</p>
            </div>
          </div>
          <div className="ap-edit-name-row">
            <input
              className="ap-input ap-input--grow"
              type="text"
              value={draft.nombre}
              onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              placeholder="Nombre del ejercicio"
              autoFocus
            />
            <span className="ap-pill ap-pill--muted">
              {badgeMusculo(draft.grupoMuscular || inferirGrupoMuscular(draft.nombre)) || 'Sin grupo'}
            </span>
          </div>
          <div className="ap-edit-grid">
            <label className="ap-field">
              <span>Series</span>
              <input
                className="ap-input"
                type="text"
                inputMode="numeric"
                value={draft.series}
                onChange={(e) => setDraft((d) => ({ ...d, series: e.target.value }))}
                placeholder="3"
              />
            </label>
            <label className="ap-field">
              <span>Reps</span>
              <input
                className="ap-input"
                type="text"
                value={draft.repeticiones}
                onChange={(e) => setDraft((d) => ({ ...d, repeticiones: e.target.value }))}
                placeholder="8-10 o 8+8"
              />
            </label>
            <label className="ap-field">
              <span>Superserie</span>
              <select
                className="ap-input"
                value={draft.superserie}
                onChange={(e) => setDraft((d) => ({ ...d, superserie: e.target.value }))}
              >
                <option value="">Sin superserie</option>
                {SS_OPTIONS.filter(Boolean).map((L) => (
                  <option key={L} value={L}>Superserie {L}</option>
                ))}
              </select>
            </label>
            <label className="ap-field">
              <span>Descanso ronda (seg)</span>
              <input
                className="ap-input"
                type="text"
                inputMode="numeric"
                value={draft.descansoPostRonda}
                onChange={(e) => setDraft((d) => ({ ...d, descansoPostRonda: e.target.value }))}
                placeholder="90"
                disabled={!draft.superserie}
              />
            </label>
            <label className="ap-field ap-field--span2">
              <span>Carga sugerida</span>
              <input
                className="ap-input"
                type="text"
                value={draft.carga}
                onChange={(e) => setDraft((d) => ({ ...d, carga: e.target.value }))}
                placeholder="25 - 30 kg"
              />
            </label>
            <label className="ap-field ap-field--span2">
              <span>Grupo muscular</span>
              <select
                className="ap-input"
                value={draft.grupoMuscular || ''}
                onChange={(e) => setDraft((d) => ({ ...d, grupoMuscular: e.target.value }))}
              >
                <option value="">Auto</option>
                {['Calentamiento', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="ap-field">
            <span>Notas técnicas</span>
            <textarea
              className="ap-input ap-textarea"
              rows={2}
              value={draft.notas}
              onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
              placeholder="Palmas mirando hacia ti, foco en retracción escapular…"
            />
          </label>
          <div className="ap-edit-actions">
            <button type="button" className="ap-btn ap-btn--ghost" onClick={cancelarEdit}>Cancelar</button>
            <button
              type="button"
              className="ap-btn ap-btn--primary"
              disabled={!draft.nombre.trim()}
              onClick={guardarEdit}
            >
              Guardar cambios
            </button>
          </div>
        </div>
      )
    }

    return (
      <div
        key={`${it.nombre}-${idx}`}
        data-plan-idx={idx}
        className={`ap-ex-card${warm ? ' is-warm' : ''}${enSs ? ' is-ss-item' : ''}${isDragging ? ' is-dragging' : ''}${isDrop ? ' is-drop' : ''}`}
      >
        <button
          type="button"
          className="ap-drag"
          aria-label={`Arrastrar ${it.nombre}`}
          disabled={!origenEditable}
          onPointerDown={(e) => onPointerDown(e, idx)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          ⠿
        </button>
        <span className={`ap-num${warm ? ' is-warm' : ''}`}>{num}</span>
        <div className="ap-ex-body">
          <div className="ap-ex-top">
            <div className="ap-ex-title-row">
              <h4 className="ap-ex-title">{nombreDisplayPlan(it.nombre)}</h4>
              {musculo && (
                <span className={`ap-pill${warm ? ' ap-pill--warm' : ' ap-pill--muted'}`}>{musculo}</span>
              )}
            </div>
                            {origenEditable && (
              <div className="ap-ex-actions">
                <button type="button" className="ap-ico" onClick={() => iniciarEdit(idx)} title="Editar" aria-label="Editar"><IconPencil size={14} /></button>
                <button type="button" className="ap-ico is-danger" onClick={() => onQuitarEjercicio(idx)} title="Quitar" aria-label="Quitar"><IconClose size={14} /></button>
              </div>
            )}
          </div>
          <div className="ap-metrics">
            {(it.series || it.repeticiones) ? (
              <span className="ap-metric ap-metric--blue">
                {it.series && it.repeticiones
                  ? `${it.series} × ${it.repeticiones}${/reps?/i.test(it.repeticiones) ? '' : ' reps'}`
                  : it.series
                    ? `${it.series} series`
                    : `${it.repeticiones} reps`}
              </span>
            ) : warm ? (
              <span className="ap-metric-muted">Sin series/reps sugeridas adicionales</span>
            ) : (
              <span className="ap-metric-muted">Sin series/reps</span>
            )}
            {it.carga ? <span className="ap-metric">Carga: {it.carga}</span> : null}
            {enSs && it.descansoPostRonda ? (
              <span className="ap-metric ap-metric--violet">Descanso: al terminar ronda ({it.descansoPostRonda}s)</span>
            ) : !enSs && it.descansoPostRonda ? (
              <span className="ap-metric">Descanso: {it.descansoPostRonda}s</span>
            ) : null}
            {enSs && ssLabel ? <span className="ap-metric ap-metric--violet">SS {ssLabel}</span> : null}
          </div>
          {it.notas ? (
            <div className="ap-notas">
              <button
                type="button"
                className="ap-notas-toggle"
                onClick={() => setNotasAbiertas((p) => ({ ...p, [idx]: !p[idx] }))}
              >
                {notasOpen ? 'Ocultar notas' : 'Ver notas técnicas'}
              </button>
              {notasOpen && <p className="ap-notas-text">“{it.notas}”</p>}
            </div>
          ) : null}
          {origenEditable && !enSs && idx < ejerciciosDelDia.length - 1 && !it.superserie && (
            <button
              type="button"
              className="ap-link-ss"
              onClick={() => onVincularSuperserie(idx)}
            >
              ⚡ Vincular en superserie con el siguiente
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ap-root">
      <div className="ap-main">
        <div className="ap-panel">
          <div className="ap-panel-head">
            <div>
              <h2 className="ap-title">Armá tu plan</h2>
              <p className="ap-sub">Días con enfoque, ejercicios estructurados y superseries visuales.</p>
            </div>
            {origenEditable && (
              <button type="button" className="ap-btn ap-btn--primary" onClick={onAñadirDia}>
                + Día
              </button>
            )}
          </div>

          <div className="ap-days" role="tablist" aria-label="Días del plan">
            {dias.map((d, di) => {
              const activo = diaEditando === d.id
              const cant = (d.ejercicios || []).length
              const titulo = tituloDia(d, di)
              const enf = inferirGruposMuscularesDia(d.ejercicios || [])
              return (
                <div key={d.id} className={`ap-day ap-day--tone-${di % 6}${activo ? ' is-active' : ''}`}>
                  <button
                    type="button"
                    className="ap-day-main"
                    role="tab"
                    aria-selected={activo}
                    onClick={() => { setDiaEditando(d.id); cancelarEdit() }}
                  >
                    <div className="ap-day-top">
                      <span className="ap-day-label">Día {di + 1}</span>
                      <span className="ap-day-count">{cant}</span>
                    </div>
                    <span className="ap-day-focus">{enf || titulo.replace(/^Día\s*\d+:\s*/i, '') || 'Sin enfoque'}</span>
                  </button>
                  {activo && origenEditable ? (
                    <div className="ap-day-tools">
                      <button type="button" className="ap-day-tool" disabled={di === 0} onClick={() => onMoverDia(d.id, -1)} title="Subir" aria-label="Subir">
                        <IconChevronUp />
                      </button>
                      <button type="button" className="ap-day-tool" disabled={di === dias.length - 1} onClick={() => onMoverDia(d.id, 1)} title="Bajar" aria-label="Bajar">
                        <IconChevronDown />
                      </button>
                      <button type="button" className="ap-day-tool" onClick={() => promptRenombrar(d)} title="Renombrar" aria-label="Renombrar">
                        <IconPencil />
                      </button>
                      <button type="button" className="ap-day-tool is-danger" disabled={dias.length <= 1} onClick={() => onQuitarDia(d.id)} title="Quitar" aria-label="Quitar">
                        <IconClose />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="ap-day-edit-link" onClick={() => { setDiaEditando(d.id); cancelarEdit() }}>
                      Editar
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {origenEditable && (
            <div className="ap-add">
              <p className="ap-add-label">Agregar ejercicio a {diaActual?.nombre || 'este día'}</p>
              <div className="ap-add-row">
                <div className="ap-search">
                  <span aria-hidden>🔍</span>
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar ejercicio en la biblioteca (ej. Press banca, Sentadilla…)"
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && busqueda.trim()) {
                        e.preventDefault()
                        const pick = catalogo[0] || busqueda.trim()
                        onAñadirEjercicio(pick)
                        setBusqueda('')
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="ap-btn ap-btn--ghost"
                  onClick={() => {
                    const n = window.prompt('Nombre del ejercicio personalizado')
                    if (n?.trim()) {
                      onAñadirEjercicio(n.trim())
                      setBusqueda('')
                    }
                  }}
                >
                  + Crear personalizado
                </button>
              </div>
              <div className="ap-filters" role="group" aria-label="Filtros musculares">
                {FILTROS_BIBLIOTECA.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`ap-filter${filtro === f.id ? ' is-active' : ''}`}
                    onClick={() => setFiltro(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {(busqueda.trim() || filtro !== 'Todos') && catalogo.length > 0 && (
                <ul className="ap-suggest">
                  {catalogo.map((ex) => (
                    <li key={ex}>
                      <button
                        type="button"
                        onClick={() => {
                          onAñadirEjercicio(ex)
                          setBusqueda('')
                        }}
                      >
                        <span>+ {ex}</span>
                        <span className="ap-suggest-g">{inferirGrupoMuscular(ex)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {busqueda.trim() && catalogo.length === 0 && (
                <button
                  type="button"
                  className="ap-btn ap-btn--ghost ap-btn--sm"
                  onClick={() => {
                    onAñadirEjercicio(busqueda.trim())
                    setBusqueda('')
                  }}
                >
                  + Agregar “{busqueda.trim()}”
                </button>
              )}
            </div>
          )}

          <div className="ap-list-head">
            <h3 className="ap-list-title">
              {tituloDia(diaActual || { nombre: 'Día' }, dias.findIndex((d) => d.id === diaActual?.id))}
              <span className="ap-list-count"> · {ejerciciosDelDia.length} ejercicio{ejerciciosDelDia.length !== 1 ? 's' : ''}</span>
            </h3>
            <span className="ap-list-hint">arrastrá ⠿ para ordenar</span>
          </div>

          {ejerciciosDelDia.length === 0 ? (
            <div className="ap-empty">
              <p className="mb-0">Todavía no hay ejercicios en este día.</p>
              <p className="ap-empty-sub mb-0">Buscá arriba o creá uno personalizado.</p>
            </div>
          ) : (
            <div className={`ap-list${drag ? ' is-dragging' : ''}`} ref={listRef}>
              {bloques.map((bloque) => {
                if (bloque.tipo === 'superserie') {
                  const descanso = bloque.descansoPostRonda || '90'
                  return (
                    <div key={bloque.id} className="ap-ss">
                      <div className="ap-ss-head">
                        <span className="ap-ss-badge">⚡ SUPERSERIE {bloque.label}</span>
                        <span className="ap-ss-meta">
                          Ejercicios combinados sin pausa intermedia · Descanso fin de ronda: <strong>{descanso} seg</strong>
                        </span>
                        {origenEditable && (
                          <div className="ap-ss-actions">
                            <button
                              type="button"
                              className="ap-btn ap-btn--ghost ap-btn--sm"
                              onClick={() => iniciarEdit(bloque.indices[0])}
                            >
                              Editar ronda
                            </button>
                            <button
                              type="button"
                              className="ap-btn ap-btn--ghost ap-btn--sm"
                              onClick={() => onDesvincularSuperserie(bloque.label)}
                            >
                              Desvincular
                            </button>
                          </div>
                        )}
                      </div>
                      {bloque.items.map((it, i) => (
                        <div key={`${bloque.id}-${i}`}>
                          {renderCard(it, bloque.indices[i], { enSs: true, ssLabel: bloque.label })}
                          {i < bloque.items.length - 1 && (
                            <div className="ap-ss-link">
                              <span>+ Sin descanso intermedio</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                }
                return renderCard(bloque.items[0], bloque.indices[0])
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="ap-side">
        <div className="ap-side-card">
          <div className="ap-side-head">
            <h3 className="ap-side-title">Resumen del {diaActual?.nombre || 'día'}</h3>
            {resumen.seriesEfectivas > 0 && (
              <span className="ap-side-badge">Optimizado</span>
            )}
          </div>
          <div className="ap-kpi-grid">
            <div className="ap-kpi">
              <span className="ap-kpi-label">Total ejercicios</span>
              <span className="ap-kpi-value">{resumen.totalEjercicios} <small>items</small></span>
            </div>
            <div className="ap-kpi">
              <span className="ap-kpi-label">Series efectivas</span>
              <span className="ap-kpi-value is-green">{resumen.seriesEfectivas} <small>sets</small></span>
            </div>
            <div className="ap-kpi">
              <span className="ap-kpi-label">Tiempo estimado</span>
              <span className="ap-kpi-value is-blue">~{resumen.tiempoMin} <small>min</small></span>
            </div>
            <div className="ap-kpi">
              <span className="ap-kpi-label">Volumen carga</span>
              <span className="ap-kpi-value is-amber">{formatVolumen(resumen.volumenKg)}</span>
            </div>
          </div>
          <p className="ap-side-note">
            {resumen.superseries > 0
              ? `Plan con ${resumen.superseries} superserie${resumen.superseries !== 1 ? 's' : ''} para acortar tiempos de sesión.`
              : enfoque !== 'Sin enfoque'
                ? `Enfoque del día: ${enfoque}.`
                : 'Agregá ejercicios para ver el balance del día.'}
          </p>
        </div>

        <div className="ap-side-card">
          <div className="ap-side-head">
            <h3 className="ap-side-title">Distribución muscular</h3>
            <span className="ap-side-meta">{resumen.seriesEfectivas} series</span>
          </div>
          {resumen.distribucion.length === 0 ? (
            <p className="ap-side-empty">Sin series todavía.</p>
          ) : (
            <ul className="ap-dist">
              {resumen.distribucion.map((row) => (
                <li key={row.grupo}>
                  <div className="ap-dist-top">
                    <span>{row.grupo}</span>
                    <span>{row.series} · {row.pct}%</span>
                  </div>
                  <div className="ap-dist-bar">
                    <span
                      style={{
                        width: `${Math.max(row.pct, 4)}%`,
                        background: DIST_COLORS[row.grupo] || DIST_COLORS.Otro,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ap-side-actions">
          {onExportarPdf && (
            <button type="button" className="ap-btn ap-btn--ghost ap-btn--block" onClick={onExportarPdf}>
              ⬇ Descargar plantilla imprimible
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
