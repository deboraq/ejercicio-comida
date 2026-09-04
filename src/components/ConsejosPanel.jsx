export default function ConsejosPanel({ diarios = [], semanales = [], className = '' }) {
  const items = [
    ...diarios.slice(0, 1).map((c) => ({ ...c, etiqueta: 'Hoy', icono: '💡', tono: 'dia' })),
    ...semanales.slice(0, 1).map((c) => ({ ...c, etiqueta: 'Semana', icono: '📅', tono: 'semana' })),
  ]
  if (items.length === 0) return null

  return (
    <section className={`consejos-panel mb-4${className ? ` ${className}` : ''}`} aria-label="Consejos">
      <div className="consejos-panel-compacto">
        {items.map((c, i) => (
          <article
            key={`${c.tono}-${i}`}
            className={`ti-tip-bar consejos-panel-tip consejos-panel-tip--${c.tono}`}
          >
            <span className="ti-tip-icon" aria-hidden="true">{c.icono}</span>
            <div>
              <p className="consejos-panel-etiqueta mb-1">{c.etiqueta}</p>
              <p className="mb-0">{c.texto}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
