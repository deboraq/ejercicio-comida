import { useEffect, useState } from 'react'

/**
 * Caja plegable para secciones de seguimiento / registro.
 * Cerrada por defecto; se abre con el CTA (ej. "Registrar").
 */
export default function SeguimientoCaja({
  id,
  titulo,
  resumen,
  ctaCerrado = 'Registrar',
  ctaAbierto = 'Cerrar',
  defaultOpen = false,
  className = '',
  children,
}) {
  const [abierto, setAbierto] = useState(defaultOpen)

  useEffect(() => {
    if (!id) return
    const syncHash = () => {
      if (window.location.hash === `#${id}`) {
        setAbierto(true)
        requestAnimationFrame(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [id])

  return (
    <div
      id={id}
      className={`box mb-4 py-0 seguimiento-caja${abierto ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
    >
      <button
        type="button"
        className="seguimiento-caja-head"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span className="seguimiento-caja-chevron" aria-hidden="true">
          {abierto ? '▼' : '▶'}
        </span>
        <span className="seguimiento-caja-texto">
          <span className="seguimiento-caja-titulo">{titulo}</span>
          {!abierto && resumen ? (
            <span className="seguimiento-caja-resumen">{resumen}</span>
          ) : null}
        </span>
        <span className={`seguimiento-caja-cta${abierto ? ' is-open' : ''}`}>
          {abierto ? ctaAbierto : ctaCerrado}
        </span>
      </button>
      {abierto && <div className="seguimiento-caja-body">{children}</div>}
    </div>
  )
}
