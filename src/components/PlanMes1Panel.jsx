import { useStorage } from '../hooks/useStorage'
import { planMes1TieneInicio } from '../utils/planMes1'
import MiPlanKanban from './MiPlanKanban'
import '../pages/PlanMes1.css'

/**
 * @param {{ embedded?: boolean, onRegistrarComida?: (payload: object) => void, onSyncPlanRegistro?: (payload: object) => void, abrirEditorInicial?: boolean }} props
 */
export default function PlanMes1Panel({
  embedded = false,
  onRegistrarComida,
  onSyncPlanRegistro,
  abrirEditorInicial = false,
}) {
  const [config] = useStorage('config', {})
  const tienePlan = planMes1TieneInicio(config)

  if (embedded) {
    return (
      <MiPlanKanban
        embedded
        onRegistrarComida={onRegistrarComida}
        onSyncPlanRegistro={onSyncPlanRegistro}
        abrirEditorInicial={abrirEditorInicial}
      />
    )
  }

  return (
    <div className="plan-m1-panel">
      <header className="plan-m1-hero">
        <div>
          <p className="plan-m1-kicker mb-1">Mi plan</p>
          <h1 className="plan-m1-title mb-2">Plan semanal de comidas</h1>
          <p className="plan-m1-sub mb-0">
            Sincronizado con tu perfil en Config. Marcá comidas, editá en Registro de hoy o ajustá el esquema abajo.
          </p>
        </div>
        {tienePlan ? (
          <a href="#plan-crear-nuevo" className="button is-link is-small">
            Nuevo plan
          </a>
        ) : (
          <a href="#plan-crear-nuevo" className="button is-link is-small">
            Crear plan
          </a>
        )}
      </header>
      <MiPlanKanban
        embedded={false}
        onRegistrarComida={onRegistrarComida}
        onSyncPlanRegistro={onSyncPlanRegistro}
      />
    </div>
  )
}
