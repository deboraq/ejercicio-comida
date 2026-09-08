import { useMemo, useState, useRef, useCallback } from 'react'
import {
  itemEjercicioDiaNormalizado,
  nombreDisplayPlan,
  inferirGruposMuscularesDia,
  inferirGrupoMuscular,
  esCalentamientoPlan,
  agruparPlanEnBloques,
  resumenPlanDia,
} from '../utils/rutinaEjercicioDia'

function IconCloud({ className }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 16V8m0 0-3 3m3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCopy({ className }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function badgeMusculo(grupo) {
  if (!grupo || grupo === 'Otro') return null
  if (grupo === 'Calentamiento') return 'Calentamiento'
  if (grupo === 'Espalda') return 'Espalda / Dorsal'
  if (grupo === 'Piernas') return 'Piernas'
  return grupo
}

function tituloDia(d, di) {
  const raw = String(d.nombre || '').trim()
  if (raw && !/^d[ií]a\s*\d+$/i.test(raw)) return raw
  const enf = inferirGruposMuscularesDia(d.ejercicios || [])
  return enf ? `Día ${di + 1}: ${enf}` : `Día ${di + 1}`
}

function formatearFechaAsignacion(fecha) {
  if (!fecha) return ''
  const d = new Date(`${fecha}T12:00:00`)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function displayNum(ejercicios, idx) {
  const it = itemEjercicioDiaNormalizado(ejercicios[idx])
  if (!it || esCalentamientoPlan(it)) return 0
  let n = 0
  for (let i = 0; i <= idx; i += 1) {
    const cur = itemEjercicioDiaNormalizado(ejercicios[i])
    if (!cur || esCalentamientoPlan(cur)) continue
    n += 1
  }
  return n
}

function panelMinHeightPx(dias = []) {
  const maxBloques = Math.max(
    1,
    ...dias.map((d) => agruparPlanEnBloques(d.ejercicios || []).length),
  )
  return maxBloques * 92 + 72
}

function EjercicioAsignadoCard({ it, idx, ejercicios }) {
  const warm = esCalentamientoPlan(it)
  const num = displayNum(ejercicios, idx)
  const musculo = badgeMusculo(it.grupoMuscular || inferirGrupoMuscular(it))
  const seriesReps =
    it.series && it.repeticiones
      ? `${it.series} × ${it.repeticiones}${/reps?/i.test(String(it.repeticiones)) ? '' : ' reps'}`
      : it.repeticiones || it.series || '—'

  return (
    <article className={`ra-ex${warm ? ' ra-ex--warm' : ''}`}>
      <span className={`ra-ex-num${warm ? ' is-warm' : ''}`}>{warm ? '0' : num}</span>
      <div className="ra-ex-body">
        <div className="ra-ex-top">
          <div className="ra-ex-title-row">
            <h4 className="ra-ex-title">{nombreDisplayPlan(it.nombre)}</h4>
            {musculo ? <span className={`ra-pill${warm ? ' ra-pill--warm' : ''}`}>{musculo}</span> : null}
          </div>
        </div>
        <div className="ra-ex-metrics">
          <span className="ra-metric ra-metric--blue">{seriesReps}</span>
          {it.carga ? <span className="ra-metric">{it.carga}</span> : null}
          {it.superserie ? <span className="ra-metric ra-metric--ss">SS {it.superserie}</span> : null}
        </div>
        {it.notas ? <p className="ra-ex-nota mb-0">{it.notas}</p> : null}
      </div>
    </article>
  )
}

function BloqueSuperserieAsignado({ bloque, ejercicios }) {
  return (
    <div className="ra-ss">
      <div className="ra-ss-head">
        <span className="ra-ss-badge">Superserie {bloque.label}</span>
        {bloque.descansoPostRonda ? (
          <span className="ra-ss-rest">Descanso {bloque.descansoPostRonda}s entre rondas</span>
        ) : null}
      </div>
      {bloque.items.map((it, sub) => (
        <EjercicioAsignadoCard
          key={`${it.nombre}-${bloque.startIdx + sub}`}
          it={it}
          idx={bloque.indices[sub]}
          ejercicios={ejercicios}
        />
      ))}
    </div>
  )
}

function rutinaStableKey(r) {
  return String(r._asignacion?.assignmentId || r.id || '')
}

function RutinaAsignadaCard({ rutina, diaIdx, onSelectDia, onCopiar, onQuitar }) {
  const dias = rutina.dias || []
  const dia = dias[diaIdx] || dias[0]
  const ejercicios = dia?.ejercicios || []
  const bloques = useMemo(() => agruparPlanEnBloques(ejercicios), [ejercicios])
  const resumen = useMemo(() => resumenPlanDia(ejercicios), [ejercicios])
  const totalEjercicios = dias.reduce((s, d) => s + (d.ejercicios?.length || 0), 0)
  const diaTone = diaIdx % 6
  const minPanelH = useMemo(() => panelMinHeightPx(dias), [dias])
  const tabsRef = useRef(null)
  const panelRef = useRef(null)

  const handleSelectDia = useCallback(
    (i, e) => {
      e?.preventDefault()
      const scrollY = window.scrollY
      onSelectDia(i)
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
        const tab = tabsRef.current?.querySelector(`[data-day-idx="${i}"]`)
        tab?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      })
    },
    [onSelectDia],
  )

  return (
    <article className={`ra-card ra-card--tone-${diaTone}`}>
      <header className="ra-card-head">
        <div className="ra-card-head-main">
          <div className="ra-card-title-row">
            <h3 className="ra-card-title mb-0">{rutina.nombre}</h3>
            <span className="ra-badge-cloud">Cloud</span>
          </div>
          {rutina._asignacion ? (
            <p className="ra-card-meta mb-0">
              Asignada por <strong>{rutina._asignacion.por}</strong>
              {rutina._asignacion.fecha ? ` · ${formatearFechaAsignacion(rutina._asignacion.fecha)}` : ''}
            </p>
          ) : (
            <p className="ra-card-meta mb-0">Importada manualmente (no sincronizada con el servidor).</p>
          )}
          <div className="ra-card-kpis">
            <span className="ra-kpi">{dias.length} día{dias.length !== 1 ? 's' : ''}</span>
            <span className="ra-kpi">{totalEjercicios} ejercicio{totalEjercicios !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="ra-card-actions">
          <button type="button" className="ra-btn ra-btn--primary" onClick={() => onCopiar(rutina)}>
            <IconCopy />
            Copiar a mis rutinas
          </button>
          <button type="button" className="ra-btn ra-btn--ghost" onClick={() => onQuitar(rutina)}>
            Quitar
          </button>
        </div>
      </header>

      {dias.length > 0 && (
        <div className="ra-card-body">
          <div className="ra-days-sticky">
            <div className="ra-days" ref={tabsRef} role="tablist" aria-label="Días de la rutina">
              {dias.map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  data-day-idx={i}
                  aria-selected={i === diaIdx}
                  className={`ra-day ra-day--tone-${i % 6}${i === diaIdx ? ' is-active' : ''}`}
                  onClick={(e) => handleSelectDia(i, e)}
                >
                  <span className="ra-day-label">{tituloDia(d, i)}</span>
                  <span className="ra-day-count">{(d.ejercicios || []).length} ej.</span>
                </button>
              ))}
            </div>
          </div>

          <div
            ref={panelRef}
            className="ra-day-panel"
            style={{ minHeight: `${minPanelH}px` }}
          >
            <div className="ra-day-summary">
              <span>{resumen.seriesEfectivas || 0} series</span>
              {inferirGruposMuscularesDia(ejercicios) ? (
                <span> · {inferirGruposMuscularesDia(ejercicios)}</span>
              ) : null}
              {resumen.superseries ? (
                <span>
                  {' '}
                  · {resumen.superseries} superserie{resumen.superseries !== 1 ? 's' : ''}
                </span>
              ) : null}
            </div>

            {ejercicios.length === 0 ? (
              <p className="ra-empty-day mb-0">Este día no tiene ejercicios en la plantilla.</p>
            ) : (
              <div className="ra-plan">
                {bloques.map((bloque) =>
                  bloque.tipo === 'superserie' ? (
                    <BloqueSuperserieAsignado
                      key={bloque.id}
                      bloque={bloque}
                      ejercicios={ejercicios}
                    />
                  ) : (
                    <EjercicioAsignadoCard
                      key={bloque.id}
                      it={bloque.items[0]}
                      idx={bloque.startIdx}
                      ejercicios={ejercicios}
                    />
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

export default function RutinasAsignadasTitanium({
  rutinasAsignadas = [],
  syncRutinasNube,
  onCopiar,
  onQuitar,
  onRefreshAssignments,
}) {
  const [diaPorRutina, setDiaPorRutina] = useState({})

  const setDia = (rutinaKey, idx) => {
    if (!rutinaKey) return
    setDiaPorRutina((prev) => ({ ...prev, [rutinaKey]: idx }))
  }

  return (
    <div className="ra-root">
      <div className="ra-hero">
        <div className="ra-hero-ico" aria-hidden>
          <IconCloud />
        </div>
        <p className="ra-hero-line mb-0">
          <strong>Rutinas del profe</strong>
          <span className="ra-hero-sep">·</span>
          Copiá a <strong>Mis rutinas</strong> para entrenar y registrar pesos.
        </p>
        {syncRutinasNube ? (
          <button
            type="button"
            className="ra-btn ra-btn--outline ra-btn--sm ra-hero-sync"
            title="Busca en el servidor rutinas que tu entrenador te acaba de enviar"
            onClick={() => onRefreshAssignments?.()}
          >
            Sincronizar
          </button>
        ) : null}
      </div>

      {rutinasAsignadas.length === 0 ? (
        <div className="ra-empty">
          <p className="ra-empty-title mb-1">Todavía no hay rutinas acá</p>
          <p className="ra-empty-sub mb-0">
            {syncRutinasNube
              ? 'Tu entrenador tiene que tenerte vinculado por correo y enviarte una rutina desde su pestaña Profe.'
              : 'Iniciá sesión para sincronizar con la nube.'}
          </p>
          {syncRutinasNube ? (
            <button type="button" className="ra-btn ra-btn--outline ra-btn--sm ra-empty-btn" onClick={() => onRefreshAssignments?.()}>
              Sincronizar
            </button>
          ) : null}
        </div>
      ) : (
        <div className="ra-list">
          {rutinasAsignadas.map((r) => {
            const stableKey = rutinaStableKey(r)
            return (
            <RutinaAsignadaCard
              key={stableKey}
              rutina={r}
              diaIdx={diaPorRutina[stableKey] ?? 0}
              onSelectDia={(idx) => setDia(stableKey, idx)}
              onCopiar={onCopiar}
              onQuitar={onQuitar}
            />
            )
          })}
        </div>
      )}
    </div>
  )
}
