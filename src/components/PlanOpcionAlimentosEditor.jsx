import { useEffect, useMemo, useState } from 'react'
import { buscarAlimentos } from '../utils/referenciaComidas'
import {
  buildItemDesdeManual,
  buildItemDesdeReferencia,
  manualFormValido,
  normalizarCantidad,
  numeroFlexibleO,
} from '../utils/comidaLineItems'
import {
  opcionPlanParaGuardar,
  parseOpcionPlan,
  textoDesdeItems,
  totalesMacrosItems,
} from '../utils/planOpcionComida'

const MANUAL_VACIO = {
  descripcion: '',
  calorias: '',
  proteinas: '',
  carbohidratos: '',
  grasas: '',
  porciones: '',
}

/**
 * Armar una opción del plan con catálogo + carga manual (como Registro de hoy).
 */
export default function PlanOpcionAlimentosEditor({ label, value, onChange, placeholder }) {
  const parsed = useMemo(() => parseOpcionPlan(value), [value])
  const [items, setItems] = useState(parsed.items)
  const [legacyTexto, setLegacyTexto] = useState(parsed.items.length ? '' : parsed.texto)
  const [busqueda, setBusqueda] = useState('')
  const [referencia, setReferencia] = useState(null)
  const [cantidad, setCantidad] = useState('1')
  const [entradaManual, setEntradaManual] = useState(false)
  const [manual, setManual] = useState(MANUAL_VACIO)

  useEffect(() => {
    setItems(parsed.items)
    setLegacyTexto(parsed.items.length ? '' : parsed.texto)
    setBusqueda('')
    setReferencia(null)
    setEntradaManual(false)
    setManual(MANUAL_VACIO)
  }, [value, label])

  const resultados = useMemo(() => buscarAlimentos(busqueda), [busqueda])

  const emitChange = (nextItems, legacy = '') => {
    if (nextItems.length) {
      onChange(opcionPlanParaGuardar(nextItems))
    } else {
      onChange(String(legacy || '').trim())
    }
  }

  const agregarReferencia = () => {
    if (!referencia) return
    const line = buildItemDesdeReferencia(referencia, cantidad)
    const next = [...items, line]
    setItems(next)
    emitChange(next)
    setReferencia(null)
    setBusqueda('')
    setCantidad('1')
  }

  const agregarManual = () => {
    if (!manualFormValido(manual)) return
    const line = buildItemDesdeManual(manual, cantidad)
    const next = [...items, line]
    setItems(next)
    emitChange(next)
    setEntradaManual(false)
    setManual(MANUAL_VACIO)
    setBusqueda('')
    setCantidad('1')
  }

  const quitarItem = (id) => {
    const next = items.filter((it) => it.id !== id)
    setItems(next)
    emitChange(next, legacyTexto)
  }

  const onLegacyBlur = () => {
    if (items.length) return
    emitChange([], legacyTexto)
  }

  const totales = items.length ? totalesMacrosItems(items) : null
  const previewRef = referencia
    ? buildItemDesdeReferencia(referencia, cantidad)
    : null

  return (
    <div className="plan-opcion-alim">
      <span className="plan-opcion-alim-label">{label}</span>

      {items.length > 0 ? (
        <ul className="plan-opcion-alim-list mb-0">
          {items.map((it) => (
            <li key={it.id} className="plan-opcion-alim-row">
              <div className="plan-opcion-alim-row-main">
                <span className="plan-opcion-alim-nombre">{it.descripcion}</span>
                {it.porciones ? <span className="plan-opcion-alim-porc">{it.porciones}</span> : null}
              </div>
              <div className="plan-opcion-alim-macros">
                <span>{numeroFlexibleO(it.calorias)} kcal</span>
                <span>P {numeroFlexibleO(it.proteinas)}g</span>
                <span>C {numeroFlexibleO(it.carbohidratos)}g</span>
                <span>G {numeroFlexibleO(it.grasas)}g</span>
              </div>
              <button
                type="button"
                className="plan-opcion-alim-quitar"
                aria-label="Quitar alimento"
                onClick={() => quitarItem(it.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <textarea
          className="plan-opcion-alim-legacy"
          rows={2}
          value={legacyTexto}
          placeholder={placeholder || 'Texto libre o buscá alimentos abajo'}
          onChange={(e) => setLegacyTexto(e.target.value)}
          onBlur={onLegacyBlur}
        />
      )}

      {totales ? (
        <p className="plan-opcion-alim-total mb-0">
          Total: <strong>{Math.round(totales.kcal)} kcal</strong>
          {' · '}
          P {totales.p}g · C {totales.h}g · G {totales.g}g
        </p>
      ) : null}

      {items.length > 0 ? (
        <p className="plan-opcion-alim-resumen mb-0">{textoDesdeItems(items)}</p>
      ) : null}

      <div className="plan-opcion-alim-add">
        <div className="plan-opcion-alim-search">
          <input
            type="search"
            value={busqueda}
            placeholder="Buscar alimento (pollo, yogur, arroz…)"
            onChange={(e) => {
              setBusqueda(e.target.value)
              setReferencia(null)
            }}
            autoComplete="off"
          />
        </div>

        {!entradaManual ? (
          <button
            type="button"
            className="plan-opcion-alim-manual-btn"
            onClick={() => {
              setEntradaManual(true)
              setManual((m) => ({ ...m, descripcion: busqueda.trim() }))
            }}
          >
            + No está en la lista — cargar manual
          </button>
        ) : (
          <button
            type="button"
            className="plan-opcion-alim-manual-btn plan-opcion-alim-manual-btn--back"
            onClick={() => setEntradaManual(false)}
          >
            ← Volver al buscador
          </button>
        )}

        {referencia && !entradaManual ? (
          <div className="plan-opcion-alim-pick">
            <strong>{referencia.nombre}</strong>
            <span className="plan-opcion-alim-pick-meta">
              {previewRef
                ? `${numeroFlexibleO(previewRef.calorias)} kcal · P ${numeroFlexibleO(previewRef.proteinas)}g`
                : `${referencia.calorias} kcal`}
            </span>
            <label className="plan-opcion-alim-cant">
              <span>Cant.</span>
              <input
                type="number"
                min="0.25"
                max="99"
                step="0.25"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                onBlur={() => setCantidad(String(normalizarCantidad(cantidad, 1)))}
              />
            </label>
            <button type="button" className="plan-opcion-alim-add-btn" onClick={agregarReferencia}>
              Agregar al plan
            </button>
            <button type="button" className="plan-opcion-alim-link" onClick={() => setReferencia(null)}>
              Cancelar
            </button>
          </div>
        ) : null}

        {!entradaManual && busqueda.trim().length >= 1 && !referencia ? (
          <ul className="plan-opcion-alim-hits mb-0">
            {resultados.length === 0 ? (
              <li className="plan-opcion-alim-hit plan-opcion-alim-hit--empty">
                Sin resultados.{' '}
                <button
                  type="button"
                  className="plan-opcion-alim-link"
                  onClick={() => {
                    setEntradaManual(true)
                    setManual((m) => ({ ...m, descripcion: busqueda.trim() }))
                  }}
                >
                  Cargar «{busqueda.trim()}» manual
                </button>
              </li>
            ) : (
              resultados.slice(0, 8).map((a) => (
                <li key={a.nombre}>
                  <button
                    type="button"
                    className="plan-opcion-alim-hit"
                    onClick={() => {
                      setReferencia(a)
                      setCantidad('1')
                    }}
                  >
                    <span>{a.nombre}</span>
                    <span className="plan-opcion-alim-hit-meta">
                      {a.calorias} kcal · P {a.proteinas}g · C {a.carbohidratos}g
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}

        {entradaManual ? (
          <div className="plan-opcion-alim-manual-form">
            <label>
              <span>Nombre</span>
              <input
                value={manual.descripcion}
                onChange={(e) => setManual((m) => ({ ...m, descripcion: e.target.value }))}
              />
            </label>
            <div className="plan-opcion-alim-manual-grid">
              <label>
                <span>kcal</span>
                <input
                  inputMode="decimal"
                  value={manual.calorias}
                  onChange={(e) => setManual((m) => ({ ...m, calorias: e.target.value }))}
                />
              </label>
              <label>
                <span>P (g)</span>
                <input
                  inputMode="decimal"
                  value={manual.proteinas}
                  onChange={(e) => setManual((m) => ({ ...m, proteinas: e.target.value }))}
                />
              </label>
              <label>
                <span>C (g)</span>
                <input
                  inputMode="decimal"
                  value={manual.carbohidratos}
                  onChange={(e) => setManual((m) => ({ ...m, carbohidratos: e.target.value }))}
                />
              </label>
              <label>
                <span>G (g)</span>
                <input
                  inputMode="decimal"
                  value={manual.grasas}
                  onChange={(e) => setManual((m) => ({ ...m, grasas: e.target.value }))}
                />
              </label>
            </div>
            <label>
              <span>Porción (opcional)</span>
              <input
                value={manual.porciones}
                onChange={(e) => setManual((m) => ({ ...m, porciones: e.target.value }))}
                placeholder="Ej. 1 taza, 150 g"
              />
            </label>
            <label className="plan-opcion-alim-cant">
              <span>Cant.</span>
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="plan-opcion-alim-add-btn"
              disabled={!manualFormValido(manual)}
              onClick={agregarManual}
            >
              Agregar al plan
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
