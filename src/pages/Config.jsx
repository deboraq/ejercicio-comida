import { Link } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { useAuth } from '../context/AuthContext'
import { OBJETIVOS } from '../utils/consejos'
import { SUPLEMENTOS } from '../utils/suplementos'

export default function Config() {
  const { user, signOut, isConfigured } = useAuth()
  const [config, setConfig] = useStorage('config', {
    objetivo: 'mantener_peso',
    pesoKg: 70,
    metaCalorias: '',
    metaProteina: '',
    suplementosActivos: SUPLEMENTOS.map((s) => s.id),
  })

  const setObjetivo = (v) => setConfig((c) => ({ ...c, objetivo: v }))
  const setPeso = (v) => {
    if (v === '' || v == null) {
      setConfig((c) => ({ ...c, pesoKg: '' }))
      return
    }
    const num = Number(v)
    if (!Number.isNaN(num) && num >= 0) setConfig((c) => ({ ...c, pesoKg: num }))
  }
  const setMetaCalorias = (v) => setConfig((c) => ({ ...c, metaCalorias: v === '' ? '' : String(Math.max(0, parseInt(v, 10) || 0)) }))
  const setMetaProteina = (v) => setConfig((c) => ({ ...c, metaProteina: v === '' ? '' : String(Math.max(0, parseInt(v, 10) || 0)) }))

  const toggleSuplemento = (id) => {
    setConfig((c) => {
      const act = c.suplementosActivos ?? SUPLEMENTOS.map((s) => s.id)
      const has = act.includes(id)
      return { ...c, suplementosActivos: has ? act.filter((x) => x !== id) : [...act, id] }
    })
  }

  const suplementosActivos = config.suplementosActivos ?? SUPLEMENTOS.map((s) => s.id)

  return (
    <section className="section py-4">
      <div className="container" style={{ maxWidth: '560px' }}>
        <header className="mb-4">
          <h1 className="title is-5 mb-2">Configuración</h1>
          <p className="is-size-7 has-text-grey mb-0">Tu objetivo y peso se usan para calorías quemadas y consejos personalizados</p>
        </header>

        <div className="box mb-4 py-3">
          <h2 className="title is-6 is-size-7 mb-2">Cuenta</h2>
          <p className="is-size-7 has-text-grey mb-2">
            Con una cuenta tu progreso se guarda en la nube y podrás recuperarlo en otro dispositivo.
          </p>
          {user ? (
            <div className="is-flex is-align-items-center is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
              <span className="is-size-7">{user.email}</span>
              <button type="button" className="button is-small is-light" onClick={() => signOut()}>
                Cerrar sesión
              </button>
            </div>
          ) : isConfigured ? (
            <Link to="/login" className="button is-link is-small">Iniciar sesión o crear cuenta</Link>
          ) : (
            <p className="is-size-7 has-text-grey mb-0">
              Configura Supabase (ver README) para usar cuentas.
            </p>
          )}
        </div>

        <div className="box mb-4 py-3">
          <h2 className="title is-6 is-size-7 mb-2">Tu objetivo</h2>
          <div className="buttons are-small is-flex-wrap-wrap">
            {OBJETIVOS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`button ${config.objetivo === o.value ? 'is-link' : 'is-light'}`}
                onClick={() => setObjetivo(o.value)}
              >
                <span className="mr-2">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="box mb-4 py-3">
          <h2 className="title is-6 is-size-7 mb-2">Metas diarias (opcional)</h2>
          <p className="is-size-7 has-text-grey mb-2">Para ver barras de progreso en Inicio y Comida.</p>
          <div className="columns">
            <div className="column">
              <div className="field">
                <label className="label is-size-7">Meta calorías (kcal/día)</label>
                <div className="control">
                  <input className="input is-small" type="number" min="0" placeholder="Ej: 2000" value={config.metaCalorias ?? ''} onChange={(e) => setMetaCalorias(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="column">
              <div className="field">
                <label className="label is-size-7">Meta proteína (g/día)</label>
                <div className="control">
                  <input className="input is-small" type="number" min="0" placeholder="Ej: 100" value={config.metaProteina ?? ''} onChange={(e) => setMetaProteina(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="box mb-4 py-3">
          <h2 className="title is-6 is-size-7 mb-2">Peso (kg)</h2>
          <p className="is-size-7 has-text-grey mb-2">
            Se usa para estimar calorías quemadas en ejercicio. Aproximado.
          </p>
          <div className="field">
            <div className="control">
              <input
                className="input is-small"
                type="number"
                min="0"
                step="0.1"
                value={config.pesoKg === '' || config.pesoKg == null ? '' : config.pesoKg}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="70"
              />
            </div>
          </div>
        </div>

        <div className="box py-3">
          <h2 className="title is-6 is-size-7 mb-2">Suplementos que tomas</h2>
          <p className="is-size-7 has-text-grey mb-2">
            Elige cuáles quieres registrar cada día. En Inicio podrás marcar si los tomaste.
          </p>
          <div className="buttons are-small are-flex-wrap-wrap">
            {SUPLEMENTOS.map((s) => {
              const activo = suplementosActivos.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`button ${activo ? 'is-success' : 'is-light'}`}
                  onClick={() => toggleSuplemento(s.id)}
                >
                  {activo ? '✓ ' : ''}{s.label}
                </button>
              )
            })}
          </div>
        </div>

      </div>
    </section>
  )
}
