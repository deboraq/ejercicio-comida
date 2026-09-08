import { getCategoriaCatalogo } from '../../utils/profeCatalogo'
import { grupoMuscularTone } from './profeCatalogoUi'

/**
 * Dropdown de sugerencias del catálogo (variant ap = Armá tu plan, pf = workshop profe).
 */
export default function CatalogoEjercicioSuggest({
  open,
  query = '',
  items = [],
  highlightIdx = -1,
  onPick,
  onAddCustom,
  variant = 'ap',
}) {
  const q = String(query || '').trim()
  if (!open || !q) return null

  const listClass = variant === 'pf' ? 'pf-ws-suggestions' : 'ap-suggest'
  const customClass = variant === 'pf' ? 'pf-ws-suggest-custom' : 'ap-suggest-custom'
  const tagClass = variant === 'pf' ? 'pf-ws-suggest-tag' : 'ap-suggest-g'

  return (
    <ul className={listClass} role="listbox" aria-label="Sugerencias del catálogo">
      {items.map((item, i) => {
        const cat = getCategoriaCatalogo(item)
        return (
          <li key={item.id} role="option" aria-selected={highlightIdx === i}>
            <button
              type="button"
              className={highlightIdx === i ? 'is-highlight' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick?.(item)}
            >
              <span>{item.nombre}</span>
              <span className={`${tagClass} pf-ws-muscle--${grupoMuscularTone(cat)}`}>{cat}</span>
            </button>
          </li>
        )
      })}
      <li className={customClass} role="option">
        <button
          type="button"
          className={highlightIdx === items.length ? 'is-highlight' : undefined}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAddCustom?.(q)}
        >
          + Agregar «{q}» personalizado
        </button>
      </li>
    </ul>
  )
}
