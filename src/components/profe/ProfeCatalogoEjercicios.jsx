import { useMemo } from 'react'
import { useStorage } from '../../hooks/useStorage'

function nuevoEj() {
  return {
    id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    nombre: '',
    series: '',
    repeticiones: '',
    notas: '',
  }
}

function catalogoItemNormalizado(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    ...raw,
    nombre: raw.nombre != null ? String(raw.nombre) : '',
    series: raw.series != null ? String(raw.series) : '',
    repeticiones: raw.repeticiones != null ? String(raw.repeticiones) : '',
    notas: raw.notas != null ? String(raw.notas) : '',
  }
}

export default function ProfeCatalogoEjercicios({ busqueda = '' }) {
  const [items, setItems] = useStorage('profeCatalogoEjercicios', [])
  const lista = useMemo(
    () => (Array.isArray(items) ? items : []).map((x) => catalogoItemNormalizado(x)).filter(Boolean),
    [items]
  )
  const q = (busqueda || '').trim().toLowerCase()
  const listaFiltrada = useMemo(() => {
    if (!q) return lista
    return lista.filter((ex) => {
      const nom = String(ex.nombre || '').toLowerCase()
      const notas = String(ex.notas || '').toLowerCase()
      const ser = String(ex.series || '').toLowerCase()
      const rep = String(ex.repeticiones || '').toLowerCase()
      return nom.includes(q) || notas.includes(q) || ser.includes(q) || rep.includes(q)
    })
  }, [lista, q])

  const agregar = () => setItems((prev) => [...(Array.isArray(prev) ? prev : []), nuevoEj()])

  const eliminar = (id) => {
    if (!window.confirm('¿Eliminar este ejercicio del catálogo?')) return
    setItems((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== id) : []))
  }

  const patch = (id, field, value) => {
    setItems((prev) =>
      (Array.isArray(prev) ? prev : []).map((x) => (x.id === id ? { ...x, [field]: value } : x))
    )
  }

  return (
    <div className="box py-3">
      <h2 className="title is-6 mb-2">Catálogo de ejercicios</h2>
      <p className="is-size-7 has-text-grey mb-3">
        Armá cada ítem con nombre y, si querés, <strong>series</strong> y <strong>repeticiones</strong> sugeridas (el
        alumno las verá al registrar; podés cambiarlas en la plantilla). Las notas son solo para vos.
      </p>
      <button type="button" className="button is-link is-small mb-3" onClick={agregar}>
        Agregar ejercicio
      </button>
      {lista.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0">Todavía no hay ejercicios. Agregá al menos uno para armar rutinas.</p>
      ) : listaFiltrada.length === 0 ? (
        <p className="is-size-7 has-text-grey mb-0">No hay coincidencias con la búsqueda.</p>
      ) : (
        <ul className="mb-0" style={{ listStyle: 'none', padding: 0 }}>
          {listaFiltrada.map((ex) => (
            <li
              key={ex.id}
              className="py-2 subtle-divider-b"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="is-flex is-align-items-stretch" style={{ gap: '0.5rem' }}>
                <div className="is-flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="field mb-2">
                    <label className="label is-size-7 mb-1">Nombre</label>
                    <input
                      className="input is-small"
                      value={ex.nombre}
                      onChange={(e) => patch(ex.id, 'nombre', e.target.value)}
                      placeholder="Ej: Press banca"
                    />
                  </div>
                  <div className="columns is-mobile is-multiline mb-2">
                    <div className="column is-narrow pb-0">
                      <div className="field mb-0">
                        <label className="label is-size-7 mb-1">Series (opc.)</label>
                        <input
                          className="input is-small"
                          type="text"
                          inputMode="numeric"
                          value={ex.series || ''}
                          onChange={(e) => patch(ex.id, 'series', e.target.value)}
                          placeholder="ej. 4"
                          style={{ width: '5rem' }}
                        />
                      </div>
                    </div>
                    <div className="column pb-0">
                      <div className="field mb-0">
                        <label className="label is-size-7 mb-1">Repeticiones (opc.)</label>
                        <input
                          className="input is-small"
                          value={ex.repeticiones || ''}
                          onChange={(e) => patch(ex.id, 'repeticiones', e.target.value)}
                          placeholder='ej. 10, 8+8, 30"'
                        />
                      </div>
                    </div>
                  </div>
                  <div className="field mb-0">
                    <label className="label is-size-7 mb-1">Notas (solo vos; opcional)</label>
                    <input
                      className="input is-small"
                      value={ex.notas || ''}
                      onChange={(e) => patch(ex.id, 'notas', e.target.value)}
                      placeholder="Técnica, link, recordatorios…"
                    />
                  </div>
                </div>
                <div className="is-flex is-align-items-center" style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    className="button is-small is-danger is-light"
                    title="Eliminar del catálogo"
                    aria-label="Eliminar ejercicio"
                    onClick={() => eliminar(ex.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
