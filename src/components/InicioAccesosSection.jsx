import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import {
  INICIO_ACCESOS_CATALOGO,
  accesoInicioTone,
  accesosInicioVisibles,
  buildAccesoInicioLink,
  esAccesoInicioFavorito,
  filtrarCatalogoAccesosInicio,
  toggleAccesoInicioFavorito,
} from '../utils/inicioAccesosFavoritos'

function chipClass(id, extra = '') {
  const tone = accesoInicioTone(id)
  return `inicio-acceso-chip inicio-acceso-chip--tone-${tone}${extra ? ` ${extra}` : ''}`
}

export default function InicioAccesosSection({
  hoyISO,
  ocultarNav,
  mostrarProfe,
  mostrarAdmin,
}) {
  const [favoritos, setFavoritos] = useStorage('inicioAccesosFavoritos', [])
  const [editando, setEditando] = useState(false)

  const filtroCtx = useMemo(
    () => ({ ocultarNav, mostrarProfe, mostrarAdmin }),
    [ocultarNav, mostrarProfe, mostrarAdmin],
  )

  const accesos = useMemo(
    () => accesosInicioVisibles(favoritos, filtroCtx),
    [favoritos, filtroCtx],
  )

  const catalogo = useMemo(
    () => filtrarCatalogoAccesosInicio(INICIO_ACCESOS_CATALOGO, filtroCtx),
    [filtroCtx],
  )

  const personalizado = Array.isArray(favoritos) && favoritos.length > 0

  return (
    <div className="box inicio-accesos-card">
      <div className="inicio-accesos-head">
        <div>
          <h2 className="inicio-card-title mb-0">Accesos rápidos</h2>
          <p className="inicio-card-sub mb-0">
            {personalizado
              ? 'Tus atajos favoritos al plan, rutina y más.'
              : 'Sugeridos — personalizalos cuando quieras.'}
          </p>
        </div>
        <button
          type="button"
          className={`button is-small inicio-accesos-edit${editando ? ' is-active' : ''}`}
          onClick={() => setEditando((v) => !v)}
          aria-expanded={editando}
        >
          {editando ? 'Listo' : 'Personalizar'}
        </button>
      </div>

      {accesos.length > 0 ? (
        <div className="inicio-accesos-chips inicio-accesos-chips--favoritos" role="list">
          {accesos.map((item) => {
            const { to, state } = buildAccesoInicioLink(item, { hoyISO })
            return (
              <Link
                key={item.id}
                to={to}
                state={state}
                className={chipClass(item.id)}
                role="listitem"
              >
                <span className="inicio-acceso-chip-ico" aria-hidden>
                  {item.icon}
                </span>
                <span className="inicio-acceso-chip-label">{item.label}</span>
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="inicio-accesos-empty mb-0">
          Elegí al menos un acceso en Personalizar.
        </p>
      )}

      {editando && (
        <div className="inicio-accesos-picker">
          <p className="inicio-accesos-picker-hint mb-2">
            Tocá ★ para sumar o quitar. El orden es el de la lista.
          </p>
          <ul className="inicio-accesos-chips inicio-accesos-picker-list">
            {catalogo.map((item) => {
              const on = esAccesoInicioFavorito(favoritos, item.id)
              return (
                <li key={item.id} className="inicio-acceso-chip-wrap">
                  <button
                    type="button"
                    className={chipClass(item.id, on ? 'is-active' : '')}
                    aria-label={on ? `Quitar ${item.label}` : `Agregar ${item.label}`}
                    aria-pressed={on}
                    onClick={() => toggleAccesoInicioFavorito(setFavoritos, item.id)}
                  >
                    <span className="inicio-acceso-picker-star" aria-hidden>
                      {on ? '★' : '☆'}
                    </span>
                    <span className="inicio-acceso-chip-ico" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="inicio-acceso-chip-label">{item.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
