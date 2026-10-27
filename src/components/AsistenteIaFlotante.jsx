import { useAuth } from '../context/AuthContext'
import { useConsultasIa } from '../context/ConsultasIaContext'
import { useMyProfile } from '../hooks/useMyProfile'
import { useStorage } from '../hooks/useStorage'
import { puedeUsarConsultasGemini, puedeConfigurarAsistenteGemini } from '../utils/asistenteGeminiAccess'
import { PLAN_ESTADO_MULTIPLAN_VACIO } from '../utils/planEstadoStorage'
import AsistenteGemini from './AsistenteGemini'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

function IconoRobot() {
  return (
    <svg className="app-ia-fab-icon" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M12 2a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v3.5a1.5 1.5 0 0 1-1.5 1.5H17v7.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5V12H5.5A1.5 1.5 0 0 1 4 10.5V7a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2Zm-4 7v7.5h8V9H8Zm1.5 2.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM8 4.5V6h8V4.5a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 0-.5.5Z"
      />
    </svg>
  )
}

export default function AsistenteIaFlotante() {
  const { user } = useAuth()
  const { enabled: consultasGlobal, loading: consultasLoading } = useConsultasIa()
  const { profile } = useMyProfile()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)

  const [config] = useStorage('config', { objetivo: 'mantener_peso', pesoKg: 70 })
  const [comida] = useStorage('comida', [])
  const [ejercicios] = useStorage('ejercicios', [])
  const [planMes1Estado] = useStorage('planMes1Estado', PLAN_ESTADO_MULTIPLAN_VACIO)
  const [planPropio] = useStorage('planPropio', { inactivo: true, dias: {} })
  const [planNutricionActivoId] = useStorage('planNutricionActivoId', '')
  const [rutinaPesos] = useStorage('rutinaPesos', [])

  const visible =
    !consultasLoading && puedeUsarConsultasGemini(user) && consultasGlobal

  if (!visible) return null

  const ajustesAdmin = puedeConfigurarAsistenteGemini(profile)

  const onAgregarEstimacion = (est) => {
    if (!est?.descripcion) return
    setAbierto(false)
    navigate('/comida', {
      state: {
        asistentePrefill: {
          descripcion: est.descripcion,
          calorias: est.calorias,
          proteinas: est.proteinas,
          carbohidratos: est.carbohidratos,
          grasas: est.grasas,
          porcion: est.porcion,
        },
      },
    })
  }

  return (
    <div className="app-ia-float-root">
      {abierto && (
        <>
          <button
            type="button"
            className="app-ia-float-backdrop"
            aria-label="Cerrar asistente"
            onClick={() => setAbierto(false)}
          />
          <div className="app-ia-float-panel" role="dialog" aria-label="Asistente IA">
            <AsistenteGemini
              modoFlotante
              onCerrar={() => setAbierto(false)}
              config={config}
              comida={comida}
              ejercicios={ejercicios}
              planMes1Estado={planMes1Estado}
              planPropio={planPropio}
              planNutricionActivoId={planNutricionActivoId}
              rutinaPesos={rutinaPesos}
              onAgregarEstimacion={onAgregarEstimacion}
              ajustesAsistenteAdmin={ajustesAdmin}
            />
          </div>
        </>
      )}
      <button
        type="button"
        className={`app-ia-fab${abierto ? ' is-open' : ''}`}
        aria-label={abierto ? 'Cerrar asistente IA' : 'Abrir asistente IA'}
        aria-expanded={abierto}
        onClick={() => setAbierto((o) => !o)}
      >
        <IconoRobot />
      </button>
    </div>
  )
}
