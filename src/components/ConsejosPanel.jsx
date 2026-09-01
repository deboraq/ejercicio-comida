export default function ConsejosPanel({ diarios = [], semanales = [], className = '' }) {
  if (diarios.length === 0 && semanales.length === 0) return null

  return (
    <section className={`consejos-panel mb-4${className ? ` ${className}` : ''}`} aria-label="Consejos">
      {diarios.length > 0 && (
        <div className="consejos-panel-grupo">
          {diarios.map((c, i) => (
            <article key={`d-${i}`} className="ti-tip-bar consejos-panel-tip consejos-panel-tip--dia">
              <span className="ti-tip-icon" aria-hidden="true">💡</span>
              <div>
                <p className="consejos-panel-etiqueta mb-1">Hoy</p>
                <p className="mb-0">{c.texto}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {semanales.length > 0 && (
        <div className="consejos-panel-grupo">
          {semanales.map((c, i) => (
            <article key={`s-${i}`} className="ti-tip-bar consejos-panel-tip consejos-panel-tip--semana">
              <span className="ti-tip-icon" aria-hidden="true">📅</span>
              <div>
                <p className="consejos-panel-etiqueta mb-1">Esta semana</p>
                <p className="mb-0">{c.texto}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
