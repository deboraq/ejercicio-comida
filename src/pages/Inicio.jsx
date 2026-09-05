import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMyProfile } from '../hooks/useMyProfile'
import { useStorage } from '../hooks/useStorage'
import {
  caloriasEjercicioRegistro,
  caloriasQuemadasRutinaDia,
  fechaToISO,
  fechaSoloDia,
  minutosRutinaDia,
} from '../utils/calorias'
import { getConsejos, buildContextoDia, buildContextoSemana } from '../utils/consejos'
import { getRachaDias, getUltimosNDias } from '../utils/estadisticas'
import { SUPLEMENTOS } from '../utils/suplementos'
import { buildPerfilCorporal } from '../utils/composicion'

const LABEL_TIPO_CONSEJO = {
  nutricion: 'Nutrición',
  balance: 'Balance',
  salud: 'Salud',
  habitos: 'Hábitos',
  habito: 'Hábitos',
  recuperacion: 'Recuperación',
  rendimiento: 'Rendimiento',
  descanso: 'Descanso',
  ejercicio: 'Ejercicio',
  comida: 'Nutrición',
  medidas: 'Medidas',
  perfil: 'Perfil',
}

const DIAS_CORTO = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO']

const MEAL_ICON = {
  Desayuno: { icon: '🍳', tone: 'orange' },
  Almuerzo: { icon: '🥗', tone: 'blue' },
  Merienda: { icon: '🍎', tone: 'red' },
  Snack: { icon: '🍎', tone: 'red' },
  Cena: { icon: '🌙', tone: 'purple' },
}

function mealStyle(tipo) {
  if (MEAL_ICON[tipo]) return MEAL_ICON[tipo]
  if (/merienda|snack/i.test(tipo)) return MEAL_ICON.Merienda
  if (/desayuno/i.test(tipo)) return MEAL_ICON.Desayuno
  if (/almuerzo/i.test(tipo)) return MEAL_ICON.Almuerzo
  if (/cena/i.test(tipo)) return MEAL_ICON.Cena
  return { icon: '🍽️', tone: 'blue' }
}

function primerNombre(profile, user) {
  const full = (profile?.full_name || '').trim()
  if (full) return full.split(/\s+/)[0]
  const email = user?.email || ''
  if (email.includes('@')) return email.split('@')[0]
  return 'atleta'
}

function getSemanaDe(fechaISO) {
  const base = new Date(`${fechaISO}T12:00:00`)
  const dow = base.getDay()
  const offsetLunes = dow === 0 ? -6 : 1 - dow
  const lunes = new Date(base)
  lunes.setDate(base.getDate() + offsetLunes)
  const dias = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    dias.push(fechaToISO(d))
  }
  return dias
}

function numeroSemanaISO(fechaISO) {
  const d = new Date(`${fechaISO}T12:00:00`)
  // ISO: la semana la define el jueves (lun=1 … dom=7)
  const dayNum = d.getDay() || 7
  d.setDate(d.getDate() + 4 - dayNum)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

function etiquetaSemana(diasSemana, preferFecha) {
  if (!diasSemana.length) return ''
  // El nº de semana es el de la tira entera (lunes), no del día clickeado
  const nSem = numeroSemanaISO(diasSemana[0])
  // El mes lo tomamos del día en vista (o del jueves de esa semana)
  const refMes =
    preferFecha && diasSemana.includes(preferFecha) ? preferFecha : diasSemana[3] || diasSemana[0]
  const dMes = new Date(`${refMes}T12:00:00`)
  const mes = dMes.toLocaleDateString('es', { month: 'long' })
  const mesCap = mes.replace(/^\w/, (c) => c.toUpperCase())
  return `Semana ${nSem} • ${mesCap} ${dMes.getFullYear()}`
}

function pctMeta(valor, meta) {
  if (!meta || meta <= 0) return 0
  return Math.min(100, Math.round((Number(valor) / Number(meta)) * 100))
}

function formatK(n) {
  const v = Math.round(Number(n) || 0)
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(v)
}

function diasDesde(fechaISO, hoyISO) {
  if (!fechaISO) return null
  const a = new Date(`${fechaSoloDia(fechaISO)}T12:00:00`)
  const b = new Date(`${hoyISO}T12:00:00`)
  return Math.max(0, Math.round((b - a) / 86400000))
}

function agruparComidasDia(comidas) {
  const orden = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena']
  const map = {}
  for (const c of comidas) {
    const k = c.comida || 'Otros'
    if (!map[k]) map[k] = []
    map[k].push(c)
  }
  const keys = [...orden.filter((o) => map[o]), ...Object.keys(map).filter((k) => !orden.includes(k))]
  return keys.map((tipo) => {
    const items = map[tipo]
    const kcal = items.reduce((s, r) => s + (Number(r.calorias) || 0), 0)
    const pro = items.reduce((s, r) => s + (Number(r.proteinas) || 0), 0)
    const car = items.reduce((s, r) => s + (Number(r.carbohidratos) || 0), 0)
    const gra = items.reduce((s, r) => s + (Number(r.grasas) || 0), 0)
    return { tipo, items, kcal, pro, car, gra }
  })
}

function quemadasEnFecha(ejercicios, registrosRutina, fecha, pesoKg) {
  return (
    ejercicios.filter((e) => fechaSoloDia(e.fecha) === fecha).reduce((s, e) => s + caloriasEjercicioRegistro(e, pesoKg), 0) +
    caloriasQuemadasRutinaDia(registrosRutina, fecha, pesoKg)
  )
}

export default function Inicio() {
  const { user, isConfigured } = useAuth()
  const { profile } = useMyProfile()
  const [ejercicios] = useStorage('ejercicios', [])
  const [comida] = useStorage('comida', [])
  const [suplementos, setSuplementos] = useStorage('suplementos', [])
  const [registrosRutina] = useStorage('rutinaPesos', [])
  const [historialPeso] = useStorage('pesoHistorial', [])
  const [historialMedidas] = useStorage('medidasHistorial', [])
  const [config] = useStorage('config', { objetivo: 'mantener_peso', pesoKg: 70 })

  const hoy = fechaToISO(new Date())
  const [diaEnVista, setDiaEnVista] = useState(hoy)
  const [anclaSemana, setAnclaSemana] = useState(hoy)
  const [mesModalAbierto, setMesModalAbierto] = useState(false)
  const [mesCalendario, setMesCalendario] = useState(() => hoy.slice(0, 7))
  const [barrasAnimadas, setBarrasAnimadas] = useState(false)

  const diasSemana = useMemo(() => getSemanaDe(anclaSemana), [anclaSemana])

  useEffect(() => {
    setBarrasAnimadas(false)
    const t = setTimeout(() => setBarrasAnimadas(true), 160)
    return () => clearTimeout(t)
  }, [anclaSemana, diaEnVista])

  const nombre = primerNombre(profile, user)
  const pesoCfg = config?.pesoKg || 70

  const ayer = useMemo(() => {
    const d = new Date(`${diaEnVista}T12:00:00`)
    d.setDate(d.getDate() - 1)
    return fechaToISO(d)
  }, [diaEnVista])

  const ejerciciosDelDia = ejercicios.filter((e) => fechaSoloDia(e.fecha) === diaEnVista)
  const comidasDelDia = comida.filter((c) => fechaSoloDia(c.fecha) === diaEnVista)
  const suplementosDelDia = suplementos.find((s) => fechaSoloDia(s.fecha) === diaEnVista)?.items ?? []
  const suplementosActivos = config?.suplementosActivos ?? SUPLEMENTOS.map((s) => s.id)
  const listaParaMarcar = SUPLEMENTOS.filter((s) => suplementosActivos.includes(s.id))

  const toggleSuplementoDia = (id) => {
    setSuplementos((prev) => {
      const rest = prev.filter((s) => fechaSoloDia(s.fecha) !== diaEnVista)
      const current = prev.find((s) => fechaSoloDia(s.fecha) === diaEnVista)?.items ?? []
      const has = current.includes(id)
      const newItems = has ? current.filter((x) => x !== id) : [...current, id]
      if (newItems.length === 0) return rest
      return [...rest, { fecha: diaEnVista, items: newItems }]
    })
  }

  const resumenPesoCorporal = useMemo(() => {
    const h = historialPeso
    if (!Array.isArray(h) || h.length === 0) return null
    const o = [...h].sort((a, b) => fechaSoloDia(b.fecha).localeCompare(fechaSoloDia(a.fecha)))
    const ult = o[0]
    const pen = o[1]
    const delta = pen != null ? Math.round((Number(ult.pesoKg) - Number(pen.pesoKg)) * 10) / 10 : null
    return { ult, pen, delta }
  }, [historialPeso])

  const resumenMedidas = useMemo(() => {
    const h = historialMedidas
    if (!Array.isArray(h) || h.length === 0) return null
    const o = [...h].sort((a, b) => fechaSoloDia(b.fecha).localeCompare(fechaSoloDia(a.fecha)))
    return { ult: o[0] }
  }, [historialMedidas])

  const perfilCorporal = useMemo(() => {
    const pesoHist = resumenPesoCorporal?.ult?.pesoKg
    return buildPerfilCorporal(config, pesoHist ?? config?.pesoKg)
  }, [config, resumenPesoCorporal])

  const minutosDia =
    ejerciciosDelDia.reduce((s, e) => s + (Number(e.duracion) || 0), 0) +
    minutosRutinaDia(registrosRutina, diaEnVista)
  const caloriasQuemadasDia = quemadasEnFecha(ejercicios, registrosRutina, diaEnVista, pesoCfg)
  const caloriasQuemadasAyer = quemadasEnFecha(ejercicios, registrosRutina, ayer, pesoCfg)
  const caloriasConsumidasDia = comidasDelDia.reduce((s, r) => s + (Number(r.calorias) || 0), 0)
  const proteinasDia = comidasDelDia.reduce((s, r) => s + (Number(r.proteinas) || 0), 0)
  const carbosDia = comidasDelDia.reduce((s, r) => s + (Number(r.carbohidratos) || 0), 0)
  const grasasDia = comidasDelDia.reduce((s, r) => s + (Number(r.grasas) || 0), 0)

  const metaKcal = Number(config?.metaCalorias) || 0
  const metaPro = Number(config?.metaProteina) || 0
  const metaCarb = Number(config?.metaCarbohidratos) || 0
  const metaGra = Number(config?.metaGrasa) || 0
  const metaQuemadas = Number(config?.metaCaloriasQuemadas) || 0
  const faltanKcal = metaKcal > 0 ? Math.max(0, Math.round(metaKcal - caloriasConsumidasDia)) : null
  const pctKcal = pctMeta(caloriasConsumidasDia, metaKcal)
  const pctPro = pctMeta(proteinasDia, metaPro)

  const etiquetaVsAnterior = diaEnVista === hoy ? 'vs ayer' : 'vs día anterior'
  const cmpQuemadas = (() => {
    const hoyK = Math.round(caloriasQuemadasDia)
    const antK = Math.round(caloriasQuemadasAyer)
    if (antK > 0) {
      const pct = Math.round(((hoyK - antK) / antK) * 100)
      return {
        up: pct >= 0,
        texto: `${pct >= 0 ? '+' : ''}${pct}% ${etiquetaVsAnterior}`,
      }
    }
    if (hoyK > 0) {
      return {
        up: true,
        texto: `+${hoyK.toLocaleString('es-AR')} kcal ${etiquetaVsAnterior}`,
      }
    }
    return {
      up: null,
      texto: diaEnVista === hoy ? 'Sin actividad ayer ni hoy' : 'Sin actividad este día ni el anterior',
    }
  })()

  const diasUltimos7 = getUltimosNDias(7)
  const contextoDia = buildContextoDia({
    comidas: comida,
    ejercicios,
    registrosRutina,
    fecha: diaEnVista,
    pesoKg: pesoCfg,
    config,
  })
  const contextoSemana = buildContextoSemana({
    comidas: comida,
    ejercicios,
    registrosRutina,
    dias: diasUltimos7,
    pesoKg: pesoCfg,
    config,
  })
  const { diarios: consejosDiarios } = getConsejos(
    config?.objetivo,
    contextoDia,
    contextoSemana,
    config,
    { historialMedidas, hoy: diaEnVista }
  )
  const tipHoy = consejosDiarios?.[0] || null

  const racha = getRachaDias(
    [
      ...ejercicios.map((e) => ({ fecha: fechaSoloDia(e.fecha) })),
      ...comida.map((c) => ({ fecha: fechaSoloDia(c.fecha) })),
      ...registrosRutina.map((r) => ({ fecha: fechaSoloDia(r.fecha) })),
    ],
    hoy
  )

  const fechasConComida = useMemo(() => new Set(comida.map((c) => fechaSoloDia(c.fecha))), [comida])
  const fechasConEjercicio = useMemo(
    () =>
      new Set([
        ...ejercicios.map((e) => fechaSoloDia(e.fecha)),
        ...registrosRutina.map((r) => fechaSoloDia(r.fecha)),
      ]),
    [ejercicios, registrosRutina]
  )

  const caloriasPorDiaSemana = diasSemana.map((f) => ({
    fecha: f,
    cal: comida.filter((c) => fechaSoloDia(c.fecha) === f).reduce((s, r) => s + (Number(r.calorias) || 0), 0),
    quemadas: quemadasEnFecha(ejercicios, registrosRutina, f, pesoCfg),
  }))
  const maxGrafico = Math.max(1, ...caloriasPorDiaSemana.flatMap((d) => [d.cal, d.quemadas]))
  const balanceSemanal = caloriasPorDiaSemana.reduce((s, d) => s + d.cal - d.quemadas, 0)
  const balanceOptimo = Math.abs(balanceSemanal) < metaKcal * 3.5 || Math.abs(balanceSemanal) < 4500

  const comidasAgrupadas = agruparComidasDia(comidasDelDia)
  const numEjerciciosDia =
    ejerciciosDelDia.length + registrosRutina.filter((r) => fechaSoloDia(r.fecha) === diaEnVista).length
  const suplementosTomados = listaParaMarcar.filter((s) => suplementosDelDia.includes(s.id)).length
  const alDiaComidas = comidasDelDia.length > 0

  const fechaPesoRef = resumenPesoCorporal?.ult?.fecha || resumenMedidas?.ult?.fecha
  const diasDesdeUpdate = diasDesde(fechaPesoRef, hoy)

  const shiftSemana = (dir) => {
    const d = new Date(`${anclaSemana}T12:00:00`)
    d.setDate(d.getDate() + dir * 7)
    const iso = fechaToISO(d)
    setAnclaSemana(iso)
    const sem = getSemanaDe(iso)
    if (!sem.includes(diaEnVista)) setDiaEnVista(sem.includes(hoy) ? hoy : sem[0])
  }

  const seleccionarDia = (fecha) => {
    setDiaEnVista(fecha)
    setAnclaSemana(fecha)
  }

  function getDiasDelMes(yearMonth) {
    const [y, m] = yearMonth.split('-').map(Number)
    const primerDia = new Date(y, m - 1, 1)
    const ultimoDia = new Date(y, m, 0)
    const diasEnMes = ultimoDia.getDate()
    const inicioSemana = primerDia.getDay()
    const celdasVaciasInicio = inicioSemana === 0 ? 6 : inicioSemana - 1
    const totalCeldas = Math.ceil((celdasVaciasInicio + diasEnMes) / 7) * 7
    const dias = []
    for (let i = 0; i < celdasVaciasInicio; i++) dias.push({ vacio: true })
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      dias.push({ fecha, vacio: false, dia: d })
    }
    while (dias.length < totalCeldas) dias.push({ vacio: true })
    return dias
  }

  const diasDelMes = getDiasDelMes(mesCalendario)
  const etiquetaDiaComidas = (() => {
    const d = new Date(`${diaEnVista}T12:00:00`)
    const nombreDia = d.toLocaleDateString('es-ES', { weekday: 'long' })
    return `${nombreDia.charAt(0).toUpperCase()}${nombreDia.slice(1)} ${d.getDate()}`
  })()

  return (
    <section className="section inicio-page inicio-dash">
      <div className="container app-page-container inicio-dash-container">
        {isConfigured && !user && (
          <div className="box mb-3">
            <p className="is-size-7 mb-2 has-text-grey">
              Iniciá sesión para guardar tu progreso en la nube.
            </p>
            <Link to="/login" className="button is-link is-small">Iniciar sesión</Link>
          </div>
        )}

        <header className="inicio-dash-hero">
          <div className="inicio-dash-hero-text">
            <div className="inicio-dash-hello-row">
              <h1 className="inicio-dash-hello">
                ¡Hola, {nombre}! <span aria-hidden>👋</span>
              </h1>
              {racha > 0 && (
                <span
                  className="inicio-hoy-racha"
                  title="Días seguidos con registro. Si hoy aún no cargaste nada, la racha sigue hasta medianoche."
                >
                  <span className="inicio-hoy-racha-icon" aria-hidden>🔥</span>
                  <span className="inicio-hoy-racha-text">{racha} días de racha</span>
                </span>
              )}
            </div>
            <p className="inicio-dash-sub mb-0">
              Resumen diario de nutrición, gasto calórico y progreso físico.
            </p>
          </div>
          <div className="inicio-dash-actions">
            <Link to="/comida" className="inicio-dash-btn inicio-dash-btn--ghost">
              <span className="inicio-dash-btn-ico inicio-dash-btn-ico--plus" aria-hidden>+</span>
              Registrar comida
            </Link>
            <Link to="/ejercicios" className="inicio-dash-btn inicio-dash-btn--primary">
              <span className="inicio-dash-btn-ico" aria-hidden>▷</span>
              Iniciar ejercicio
            </Link>
          </div>
        </header>

        <div className="inicio-week-strip">
          <div className="inicio-week-nav-group">
            <button type="button" className="inicio-week-nav" onClick={() => shiftSemana(-1)} aria-label="Semana anterior">‹</button>
            <button type="button" className="inicio-week-nav" onClick={() => shiftSemana(1)} aria-label="Semana siguiente">›</button>
            <p className="inicio-week-label mb-0">{etiquetaSemana(diasSemana, diaEnVista)}</p>
          </div>

          <div className="inicio-week-days">
            {diasSemana.map((fecha, i) => {
              const d = new Date(`${fecha}T12:00:00`)
              const esHoy = fecha === hoy
              const sel = fecha === diaEnVista
              const futuro = fecha > hoy
              return (
                <button
                  key={fecha}
                  type="button"
                  className={`inicio-week-day${sel ? ' is-selected' : ''}${esHoy ? ' is-today' : ''}${futuro ? ' is-future' : ''}`}
                  onClick={() => seleccionarDia(fecha)}
                >
                  <span className="inicio-week-day-name">
                    {esHoy ? `HOY • ${DIAS_CORTO[i]}` : DIAS_CORTO[i]}
                  </span>
                  <span className="inicio-week-day-num">{d.getDate()}</span>
                  <span className="inicio-week-day-dots" aria-hidden>
                    {fechasConComida.has(fecha) && <i className="dot-food" />}
                    {fechasConEjercicio.has(fecha) && <i className="dot-ex" />}
                  </span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="inicio-week-mes-btn"
            onClick={() => {
              setMesCalendario(diaEnVista.slice(0, 7))
              setMesModalAbierto(true)
            }}
          >
            Mes completo
          </button>
        </div>

        <div className="inicio-kpi-grid">
          <article className="box inicio-kpi-card">
            <div className="inicio-kpi-top">
              <p className="inicio-kpi-label">Calorías consumidas</p>
              <span className="inicio-kpi-icon inicio-kpi-icon--blue" aria-hidden>🥣</span>
            </div>
            <p className="inicio-kpi-value">
              {Math.round(caloriasConsumidasDia).toLocaleString('es-AR')}
              {metaKcal > 0 ? (
                <span className="inicio-kpi-meta"> / {metaKcal.toLocaleString('es-AR')} kcal</span>
              ) : (
                <span className="inicio-kpi-meta"> kcal</span>
              )}
            </p>
            {metaKcal > 0 && (
              <>
                <div className="inicio-kpi-bar">
                  <span style={{ width: `${pctKcal}%` }} />
                </div>
                <div className="inicio-kpi-foot">
                  <span>{pctKcal}% meta diaria</span>
                  <span>{faltanKcal > 0 ? `Faltan ${faltanKcal.toLocaleString('es-AR')} kcal` : 'Meta alcanzada'}</span>
                </div>
              </>
            )}
          </article>

          <article className="box inicio-kpi-card">
            <div className="inicio-kpi-top">
              <p className="inicio-kpi-label">Calorías quemadas</p>
              <span className="inicio-kpi-icon inicio-kpi-icon--green" aria-hidden>🔥</span>
            </div>
            <p className="inicio-kpi-value">
              {Math.round(caloriasQuemadasDia).toLocaleString('es-AR')}
              <span className="inicio-kpi-meta"> kcal activas</span>
            </p>
            <div className="inicio-kpi-foot inicio-kpi-foot--stack">
              <span
                className={
                  cmpQuemadas.up == null
                    ? 'inicio-kpi-hint'
                    : cmpQuemadas.up
                      ? 'inicio-kpi-trend is-up'
                      : 'inicio-kpi-trend is-down'
                }
              >
                {cmpQuemadas.up != null ? (cmpQuemadas.up ? '↗ ' : '↘ ') : ''}
                {cmpQuemadas.texto}
              </span>
              {metaQuemadas > 0 && (
                <span className="inicio-kpi-hint">Meta: {metaQuemadas} kcal</span>
              )}
            </div>
          </article>

          <article className="box inicio-kpi-card">
            <div className="inicio-kpi-top">
              <p className="inicio-kpi-label">Macronutrientes</p>
              <span className="inicio-kpi-icon inicio-kpi-icon--purple" aria-hidden>🏋️</span>
            </div>
            <p className="inicio-kpi-value">
              {Math.round(proteinasDia)}g
              <span className="inicio-kpi-meta"> Proteína{metaPro > 0 ? ` (${pctPro}%)` : ''}</span>
            </p>
            <div className="inicio-kpi-macros" aria-hidden>
              <span
                className="inicio-kpi-mac inicio-kpi-mac--p"
                style={{
                  flexGrow: metaPro > 0 ? Math.max(pctMeta(proteinasDia, metaPro), 4) : Math.max(proteinasDia, 1),
                }}
              />
              <span
                className="inicio-kpi-mac inicio-kpi-mac--c"
                style={{
                  flexGrow: metaCarb > 0 ? Math.max(pctMeta(carbosDia, metaCarb), 4) : Math.max(carbosDia, 1),
                }}
              />
              <span
                className="inicio-kpi-mac inicio-kpi-mac--g"
                style={{
                  flexGrow: metaGra > 0 ? Math.max(pctMeta(grasasDia, metaGra), 4) : Math.max(grasasDia, 1),
                }}
              />
            </div>
            <p className="inicio-kpi-macros-legend mb-0">
              <span className="inicio-kpi-mac-lab inicio-kpi-mac-lab--p">
                P: {Math.round(proteinasDia)}g{metaPro ? ` / ${metaPro}g` : ''}
              </span>
              <span className="inicio-kpi-mac-lab inicio-kpi-mac-lab--c">
                C: {Math.round(carbosDia)}g{metaCarb ? ` / ${metaCarb}g` : ''}
              </span>
              <span className="inicio-kpi-mac-lab inicio-kpi-mac-lab--g">
                G: {Math.round(grasasDia)}g{metaGra ? ` / ${metaGra}g` : ''}
              </span>
            </p>
          </article>

          <article className="box inicio-kpi-card">
            <div className="inicio-kpi-top">
              <p className="inicio-kpi-label">Tiempo activo</p>
              <span className="inicio-kpi-icon inicio-kpi-icon--teal" aria-hidden>⏱️</span>
            </div>
            <p className="inicio-kpi-value">
              {minutosDia}
              <span className="inicio-kpi-meta"> minutos</span>
            </p>
            <p className="inicio-kpi-hint mb-0">
              {numEjerciciosDia > 0 ? (
                <span className="inicio-kpi-ok">● Rutina completada · {numEjerciciosDia} ejercicio{numEjerciciosDia !== 1 ? 's' : ''}</span>
              ) : (
                'Sin entrenos este día'
              )}
            </p>
          </article>
        </div>

        <div className="inicio-dash-grid">
          <div className="inicio-dash-main">
            <div className="box inicio-chart-card">
              <div className="inicio-chart-head">
                <div>
                  <h2 className="inicio-card-title mb-0">Calorías por día</h2>
                  <p className="inicio-card-sub mb-0">
                    Comparación diaria de consumidas (azul) y quemadas (verde)
                  </p>
                </div>
                <p className="inicio-chart-legend mb-0">
                  <span className="swatch swatch--c" /> Consumidas
                  <span className="swatch swatch--q" /> Quemadas
                </p>
              </div>
              <div className="inicio-week-chart">
                {caloriasPorDiaSemana.map((d) => {
                  const pctCal = maxGrafico > 0 ? Math.round((d.cal / maxGrafico) * 100) : 0
                  const pctQuem = maxGrafico > 0 ? Math.round((d.quemadas / maxGrafico) * 100) : 0
                  const sel = d.fecha === diaEnVista
                  const esHoy = d.fecha === hoy
                  const fechaObj = new Date(`${d.fecha}T12:00:00`)
                  const [, mm, dd] = d.fecha.split('-')
                  const diaAbbr = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][fechaObj.getDay()]
                  const hCal = !barrasAnimadas
                    ? '0%'
                    : pctCal > 0
                      ? `${Math.max(pctCal, 10)}%`
                      : undefined
                  const hQuem = !barrasAnimadas
                    ? '0%'
                    : pctQuem > 0
                      ? `${Math.max(pctQuem, 10)}%`
                      : undefined
                  return (
                    <button
                      key={d.fecha}
                      type="button"
                      className={`inicio-week-chart-col${sel ? ' is-selected' : ''}${esHoy ? ' is-today' : ''}`}
                      onClick={() => seleccionarDia(d.fecha)}
                    >
                      <span className="inicio-week-chart-val">
                        {sel && d.cal > 0 ? formatK(d.cal) : '\u00A0'}
                      </span>
                      <div className="inicio-week-chart-bars" aria-hidden>
                        <div
                          className={`inicio-week-chart-bar inicio-week-chart-bar--c${pctCal <= 0 ? ' is-empty' : ''}`}
                          style={hCal != null ? { height: hCal } : undefined}
                        />
                        <div
                          className={`inicio-week-chart-bar inicio-week-chart-bar--q${pctQuem <= 0 ? ' is-empty' : ''}`}
                          style={hQuem != null ? { height: hQuem } : undefined}
                        />
                      </div>
                      <span className="inicio-week-chart-lab">
                        <span className="inicio-week-chart-date">{dd}/{mm}</span>
                        <span className="inicio-week-chart-dow">{esHoy ? 'HOY' : diaAbbr}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="inicio-chart-foot">
                <span>
                  Máx. del período:{' '}
                  <strong>{Math.round(maxGrafico).toLocaleString('es-AR')} kcal</strong>
                </span>
                <span className={balanceOptimo ? 'is-optimo' : 'is-alerta'}>
                  Balance calórico semanal: {balanceOptimo ? 'Óptimo' : 'Revisar'}
                </span>
              </div>
            </div>

            <div className="box inicio-meals-card">
              <div className="inicio-meals-head">
                <div className="inicio-meals-head-left">
                  <h2 className="inicio-card-title mb-0">
                    Comidas registradas <span className="inicio-meals-dot">·</span> {etiquetaDiaComidas}
                  </h2>
                  {alDiaComidas && <span className="inicio-meals-badge">Al día</span>}
                </div>
                <Link to="/comida" className="inicio-meals-add">+ Agregar ítem</Link>
              </div>
              {comidasAgrupadas.length === 0 ? (
                <p className="is-size-7 has-text-grey mb-0 mt-3">
                  Sin comidas este día.{' '}
                  <Link to="/comida">Registrar ahora</Link>
                </p>
              ) : (
                <ul className="inicio-meals-list">
                  {comidasAgrupadas.map((g) => {
                    const style = mealStyle(g.tipo)
                    return (
                      <li key={g.tipo} className="inicio-meals-item">
                        <span className={`inicio-meals-icon inicio-meals-icon--${style.tone}`} aria-hidden>
                          {style.icon}
                        </span>
                        <div className="inicio-meals-info">
                          <strong className="inicio-meals-name">{g.tipo}</strong>
                          <p className="inicio-meals-item-desc mb-0">
                            {g.items.map((it) => it.descripcion).filter(Boolean).join(', ') || 'Sin detalle'}
                          </p>
                        </div>
                        <div className="inicio-meals-stats">
                          <span className="inicio-meals-kcal">{Math.round(g.kcal)} kcal</span>
                          <span className="inicio-meals-item-macros">
                            P: {Math.round(g.pro)}g · C: {Math.round(g.car)}g · G: {Math.round(g.gra)}g
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          <aside className="inicio-dash-aside">
            <div className="box inicio-estado-card">
              <div className="inicio-estado-head">
                <div className="inicio-estado-head-text">
                  <div className="inicio-estado-title-row">
                    <span className="inicio-estado-trend" aria-hidden>📈</span>
                    <h2 className="inicio-card-title mb-0">Tu estado físico</h2>
                  </div>
                  <p className="inicio-card-sub mb-0">
                    {diasDesdeUpdate == null
                      ? 'Sin registros recientes'
                      : diasDesdeUpdate === 0
                        ? 'Actualizado hoy'
                        : diasDesdeUpdate === 1
                          ? 'Actualizado hace 1 día'
                          : `Actualizado hace ${diasDesdeUpdate} días`}
                  </p>
                </div>
                <Link to="/config#peso-seguimiento" className="inicio-estado-historial">Historial</Link>
              </div>
              <div className="inicio-estado-row">
                <div className="inicio-estado-cell">
                  <p className="inicio-kpi-label mb-1">Peso actual</p>
                  <p className="inicio-estado-val mb-0">
                    {resumenPesoCorporal?.ult?.pesoKg ?? pesoCfg ?? '—'}
                    <span className="inicio-kpi-meta"> kg</span>
                  </p>
                  {resumenPesoCorporal?.delta != null && (
                    <p className={`inicio-kpi-trend mb-0 ${resumenPesoCorporal.delta <= 0 ? 'is-up' : 'is-down'}`}>
                      {resumenPesoCorporal.delta <= 0 ? '↘' : '↗'}{' '}
                      {resumenPesoCorporal.delta > 0 ? '+' : ''}
                      {resumenPesoCorporal.delta} kg vs. anterior
                    </p>
                  )}
                </div>
                <div className="inicio-estado-cell">
                  <p className="inicio-kpi-label mb-1">Índice IMC</p>
                  <p className="inicio-estado-val mb-0">
                    {perfilCorporal.imc ?? '—'}
                    {perfilCorporal.imc != null && <span className="inicio-kpi-meta"> pts</span>}
                  </p>
                  {perfilCorporal.categoria && (
                    <p className="inicio-estado-imc-tag mb-0">{perfilCorporal.categoria.label}</p>
                  )}
                </div>
              </div>
              <Link to="/config#peso-seguimiento" className="inicio-estado-cta">
                + Actualizar medidas de hoy
              </Link>
            </div>

            {listaParaMarcar.length > 0 && (
              <div className="box inicio-sups-card">
                <div className="inicio-sups-head">
                  <div>
                    <h2 className="inicio-card-title mb-0">Suplementos de hoy</h2>
                    <p className="inicio-card-sub mb-0">Marca los que ya tomaste para no olvidar.</p>
                  </div>
                  <span className="inicio-sups-count">
                    {suplementosTomados} / {listaParaMarcar.length}
                  </span>
                </div>
                <ul className="inicio-sups-list">
                  {listaParaMarcar.map((s) => {
                    const tomado = suplementosDelDia.includes(s.id)
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          className={`inicio-sups-item${tomado ? ' is-done' : ''}`}
                          onClick={() => toggleSuplementoDia(s.id)}
                        >
                          <span className="inicio-sups-check" aria-hidden>{tomado ? '✓' : ''}</span>
                          <span className="inicio-sups-name">{s.label}</span>
                          {tomado ? (
                            <span className="inicio-sups-ok" aria-hidden>✓</span>
                          ) : (
                            <span className="inicio-sups-pend">Pendiente</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {tipHoy && (
              <div className="box inicio-habit-card">
                <p className="inicio-habit-eyebrow mb-2">
                  Hábito de hoy
                  {tipHoy.tipo && LABEL_TIPO_CONSEJO[tipHoy.tipo]
                    ? ` · ${LABEL_TIPO_CONSEJO[tipHoy.tipo]}`
                    : ''}
                </p>
                <div className="inicio-habit-body">
                  <span className="inicio-habit-icon" aria-hidden>💡</span>
                  <p className="inicio-habit-text mb-0">{tipHoy.texto}</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {mesModalAbierto && (
        <div className="inicio-mes-modal" role="dialog" aria-modal="true" aria-label="Calendario mensual">
          <button type="button" className="inicio-mes-backdrop" aria-label="Cerrar" onClick={() => setMesModalAbierto(false)} />
          <div className="inicio-mes-panel box">
            <div className="inicio-mes-panel-head">
              <h2 className="title is-6 mb-0">Calendario</h2>
              <button type="button" className="delete" aria-label="Cerrar" onClick={() => setMesModalAbierto(false)} />
            </div>
            <div className="cal-mes-nav mb-3">
              <button
                type="button"
                className="button is-small is-light"
                onClick={() => {
                  const [y, m] = mesCalendario.split('-').map(Number)
                  const prev = new Date(y, m - 2, 1)
                  setMesCalendario(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`)
                }}
              >
                ←
              </button>
              <span className="is-size-6 has-text-weight-medium">
                {(() => {
                  const [y, m] = mesCalendario.split('-').map(Number)
                  return new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())
                })()}
              </span>
              <button
                type="button"
                className="button is-small is-light"
                onClick={() => {
                  const [y, m] = mesCalendario.split('-').map(Number)
                  const next = new Date(y, m, 1)
                  setMesCalendario(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
                }}
              >
                →
              </button>
            </div>
            <div className="app-calendar-grid">
              {DIAS_CORTO.map((d) => (
                <div key={d} className="app-calendar-weekday has-text-centered has-text-grey is-size-7">{d}</div>
              ))}
              {diasDelMes.map((celda, idx) => {
                if (celda.vacio) return <div key={`v-${idx}`} className="app-calendar-empty" />
                const sel = celda.fecha === diaEnVista
                const act = fechasConComida.has(celda.fecha) || fechasConEjercicio.has(celda.fecha)
                return (
                  <button
                    key={celda.fecha}
                    type="button"
                    className={`button is-small has-text-weight-semibold app-calendar-day ${sel ? 'is-link is-selected' : act ? 'has-activity' : 'is-light'}`}
                    onClick={() => {
                      seleccionarDia(celda.fecha)
                      setMesModalAbierto(false)
                    }}
                  >
                    <span>{celda.dia}</span>
                    {act && (
                      <span className="app-calendar-dots" aria-hidden>
                        {fechasConComida.has(celda.fecha) && <i className="dot-food" />}
                        {fechasConEjercicio.has(celda.fecha) && <i className="dot-ex" />}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
