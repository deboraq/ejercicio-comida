import { PLAN_MES1_SLOTS } from '../data/planMes1Semanas.js'
import { actualizarComidaPlanPropio } from '../utils/planPropio'
import PlanOpcionAlimentosEditor from './PlanOpcionAlimentosEditor'
import PlanPropioReplicar from './PlanPropioReplicar'

/**
 * Editor del menú propio para un día del plan (30 días).
 */
export default function PlanPropioEditor({
  diaPlan,
  planPropio,
  setPlanPropio,
  onCerrar,
  semanaActiva,
}) {
  if (!planPropio || !diaPlan) return null
  const raw = planPropio.dias?.[String(diaPlan)] || {}

  const patch = (slotId, opIdx, value) => {
    setPlanPropio((prev) => actualizarComidaPlanPropio(prev, diaPlan, slotId, opIdx, value))
  }

  return (
    <div className="plan-propio-editor">
      <div className="plan-propio-editor-head">
        <h3 className="plan-propio-editor-title mb-0">Editar menú · Día {diaPlan}</h3>
        {onCerrar ? (
          <button type="button" className="plan-propio-editor-close" onClick={onCerrar}>
            Cerrar editor
          </button>
        ) : null}
      </div>
      <p className="plan-propio-editor-hint mb-0">
        Buscá alimentos del catálogo (kcal y macros) o cargá uno manual. Dos opciones por comida.
      </p>
      <div className="plan-propio-editor-grid">
        {PLAN_MES1_SLOTS.map((slot) => {
          const textos = Array.isArray(raw[slot.id]) ? raw[slot.id] : ['', '']
          return (
            <fieldset key={slot.id} className="plan-propio-editor-slot">
              <legend>{slot.label}</legend>
              <PlanOpcionAlimentosEditor
                label="Opción 1"
                value={textos[0]}
                placeholder={`Ej. menú ${slot.label.toLowerCase()} — opción 1`}
                onChange={(v) => patch(slot.id, 0, v)}
              />
              <PlanOpcionAlimentosEditor
                label="Opción 2"
                value={textos[1]}
                placeholder={`Ej. menú ${slot.label.toLowerCase()} — opción 2`}
                onChange={(v) => patch(slot.id, 1, v)}
              />
            </fieldset>
          )
        })}
      </div>
      <PlanPropioReplicar
        diaPlan={diaPlan}
        planPropio={planPropio}
        setPlanPropio={setPlanPropio}
        semanaActiva={semanaActiva}
      />
    </div>
  )
}
