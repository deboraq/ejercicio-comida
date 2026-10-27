import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildAsistenteContexto } from '../utils/asistenteContexto'
import { consultarGemini } from '../utils/geminiAsistente'
import { fechaToISO } from '../utils/calorias'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const EJEMPLOS = [
  'Estoy en el día 3 del plan: ¿qué comida y qué gym toca?',
  '¿Qué opciones de comida tengo hoy en el plan?',
  '¿Cómo venís este mes con comida, ejercicio y el plan?',
  '¿Cuántas kcal llevo hoy vs mi meta?',
  '¿Qué comí hoy según mis registros?',
  'Estimá un plato de ravioles con salsa bolognesa, porción normal',
  'Quiero registrar la opción 2 del almuerzo de hoy en el plan',
]

export default function AsistenteGemini({
  config = {},
  comida = [],
  ejercicios = [],
  fechaRef,
  planMes1Estado = null,
  planPropio = null,
  planNutricionActivoId = '',
  planesNutricion = [],
  rutinas = [],
  rutinaActivaId = '',
  rutinaPesos = [],
  onIrRegistroComida,
  ajustesAsistenteAdmin = false,
  modoFlotante = false,
  flotanteAbierto = false,
  onCerrar,
  datosListos = true,
}) {
  const { user } = useAuth()
  const [mensajes, setMensajes] = useState([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [ultimoAlimento, setUltimoAlimento] = useState(null)
  const [ultimoPlanRegistro, setUltimoPlanRegistro] = useState(null)
  const [minimizado, setMinimizado] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setMensajes([])
    setInput('')
    setError('')
    setUltimoAlimento(null)
    setUltimoPlanRegistro(null)
    setMinimizado(false)
  }, [user?.id])

  useEffect(() => {
    if (!modoFlotante || !flotanteAbierto || !datosListos) return
    const t = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: false })
      inputRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    }, 280)
    return () => window.clearTimeout(t)
  }, [modoFlotante, flotanteAbierto, datosListos])

  const hoy = fechaRef || fechaToISO(new Date())
  const tieneKeyLocal = Boolean(String(config.geminiApiKey || '').trim())
  const listo = Boolean(user) || (ajustesAsistenteAdmin && tieneKeyLocal)

  const contextoBase = useMemo(
    () => ({
      config,
      comida,
      ejercicios,
      fechaRef: hoy,
      planMes1Estado,
      planPropio,
      planNutricionActivoId,
      planesNutricion,
      rutinas,
      rutinaActivaId,
      rutinaPesos,
    }),
    [
      config,
      comida,
      ejercicios,
      hoy,
      planMes1Estado,
      planPropio,
      planNutricionActivoId,
      planesNutricion,
      rutinas,
      rutinaActivaId,
      rutinaPesos,
    ],
  )

  const contextoPreview = useMemo(() => {
    try {
      return buildAsistenteContexto({ ...contextoBase, pregunta: input })
    } catch (err) {
      console.error('buildAsistenteContexto', err)
      return { error_contexto: err?.message || 'No se pudo armar el contexto' }
    }
  }, [contextoBase, input])

  const enviar = async (texto) => {
    const pregunta = (texto ?? input).trim()
    if (!pregunta || cargando || !datosListos) return
    setError('')
    setUltimoAlimento(null)
    setUltimoPlanRegistro(null)
    setInput('')

    const userMsg = { role: 'user', text: pregunta }
    setMensajes((prev) => [...prev, userMsg])
    setCargando(true)

    try {
      let accessToken = null
      if (user && isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession()
        accessToken = data.session?.access_token ?? null
      }

      const contexto = buildAsistenteContexto({ ...contextoBase, pregunta })
      const historial = mensajes.map((m) => ({ role: m.role, text: m.text }))
      const res = await consultarGemini({
        accessToken,
        apiKey: ajustesAsistenteAdmin ? config.geminiApiKey : '',
        modelo: ajustesAsistenteAdmin ? config.geminiModelo : undefined,
        pregunta,
        contexto,
        historial,
      })
      setMensajes((prev) => [...prev, { role: 'model', text: res.visible }])
      if (res.planRegistroSugerido) {
        setUltimoPlanRegistro(res.planRegistroSugerido)
        setUltimoAlimento(null)
      } else if (res.alimentoSugerido) {
        setUltimoAlimento(res.alimentoSugerido)
        setUltimoPlanRegistro(null)
      }
    } catch (e) {
      setError(e.message || 'Error al consultar')
    } finally {
      setCargando(false)
      requestAnimationFrame(() => {
        listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }

  const shellClass = [
    modoFlotante ? 'ai-asistente-float' : 'cd-panel cd-asistente',
    !modoFlotante && minimizado ? ' cd-asistente--minimized' : '',
  ].join('')

  if (!listo) {
    return (
      <section className={shellClass}>
        <h2 className="cd-asistente-title">Asistente IA</h2>
        <p className="cd-asistente-hint mb-3">
          Iniciá sesión para preguntar sobre tu día, el mes o calorías de un alimento.
        </p>
        <p className="cd-asistente-hint mb-0">
          <Link to="/login">Iniciar sesión</Link>
        </p>
      </section>
    )
  }

  return (
    <section className={shellClass}>
      <div className="cd-asistente-head">
        <h2 className="cd-asistente-title mb-0">Asistente IA</h2>
        <div className="cd-asistente-head-actions">
          {ajustesAsistenteAdmin && (
            <Link to="/config#asistente-gemini" className="cd-asistente-config-link">
              Admin
            </Link>
          )}
          {modoFlotante ? (
            <button type="button" className="cd-asistente-minimize" onClick={onCerrar} aria-label="Cerrar">
              Cerrar
            </button>
          ) : (
            <button
              type="button"
              className="cd-asistente-minimize"
              onClick={() => setMinimizado((m) => !m)}
              aria-expanded={!minimizado}
            >
              {minimizado ? 'Expandir' : 'Minimizar'}
            </button>
          )}
        </div>
      </div>

      {!modoFlotante && minimizado ? (
        <p className="cd-asistente-hint cd-asistente-minimized-hint mb-0">
          {mensajes.length > 0
            ? `Última respuesta: ${mensajes[mensajes.length - 1].text.slice(0, 120)}${mensajes[mensajes.length - 1].text.length > 120 ? '…' : ''}`
            : 'Panel minimizado. Tocá Expandir para seguir consultando.'}
        </p>
      ) : (
        <>
          {!datosListos && (
            <p className="cd-asistente-hint mb-2">Cargando tus datos…</p>
          )}
          {datosListos && (
          <p className="cd-asistente-hint mb-2">
            Solo uso <strong>tus</strong> registros (comida, ejercicio, gym y plan). Las estimaciones son aproximadas.
          </p>
          )}

          <div className="cd-asistente-ejemplos mb-2">
            {EJEMPLOS.map((ej) => (
              <button
                key={ej}
                type="button"
                className="cd-asistente-chip"
                disabled={cargando || !datosListos}
                onClick={() => enviar(ej)}
              >
                {ej}
              </button>
            ))}
          </div>

          <div className="cd-asistente-chat" ref={listRef} aria-live="polite">
            {mensajes.length === 0 && (
              <p className="cd-asistente-empty">Escribí una pregunta o tocá un ejemplo.</p>
            )}
            {mensajes.map((m, i) => (
              <div key={`${i}-${m.role}`} className={`cd-asistente-msg cd-asistente-msg--${m.role}`}>
                {m.text}
              </div>
            ))}
            {cargando && <p className="cd-asistente-loading mb-0">Pensando…</p>}
          </div>

          {error && <p className="cd-asistente-error mb-2">{error}</p>}

          {ultimoPlanRegistro && onIrRegistroComida && (
            <div className="cd-asistente-sugerido mb-2">
              <p className="mb-1">
                <strong>Plan · {ultimoPlanRegistro.momento}</strong>
                {ultimoPlanRegistro.opcion ? ` · Opción ${ultimoPlanRegistro.opcion}` : ''}
                <br />
                {ultimoPlanRegistro.textoPlan}
              </p>
              <button
                type="button"
                className="cd-btn cd-btn--primary cd-btn--sm"
                onClick={() => onIrRegistroComida({ tipo: 'plan', ...ultimoPlanRegistro })}
              >
                Ir a registrar esta comida del plan
              </button>
            </div>
          )}

          {ultimoAlimento && onIrRegistroComida && !ultimoPlanRegistro && (
            <div className="cd-asistente-sugerido mb-2">
              <p className="mb-1">
                <strong>Sugerencia:</strong> {ultimoAlimento.descripcion}
                {ultimoAlimento.porcion ? ` · ${ultimoAlimento.porcion}` : ''} — ~{ultimoAlimento.calorias} kcal
              </p>
              <button
                type="button"
                className="cd-btn cd-btn--primary cd-btn--sm"
                onClick={() => onIrRegistroComida({ tipo: 'estimacion', ...ultimoAlimento })}
              >
                Usar en registro de comida
              </button>
            </div>
          )}

          <form
            className="cd-asistente-form"
            onSubmit={(e) => {
              e.preventDefault()
              enviar()
            }}
          >
            <input
              ref={inputRef}
              className="input cd-asistente-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => {
                if (modoFlotante) {
                  requestAnimationFrame(() => {
                    inputRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
                  })
                }
              }}
              placeholder="Preguntá sobre tu mes, tu día o un alimento…"
              disabled={cargando || !datosListos}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button
              type="submit"
              className="cd-btn cd-btn--primary"
              disabled={cargando || !datosListos || !input.trim()}
            >
              Enviar
            </button>
          </form>

          {ajustesAsistenteAdmin && (
            <details className="cd-asistente-context mt-2">
              <summary>Ver contexto que se envía (debug)</summary>
              <pre className="cd-asistente-context-pre">{JSON.stringify(contextoPreview, null, 2)}</pre>
            </details>
          )}
        </>
      )}
    </section>
  )
}
