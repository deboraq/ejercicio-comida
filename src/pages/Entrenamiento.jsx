import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isNavModuleBlocked } from '../utils/navModules'
import { fechaSoloDia, fechaToISO } from '../utils/calorias'
import {
  escribirVistaEntren,
  leerVistaEntren,
  migrarParamsEntrenLegacy,
} from '../utils/entrenamientoNav'
import Rutina from './Rutina'
import ModalNuevoEjercicio from '../components/ModalNuevoEjercicio'
import EntrenamientoHub from '../components/EntrenamientoHub'
import HistorialActividades from '../components/HistorialActividades'
import RutinaMarcadoRapido from '../components/RutinaMarcadoRapido'
import { etiquetaFechaPlan } from '../utils/rutinaVistaRapida'

/**
 * Entrenamiento: hub + vistas hoy / gym / actividades.
 * @param {{ profile: object | null, profileLoading: boolean, roleNavMap: object }} props
 */
export default function Entrenamiento({ profile, profileLoading, roleNavMap }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, isConfigured } = useAuth()
  const [cardioModalAbierto, setCardioModalAbierto] = useState(false)
  const [fechaSesion, setFechaSesion] = useState(() => fechaToISO(new Date()))

  const ocultaRutina = useMemo(() => {
    if (!isConfigured || !user || profileLoading || !profile || profile.role === 'admin') return false
    return isNavModuleBlocked(profile, 'rutina', roleNavMap)
  }, [isConfigured, user, profileLoading, profile, roleNavMap])

  const ocultaActividad = useMemo(() => {
    if (!isConfigured || !user || profileLoading || !profile || profile.role === 'admin') return false
    return isNavModuleBlocked(profile, 'ejercicios', roleNavMap)
  }, [isConfigured, user, profileLoading, profile, roleNavMap])

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (!migrarParamsEntrenLegacy(next)) return prev
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const vista = leerVistaEntren(searchParams)
  const verHub = vista === 'hub' && !(ocultaRutina && ocultaActividad)
  const verHoy = vista === 'hoy' && !ocultaRutina
  const verGym = vista === 'gym' && !ocultaRutina
  const verHistorial = vista === 'actividades' && !ocultaActividad

  useEffect(() => {
    const f = searchParams.get('fecha')
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) setFechaSesion(f)
  }, [searchParams])

  useEffect(() => {
    if (vista === 'actividades' && ocultaActividad) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          escribirVistaEntren(next, 'hub', { fecha: prev.get('fecha') })
          return next
        },
        { replace: true },
      )
    } else if ((vista === 'hoy' || vista === 'gym') && ocultaRutina) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          escribirVistaEntren(next, ocultaActividad ? 'hub' : 'actividades', { fecha: prev.get('fecha') })
          return next
        },
        { replace: true },
      )
    }
  }, [vista, ocultaActividad, ocultaRutina, setSearchParams])

  const abrirCardioModal = useCallback(() => {
    setCardioModalAbierto(true)
  }, [])

  const cerrarCardioModal = useCallback(() => {
    setCardioModalAbierto(false)
  }, [])

  const volverAlHub = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        escribirVistaEntren(next, 'hub', { fecha: fechaSesion || prev.get('fecha') })
        return next
      },
      { replace: true },
    )
  }, [setSearchParams, fechaSesion])

  const abrirMusculacion = useCallback(
    (navState = {}) => {
      const gymVista = navState.rutinaVista || 'registrar'
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          escribirVistaEntren(next, 'gym', {
            gymVista,
            fecha: fechaSesion || prev.get('fecha'),
          })
          return next
        },
        { replace: false },
      )
    },
    [fechaSesion, setSearchParams],
  )

  const abrirHoyRapido = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        escribirVistaEntren(next, 'hoy', { fecha: fechaSesion || prev.get('fecha') })
        return next
      },
      { replace: true },
    )
  }, [fechaSesion, setSearchParams])

  const verHistorialFn = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        escribirVistaEntren(next, 'actividades', { fecha: fechaSesion || prev.get('fecha') })
        return next
      },
      { replace: true },
    )
  }, [fechaSesion, setSearchParams])

  const moverFechaHoy = useCallback(
    (delta) => {
      const base = fechaSoloDia(fechaSesion) || fechaToISO(new Date())
      const d = new Date(`${base}T12:00:00`)
      d.setDate(d.getDate() + delta)
      const iso = fechaToISO(d)
      setFechaSesion(iso)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('fecha', iso)
          return next
        },
        { replace: true },
      )
    },
    [fechaSesion, setSearchParams],
  )

  const actualizarFechaHub = useCallback(
    (iso) => {
      setFechaSesion(iso)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('fecha', iso)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  if (isConfigured && user && !profileLoading && profile && profile.role !== 'admin') {
    if (ocultaRutina && ocultaActividad) {
      return <Navigate to="/config" replace />
    }
  }

  const mostrarCardioModal = cardioModalAbierto && !ocultaActividad

  return (
    <div className="entrenamiento-unificado">
      {verHub ? (
        <header className="entrenamiento-hero entrenamiento-hero--hub-only">
          <div className="entrenamiento-hero-text">
            <h1 className="entrenamiento-hero-title mb-0">Entrenamiento</h1>
            <p className="entrenamiento-hero-sub mb-0">Calendario, resumen del día y accesos rápidos.</p>
          </div>
        </header>
      ) : null}

      {verHub ? (
        <EntrenamientoHub
          fechaSeleccionada={fechaSesion}
          onFechaSeleccionada={actualizarFechaHub}
          onAbrirHoy={abrirHoyRapido}
          onAbrirMusculacion={abrirMusculacion}
          onAbrirCardio={abrirCardioModal}
          onVerDeportesHistorial={!ocultaActividad ? verHistorialFn : undefined}
          mostrarMusculacion={!ocultaRutina}
          mostrarCardio={!ocultaActividad}
        />
      ) : null}

      {mostrarCardioModal ? (
        <ModalNuevoEjercicio
          open
          contexto="deportes"
          fechaInicial={fechaSesion}
          onClose={cerrarCardioModal}
        />
      ) : null}

      {verHistorial ? (
        <div className="entrenamiento-vista-cardio">
          <header className="entren-cardio-historial-head">
            <button type="button" className="entren-back-link" onClick={volverAlHub} aria-label="Volver al resumen de entrenamiento">
              <span className="entren-back-link-ico" aria-hidden>
                ‹
              </span>
              Resumen
            </button>
          </header>
          <HistorialActividades onRegistrarActividad={abrirCardioModal} />
        </div>
      ) : null}

      {verHoy ? (
        <div className="entrenamiento-vista-hoy">
          <header className="entren-hoy-head">
            <button type="button" className="entren-back-link" onClick={volverAlHub} aria-label="Volver al resumen de entrenamiento">
              <span className="entren-back-link-ico" aria-hidden>
                ‹
              </span>
              Resumen
            </button>
            <div className="inicio-plan-hoy-head-fecha-nav entren-hoy-fecha-nav">
              <button type="button" className="inicio-plan-hoy-head-fecha-flecha" aria-label="Día anterior" onClick={() => moverFechaHoy(-1)}>
                ‹
              </button>
              <h2 className="inicio-plan-hoy-head-fecha mb-0">{etiquetaFechaPlan(fechaSesion)}</h2>
              <button type="button" className="inicio-plan-hoy-head-fecha-flecha" aria-label="Día siguiente" onClick={() => moverFechaHoy(1)}>
                ›
              </button>
            </div>
          </header>
          <section className="box entren-hoy-panel" aria-labelledby="entren-hoy-rapida-title">
            <h2 id="entren-hoy-rapida-title" className="inicio-plan-hoy-title mb-0">
              Marcado rápido
            </h2>
            <RutinaMarcadoRapido fechaISO={fechaSesion} />
          </section>
        </div>
      ) : null}

      {verGym ? (
        <div className="entrenamiento-vista-gym">
          <header className="entren-gym-volver-head">
            <button type="button" className="entren-back-link" onClick={volverAlHub} aria-label="Volver al resumen de entrenamiento">
              <span className="entren-back-link-ico" aria-hidden>
                ‹
              </span>
              Resumen
            </button>
          </header>
          <Rutina embeddedInEntrenamiento onFechaSesionChange={setFechaSesion} />
        </div>
      ) : null}
    </div>
  )
}
