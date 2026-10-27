import { useAuth } from '../context/AuthContext'
import { useConsultasIa } from '../context/ConsultasIaContext'
import { useMyProfile } from '../hooks/useMyProfile'
import { useStorage } from '../hooks/useStorage'
import { puedeUsarConsultasGemini, puedeConfigurarAsistenteGemini } from '../utils/asistenteGeminiAccess'
import { PLAN_ESTADO_MULTIPLAN_VACIO } from '../utils/planEstadoStorage'
import { mergeRutinasUsuario } from '../utils/asistenteRutinas'
import AsistenteGemini from './AsistenteGemini'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

function IconoRobot() {
  return (
    <svg className="app-ia-fab-icon" viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="12" cy="2.6" r="1.45" fill="currentColor" />
      <rect x="11.1" y="3.85" width="1.8" height="2.35" rx="0.55" fill="currentColor" />
      <circle cx="4.1" cy="11.4" r="2.15" fill="currentColor" />
      <circle cx="19.9" cy="11.4" r="2.15" fill="currentColor" />
      <rect x="5.25" y="6" width="13.5" height="11.5" rx="2.6" fill="currentColor" />
      <rect x="7.1" y="8.1" width="9.8" height="7.4" rx="1.4" className="app-ia-fab-icon-face" />
      <circle cx="9.35" cy="10.85" r="1.55" fill="#fff" />
      <circle cx="14.65" cy="10.85" r="1.55" fill="#fff" />
      <circle cx="9.55" cy="10.65" r="0.62" className="app-ia-fab-icon-pupil" />
      <circle cx="14.85" cy="10.65" r="0.62" className="app-ia-fab-icon-pupil" />
      <rect x="8.35" y="13.15" width="7.3" height="0.85" rx="0.3" fill="#fff" opacity="0.92" />
      <rect x="8.35" y="14.35" width="7.3" height="0.85" rx="0.3" fill="#fff" opacity="0.92" />
      <rect x="8.35" y="15.55" width="7.3" height="0.85" rx="0.3" fill="#fff" opacity="0.92" />
      <rect x="8.6" y="18.15" width="2.55" height="2.35" rx="0.55" fill="currentColor" />
      <rect x="12.85" y="18.15" width="2.55" height="2.35" rx="0.55" fill="currentColor" />
      <rect x="7.4" y="17.45" width="9.2" height="1.35" rx="0.45" fill="currentColor" />
    </svg>
  )
}

export default function AsistenteIaFlotante() {
  const { user, isConfigured } = useAuth()
  const { enabled: consultasGlobal, loading: consultasLoading } = useConsultasIa()
  const { profile } = useMyProfile()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)

  const [config, , configReady] = useStorage('config', { objetivo: 'mantener_peso', pesoKg: 70 })
  const [comida] = useStorage('comida', [])
  const [, , comidaReady] = useStorage('comida', [])
  const [ejercicios] = useStorage('ejercicios', [])
  const [, , ejerciciosReady] = useStorage('ejercicios', [])
  const [planMes1Estado] = useStorage('planMes1Estado', PLAN_ESTADO_MULTIPLAN_VACIO)
  const [planPropio] = useStorage('planPropio', { inactivo: true, dias: {} })
  const [planNutricionActivoId] = useStorage('planNutricionActivoId', '')
  const [planesNutricion] = useStorage('planesNutricion', [])
  const [rutinasPropias] = useStorage('rutinas', [])
  const [rutinasAsignadas] = useStorage('rutinasAsignadas', [])
  const rutinas = mergeRutinasUsuario(rutinasPropias, rutinasAsignadas)
  const [rutinaActivaId] = useStorage('rutinaActivaId', '')
  const [rutinaPesos] = useStorage('rutinaPesos', [])

  const visible =
    !consultasLoading && puedeUsarConsultasGemini(user) && consultasGlobal

  const datosListos =
    !user || !isConfigured || (configReady && comidaReady && ejerciciosReady)

  if (!visible || !user?.id) return null

  const ajustesAdmin = puedeConfigurarAsistenteGemini(profile)

  const onIrRegistroComida = (payload) => {
    if (!payload) return
    setAbierto(false)
    if (payload.tipo === 'plan' || payload.accion === 'marcar' || (payload.momento && payload.opcion != null)) {
      navigate('/comida', {
        state: {
          vistaComida: 'plan',
          asistentePlanMarcar: {
            diaPlan: payload.dia_plan,
            momento: payload.momento,
            opcion: payload.opcion ?? 1,
            slotId: payload.slot_id,
            textoPlan: payload.textoPlan,
          },
        },
      })
      return
    }
    if (payload.textoPlan && payload.momento) {
      navigate('/comida', {
        state: {
          vistaComida: 'plan',
          asistentePlanMarcar: {
            momento: payload.momento,
            opcion: payload.opcion ?? 1,
            textoPlan: payload.textoPlan,
          },
        },
      })
      return
    }
    if (!payload.descripcion) return
    navigate('/comida', {
      state: {
        asistentePrefill: {
          descripcion: payload.descripcion,
          calorias: payload.calorias,
          proteinas: payload.proteinas,
          carbohidratos: payload.carbohidratos,
          grasas: payload.grasas,
          porcion: payload.porcion,
          momento: payload.momento,
          preguntaUsuario: payload.preguntaUsuario || '',
        },
      },
    })
  }

  return (
    <div className="app-ia-float-root" key={user.id}>
      {abierto && (
        <>
          <button
            type="button"
            className="app-ia-float-backdrop"
            aria-label="Cerrar asistente"
            onClick={() => setAbierto(false)}
          />
          <div className="app-ia-float-panel is-centered-mobile" role="dialog" aria-label="Asistente IA">
            <AsistenteGemini
              key={user.id}
              modoFlotante
              flotanteAbierto={abierto}
              onCerrar={() => setAbierto(false)}
              config={config}
              comida={comida}
              ejercicios={ejercicios}
              planMes1Estado={planMes1Estado}
              planPropio={planPropio}
              planNutricionActivoId={planNutricionActivoId}
              planesNutricion={planesNutricion}
              rutinas={rutinas}
              rutinaActivaId={rutinaActivaId}
              rutinaPesos={rutinaPesos}
              onIrRegistroComida={onIrRegistroComida}
              ajustesAsistenteAdmin={ajustesAdmin}
              datosListos={datosListos}
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
