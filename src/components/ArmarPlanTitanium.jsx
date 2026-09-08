import { useMemo, useState, useEffect } from 'react'
import { useStorage } from '../hooks/useStorage'
import {
  itemEjercicioDiaNormalizado,
  inferirGruposMuscularesDia,
  inferirGrupoMuscular,
  resumenPlanDia,
  GRUPOS_MUSCULARES_OPCIONES,
} from '../utils/rutinaEjercicioDia'
import { grupoMuscularTone } from './profe/profeCatalogoUi'
import {
  applyProfeCatalogoSeedSync,
  buscarSugerenciasCatalogo,
  catalogoItemNormalizado,
  getCategoriaCatalogo,
} from '../utils/profeCatalogo'
import ProfeCatalogoPickerModal from './profe/ProfeCatalogoPickerModal'
import CatalogoEjercicioSuggest from './profe/CatalogoEjercicioSuggest'
import './profe/ProfeTitanium.css'

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

function formatVolumen(kg) {
  if (!kg || kg <= 0) return '—'
  if (kg >= 1000) return `~${(kg / 1000).toFixed(1)}k kg`
  return `~${Math.round(kg)} kg`
}

function normalizarNombrePlan(n) {
  return String(n || '').trim().toLocaleUpperCase('es')
}

function rowPlan(e) {
  const it = itemEjercicioDiaNormalizado(e)
  if (!it) return null
  const raw = typeof e === 'object' && e ? e : {}
  return {
    ...it,
    descansoPostRonda:
      it.descansoPostRonda ||
      (raw.descansoPostRonda != null ? String(raw.descansoPostRonda) : '') ||
      (raw.descanso != null ? String(raw.descanso) : ''),
    carga: it.carga || (raw.carga != null ? String(raw.carga) : ''),
    grupoMuscular: it.grupoMuscular || inferirGrupoMuscular(it.nombre),
    notas: it.notas || (raw.notas != null ? String(raw.notas).trim() : ''),
  }
}

function grupoMuscularDisplay(row) {
  const inferido = inferirGrupoMuscular(row?.nombre)
  const guardado = String(row?.grupoMuscular || '').trim()
  if (guardado && guardado !== 'Otro' && GRUPOS_MUSCULARES_OPCIONES.includes(guardado)) return guardado
  return GRUPOS_MUSCULARES_OPCIONES.includes(inferido) ? inferido : 'Otro'
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
  onDuplicarDia,
  onMoverDia,
  onRenombrarDia,
  onQuitarDia,
  onAñadirEjercicio,
  onAñadirEjerciciosCatalogo,
  onQuitarEjercicio,
  onGuardarEjercicio,
  onDuplicarEjercicio,
  onReordenar,
  onVincularSuperserie,
  onDesvincularSuperserie,
  onExportarPdf,
  onToast,
}) {
  const [busqueda, setBusqueda] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestIdx, setSuggestIdx] = useState(-1)
  const [catalogoAbierto, setCatalogoAbierto] = useState(false)
  const [catalogo, setCatalogo] = useStorage('profeCatalogoEjercicios', [])
  const [, setCatalogoMeta] = useStorage('profeCatalogoMeta', { seedVersion: 0 })
  const [favoritos, setFavoritos] = useStorage('profeCatalogoFavoritos', [])
  const [categoriasCustom, setCategoriasCustom] = useStorage('profeCatalogoCategorias', [])

  useEffect(() => {
    applyProfeCatalogoSeedSync(setCatalogo, setCatalogoMeta)
  }, [setCatalogo, setCatalogoMeta])

  const listC = useMemo(
    () =>
      (Array.isArray(catalogo) ? catalogo : [])
        .map((c) => catalogoItemNormalizado(c))
        .filter(Boolean)
        .filter((c) => String(c.nombre || '').trim()),
    [catalogo],
  )
  const listCOrdenado = useMemo(
    () =>
      [...listC].sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), undefined, { sensitivity: 'base' }),
      ),
    [listC],
  )

  const sugerencias = useMemo(
    () => buscarSugerenciasCatalogo(listCOrdenado, busqueda, { limit: 8 }),
    [listCOrdenado, busqueda],
  )

  const sugerenciasTotal = sugerencias.length + (busqueda.trim() ? 1 : 0)

  const diaIdx = useMemo(() => dias.findIndex((d) => d.id === diaActual?.id), [dias, diaActual?.id])

  const filasDelDia = useMemo(
    () => (ejerciciosDelDia || []).map(rowPlan).filter(Boolean),
    [ejerciciosDelDia],
  )

  const enfoque = useMemo(
    () => inferirGruposMuscularesDia(ejerciciosDelDia) || 'Sin enfoque',
    [ejerciciosDelDia]
  )
  const resumen = useMemo(() => resumenPlanDia(ejerciciosDelDia), [ejerciciosDelDia])

  const abrirCatalogo = () => {
    applyProfeCatalogoSeedSync(setCatalogo, setCatalogoMeta)
    setCatalogoAbierto(true)
  }

  const agregarPersonalizado = (nombreRaw) => {
    const n = String(nombreRaw ?? busqueda).trim() || window.prompt('Nombre del ejercicio personalizado')
    if (n?.trim()) {
      onAñadirEjercicio(n.trim())
      setBusqueda('')
      setSuggestOpen(false)
      setSuggestIdx(-1)
    }
  }

  const agregarDesdeCatalogo = (item) => {
    if (!item?.nombre) return
    onAñadirEjercicio({
      nombre: String(item.nombre).trim(),
      notas: String(item.notas || '').trim(),
      categoria: getCategoriaCatalogo(item),
    })
    setBusqueda('')
    setSuggestOpen(false)
    setSuggestIdx(-1)
    onToast?.({ msg: `«${item.nombre}» sumado al día.` })
  }

  const onBusquedaChange = (value) => {
    setBusqueda(value)
    setSuggestOpen(Boolean(String(value).trim()))
    setSuggestIdx(-1)
  }

  const onBusquedaKeyDown = (e) => {
    if (!busqueda.trim()) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestOpen(true)
      setSuggestIdx((i) => (i + 1) % sugerenciasTotal)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestOpen(true)
      setSuggestIdx((i) => (i <= 0 ? sugerenciasTotal - 1 : i - 1))
      return
    }
    if (e.key === 'Escape') {
      setSuggestOpen(false)
      setSuggestIdx(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestIdx >= 0 && suggestIdx < sugerencias.length) {
        agregarDesdeCatalogo(sugerencias[suggestIdx])
        return
      }
      if (suggestIdx === sugerencias.length || sugerencias.length === 0) {
        agregarPersonalizado(busqueda)
        return
      }
      if (sugerencias.length === 1) {
        agregarDesdeCatalogo(sugerencias[0])
      }
    }
  }

  const patchEjercicioCampo = (idx, campo, valor) => {
    const prev = rowPlan(ejerciciosDelDia[idx])
    if (!prev) return
    const next = {
      ...prev,
      [campo]: campo === 'nombre' ? normalizarNombrePlan(valor) : valor,
    }
    if (campo === 'nombre') {
      const guardado = String(prev.grupoMuscular || '').trim()
      if (!guardado || guardado === 'Otro') {
        const sugerido = inferirGrupoMuscular(next.nombre)
        if (sugerido !== 'Otro') next.grupoMuscular = sugerido
      }
    }
    onGuardarEjercicio?.(idx, next)
  }

  const aplicarCategoriasSugeridas = () => {
    let n = 0
    filasDelDia.forEach((row, idx) => {
      const guardado = String(row.grupoMuscular || '').trim()
      if (guardado && guardado !== 'Otro') return
      const sugerido = inferirGrupoMuscular(row.nombre)
      if (sugerido === 'Otro') return
      onGuardarEjercicio?.(idx, { ...row, grupoMuscular: sugerido })
      n += 1
    })
    onToast?.({ msg: n ? `Categorías sugeridas en ${n} ejercicio${n === 1 ? '' : 's'}.` : 'No había categorías para inferir.' })
  }

  const reordenarEjercicioDrag = (desde, hasta) => {
    if (desde == null || hasta == null || desde === hasta) return
    onReordenar?.(desde, hasta)
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

  const diaTone = (diaIdx >= 0 ? diaIdx : 0) % 6

  const renderFilaEjercicio = (row, idx) => {
    const prev = filasDelDia[idx - 1]
    const grupoVal = grupoMuscularDisplay(row)
    const payload = JSON.stringify({ idx })
    const enSs = Boolean(row.superserie)
    const esPrimeroSs = enSs && (!prev || prev.superserie !== row.superserie)
    const esContinuacionSs = enSs && prev?.superserie === row.superserie
    const showVincular = origenEditable && !enSs && idx < filasDelDia.length - 1
    const ro = !origenEditable

    return (
      <li key={`ap-ex-${idx}`} className="ap-ws-exercise-item">
        {esContinuacionSs ? (
          <div className="ap-ss-link">
            <span>+ Sin descanso intermedio</span>
          </div>
        ) : null}
        {esPrimeroSs ? (
          <div className="ap-ss-inline-head">
            <span className="ap-ss-badge">⚡ SUPERSERIE {row.superserie}</span>
            {row.descansoPostRonda ? (
              <span className="ap-ss-meta">Descanso fin de ronda: {row.descansoPostRonda}s</span>
            ) : null}
            {origenEditable ? (
              <button type="button" className="pf-ws-link-btn" onClick={() => onDesvincularSuperserie(row.superserie)}>
                Desvincular
              </button>
            ) : null}
          </div>
        ) : null}
        <div
          className={`pf-ws-exercise-row pf-ws-exercise-row--tone-${diaTone}${enSs ? ' is-ss-row' : ''}`}
          draggable={origenEditable}
          onDragStart={(e) => {
            if (!origenEditable) return
            e.dataTransfer.setData('application/x-ap-plan-ej', payload)
            e.dataTransfer.setData('text/plain', payload)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(e) => {
            e.preventDefault()
            let data
            try {
              data = JSON.parse(e.dataTransfer.getData('application/x-ap-plan-ej') || '{}')
            } catch {
              return
            }
            if (typeof data.idx === 'number') reordenarEjercicioDrag(data.idx, idx)
          }}
        >
          <span className="pf-ws-drag" title="Arrastrar para reordenar" aria-hidden>
            ::
          </span>
          <span className="pf-ws-exercise-index">{idx + 1}</span>
          <div className="pf-ws-exercise-info">
            <input
              className="pf-ws-exercise-name"
              value={row.nombre}
              readOnly={ro}
              disabled={ro}
              onChange={(e) => patchEjercicioCampo(idx, 'nombre', e.target.value)}
              placeholder="Nombre del ejercicio"
              title={row.nombre || 'Nombre del ejercicio'}
            />
            <label className="pf-ws-exercise-comment">
              <span className="pf-ws-exercise-comment-label">Comentario</span>
              <input
                type="text"
                value={row.notas || ''}
                readOnly={ro}
                disabled={ro}
                onChange={(e) => patchEjercicioCampo(idx, 'notas', e.target.value)}
                placeholder="Técnica, ritmo, variantes…"
              />
            </label>
          </div>
          <div className="pf-ws-exercise-fields">
            <label className="pf-ws-field-box pf-ws-field-box--muscle">
              <span>Grupo</span>
              <select
                className={`pf-ws-muscle-select pf-ws-muscle--${grupoMuscularTone(grupoVal)}`}
                value={grupoVal}
                disabled={ro}
                onChange={(e) => patchEjercicioCampo(idx, 'grupoMuscular', e.target.value)}
                aria-label="Grupo muscular"
              >
                {GRUPOS_MUSCULARES_OPCIONES.map((g) => (
                  <option key={g} value={g}>
                    {g.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-ws-field-box">
              <span>Series</span>
              <input
                type="text"
                inputMode="numeric"
                value={row.series || ''}
                readOnly={ro}
                disabled={ro}
                onChange={(e) => patchEjercicioCampo(idx, 'series', e.target.value)}
                placeholder="4"
              />
            </label>
            <label className="pf-ws-field-box">
              <span>Rango</span>
              <input
                type="text"
                value={row.repeticiones || ''}
                readOnly={ro}
                disabled={ro}
                onChange={(e) => patchEjercicioCampo(idx, 'repeticiones', e.target.value)}
                placeholder="6 - 8"
              />
            </label>
            <label className="pf-ws-field-box">
              <span>Descanso</span>
              <input
                type="text"
                value={row.descansoPostRonda || ''}
                readOnly={ro}
                disabled={ro}
                onChange={(e) => patchEjercicioCampo(idx, 'descansoPostRonda', e.target.value)}
                placeholder="120s"
              />
            </label>
            <label className="pf-ws-field-box">
              <span>Carga</span>
              <input
                type="text"
                value={row.carga || ''}
                readOnly={ro}
                disabled={ro}
                onChange={(e) => patchEjercicioCampo(idx, 'carga', e.target.value)}
                placeholder="25 kg"
              />
            </label>
          </div>
          {origenEditable ? (
            <div className="pf-ws-exercise-actions">
              <button type="button" className="pf-ws-icon-btn" title="Duplicar fila" onClick={() => onDuplicarEjercicio?.(idx)}>
                ⧉
              </button>
              <button
                type="button"
                className="pf-ws-icon-btn pf-ws-icon-btn--danger"
                title="Quitar ejercicio"
                onClick={() => onQuitarEjercicio(idx)}
              >
                ×
              </button>
            </div>
          ) : null}
        </div>
        {showVincular ? (
          <button type="button" className="ap-link-ss" onClick={() => onVincularSuperserie(idx)}>
            ⚡ Vincular en superserie con el siguiente
          </button>
        ) : null}
      </li>
    )
  }

  return (
    <div className="ap-root">
      <div className="ap-main">
        <div className="ap-panel">
          <div className="ap-panel-head">
            <div>
              <h2 className="ap-title">Armá tu plan</h2>
              <p className="ap-sub">
                Días, catálogo de gym, superseries, resumen y distribución muscular — como en plantillas del profe.
              </p>
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
                    onClick={() => setDiaEditando(d.id)}
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
                      <button type="button" className="ap-day-tool" onClick={() => onDuplicarDia?.(d.id)} title="Duplicar día" aria-label="Duplicar día">
                        <span className="ap-day-tool-txt">⧉</span>
                      </button>
                      <button type="button" className="ap-day-tool" onClick={() => promptRenombrar(d)} title="Renombrar" aria-label="Renombrar">
                        <IconPencil />
                      </button>
                      <button type="button" className="ap-day-tool is-danger" disabled={dias.length <= 1} onClick={() => onQuitarDia(d.id)} title="Quitar" aria-label="Quitar">
                        <IconClose />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="ap-day-edit-link" onClick={() => setDiaEditando(d.id)}>
                      Editar
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {origenEditable ? (
            <div className={`ap-ws-block pf-ws-exercise-panel pf-ws-day-tone-${diaTone}`}>
              <p className="ap-add-label mb-2">
                Agregar ejercicios al {diaActual?.nombre || `Día ${diaIdx + 1}`}
              </p>
              <div className="pf-ws-exercise-toolbar">
                <div className="pf-ws-exercise-toolbar-top">
                  <div className="pf-ws-exercise-search-wrap">
                    <span className="pf-ws-search-icon" aria-hidden>
                      ⌕
                    </span>
                    <input
                      type="search"
                      className="pf-ws-exercise-search"
                      value={busqueda}
                      onChange={(e) => onBusquedaChange(e.target.value)}
                      onFocus={() => busqueda.trim() && setSuggestOpen(true)}
                      onBlur={() => window.setTimeout(() => setSuggestOpen(false), 120)}
                      onKeyDown={onBusquedaKeyDown}
                      placeholder="Buscar ejercicio del catálogo (ej. Press banca…)"
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={suggestOpen && Boolean(busqueda.trim())}
                      aria-autocomplete="list"
                    />
                    <CatalogoEjercicioSuggest
                      open={suggestOpen}
                      query={busqueda}
                      items={sugerencias}
                      highlightIdx={suggestIdx}
                      onPick={agregarDesdeCatalogo}
                      onAddCustom={agregarPersonalizado}
                      variant="pf"
                    />
                  </div>
                  <button type="button" className="pf-btn pf-btn--outline pf-btn--sm pf-ws-btn-catalog" onClick={abrirCatalogo}>
                    <span className="pf-ws-btn-icon" aria-hidden>
                      ▦
                    </span>
                    Ver catálogo
                  </button>
                  <button type="button" className="pf-btn pf-btn--primary pf-btn--sm pf-ws-btn-custom" onClick={() => agregarPersonalizado()}>
                    + Personalizado
                  </button>
                </div>
                <p className="pf-ws-catalog-collapsed-hint mb-0">
                  Escribí para ver sugerencias del catálogo. Tocá una o usá <strong>+ Personalizado</strong> / Enter para el
                  nombre que escribiste. La biblioteca completa está en <strong>Ver catálogo</strong>.
                </p>
              </div>

              <div className="pf-ws-exercise-list-head">
                <span>
                  Lista de ejercicios cargados ({filasDelDia.length} en {diaActual?.nombre || `Día ${diaIdx + 1}`})
                </span>
                <span className="pf-ws-exercise-list-hint">
                  Arrastrá desde <strong>::</strong> para reordenar
                  {origenEditable ? (
                    <>
                      {' '}
                      ·{' '}
                      <button type="button" className="pf-ws-link-btn" onClick={aplicarCategoriasSugeridas}>
                        Aplicar categorías sugeridas
                      </button>
                    </>
                  ) : null}
                </span>
              </div>

              {filasDelDia.length === 0 ? (
                <div className="pf-ws-exercise-empty">
                  <p className="pf-ws-exercise-empty-title">Sin ejercicios en este día</p>
                  <p className="pf-ws-exercise-empty-text">
                    Abrí <strong>Ver catálogo</strong> para elegir ejercicios o tocá <strong>+ Personalizado</strong>.
                  </p>
                </div>
              ) : (
                <ul className="pf-ws-exercise-list">{filasDelDia.map((row, idx) => renderFilaEjercicio(row, idx))}</ul>
              )}
            </div>
          ) : (
            <div className={`ap-ws-block pf-ws-exercise-panel ap-ws-readonly pf-ws-day-tone-${diaTone}`}>
              <div className="pf-ws-exercise-list-head">
                <span>
                  Lista de ejercicios ({filasDelDia.length} en {diaActual?.nombre || `Día ${diaIdx + 1}`})
                </span>
              </div>
              {filasDelDia.length === 0 ? (
                <div className="pf-ws-exercise-empty">
                  <p className="pf-ws-exercise-empty-title mb-0">Sin ejercicios en este día</p>
                </div>
              ) : (
                <ul className="pf-ws-exercise-list">{filasDelDia.map((row, idx) => renderFilaEjercicio(row, idx))}</ul>
              )}
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

      <ProfeCatalogoPickerModal
        open={catalogoAbierto}
        dayLabel={diaActual?.nombre || `Día ${diaIdx + 1}`}
        dayTone={diaIdx >= 0 ? diaIdx : 0}
        items={listCOrdenado}
        setItems={setCatalogo}
        favoritos={favoritos}
        setFavoritos={setFavoritos}
        categoriasCustom={categoriasCustom}
        setCategoriasCustom={setCategoriasCustom}
        initialQ={busqueda.trim()}
        onClose={() => setCatalogoAbierto(false)}
        onApply={(picked) => {
          if (picked?.length) onAñadirEjerciciosCatalogo?.(picked)
          setCatalogoAbierto(false)
          setBusqueda('')
        }}
        onToast={onToast}
      />
    </div>
  )
}
