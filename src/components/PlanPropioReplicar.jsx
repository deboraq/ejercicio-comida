import { useMemo, useState } from 'react'
import { PLAN_MES1_TOTAL_DIAS } from '../utils/planMes1.js'
import {
  diaPlanTieneContenido,
  numerosSemanaPlan,
  replicarDiaPlanPropio,
  replicarSemanaPlanPropio,
  semanaDelDiaPlan,
} from '../utils/planPropio'

function confirmarSobrescrituraSimple(planPropio, diasDestino) {
  const ocupados = diasDestino.filter((d) => diaPlanTieneContenido(planPropio, d))
  if (!ocupados.length) return true
  return window.confirm(`Los días ${ocupados.join(', ')} ya tienen menú. ¿Reemplazarlos?`)
}

function listaDias(nums) {
  if (!nums.length) return '—'
  if (nums.length <= 4) return nums.join(', ')
  return `${nums.slice(0, 3).join(', ')}… ${nums[nums.length - 1]}`
}

/**
 * Copiar menú (colapsado por defecto, textos didácticos).
 */
export default function PlanPropioReplicar({ diaPlan, planPropio, setPlanPropio, semanaActiva }) {
  const semanaDia = semanaDelDiaPlan(diaPlan)
  const semanaUi = semanaActiva || semanaDia

  const diasSemanaActual = useMemo(() => numerosSemanaPlan(semanaUi), [semanaUi])
  const otrosDiasSemana = useMemo(
    () => diasSemanaActual.filter((d) => d !== diaPlan),
    [diasSemanaActual, diaPlan],
  )

  const [destinosExtra, setDestinosExtra] = useState(() => new Set())
  const [semanaOrigen, setSemanaOrigen] = useState(semanaUi)
  const [semanaDestino, setSemanaDestino] = useState(semanaUi >= 4 ? 3 : semanaUi + 1)

  const toggleDestino = (d) => {
    setDestinosExtra((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  const aplicarCopiaDia = (destinos, mensajeOk) => {
    const lista = [...new Set(destinos)].filter((d) => d !== diaPlan)
    if (!lista.length) {
      window.alert('No hay otros días para copiar.')
      return
    }
    if (!confirmarSobrescrituraSimple(planPropio, lista)) return
    setPlanPropio((prev) => replicarDiaPlanPropio(prev, diaPlan, lista))
    window.alert(mensajeOk || `Listo: menú del día ${diaPlan} copiado a los días ${lista.join(', ')}.`)
  }

  const copiarRestoSemana = () => {
    aplicarCopiaDia(
      otrosDiasSemana,
      `Listo: el menú del día ${diaPlan} se aplicó a los días ${listaDias(otrosDiasSemana)} (el día ${diaPlan} no cambia).`,
    )
  }

  const copiarTodaSemanaIgual = () => {
    aplicarCopiaDia(
      diasSemanaActual,
      `Listo: todos los días ${listaDias(diasSemanaActual)} de la semana ${semanaUi} quedaron iguales al menú del día ${diaPlan}.`,
    )
  }

  const copiarSemana = () => {
    if (semanaOrigen === semanaDestino) {
      window.alert('Elegí otra semana destino (distinta de la origen).')
      return
    }
    const src = numerosSemanaPlan(semanaOrigen)
    const dst = numerosSemanaPlan(semanaDestino)
    if (!confirmarSobrescrituraSimple(planPropio, dst)) return
    setPlanPropio((prev) => replicarSemanaPlanPropio(prev, semanaOrigen, semanaDestino))
    window.alert(
      `Listo: cada día de la semana ${semanaOrigen} (${listaDias(src)}) se copió al día equivalente de la semana ${semanaDestino} (${listaDias(dst)}). Ej.: día ${src[0]} → día ${dst[0]}.`,
    )
  }

  const diasParaElegir = useMemo(() => {
    const list = []
    for (let d = 1; d <= PLAN_MES1_TOTAL_DIAS; d += 1) {
      if (d !== diaPlan) list.push(d)
    }
    return list
  }, [diaPlan])

  const ejResto =
    otrosDiasSemana.length > 0
      ? `Ejemplo: copiás el menú del día ${diaPlan} a los días ${listaDias(otrosDiasSemana)}.`
      : 'En este día no hay más días en la semana.'

  const srcSem = numerosSemanaPlan(semanaOrigen)
  const dstSem = numerosSemanaPlan(semanaDestino)

  return (
    <details className="plan-propio-replicar">
      <summary className="plan-propio-replicar-summary">
        ¿Querés repetir este menú en otros días? (opcional)
      </summary>

      <div className="plan-propio-replicar-body">
        <p className="plan-propio-replicar-intro mb-0">
          <strong>Origen:</strong> lo que cargás abajo en <strong>Día {diaPlan}</strong> (desayuno, almuerzo, etc.).
          Los botones <em>no mueven</em> comidas sueltas: copian el menú entero de ese día a otros días del plan de
          30.
        </p>

        <article className="plan-propio-replicar-card">
          <h5 className="plan-propio-replicar-card-title">Opción A — Mismo menú en la semana</h5>
          <p className="plan-propio-replicar-card-text mb-0">
            <strong>Solo los otros días de la semana {semanaUi}.</strong> El día {diaPlan} queda como está. {ejResto}
          </p>
          <button
            type="button"
            className="plan-propio-replicar-btn plan-propio-replicar-btn--primary"
            onClick={copiarRestoSemana}
            disabled={!otrosDiasSemana.length}
          >
            Copiar día {diaPlan} → días {listaDias(otrosDiasSemana) || '—'}
          </button>

          <p className="plan-propio-replicar-card-text plan-propio-replicar-card-text--sep mb-0">
            <strong>Toda la semana {semanaUi} igual.</strong> Todos los días ({listaDias(diasSemanaActual)}) pasan a
            tener el mismo menú que el día {diaPlan}.
          </p>
          <button type="button" className="plan-propio-replicar-btn" onClick={copiarTodaSemanaIgual}>
            Igualar semana {semanaUi} al día {diaPlan}
          </button>
        </article>

        <article className="plan-propio-replicar-card">
          <h5 className="plan-propio-replicar-card-title">Opción B — Copiar una semana a otra</h5>
          <p className="plan-propio-replicar-card-text mb-0">
            Copiás <strong>día por día</strong>, no el menú de un solo día a toda la semana destino. El menú del día{' '}
            {srcSem[0] ?? '—'} de la semana {semanaOrigen} va al día {dstSem[0] ?? '—'} de la semana {semanaDestino},
            el día {srcSem[1] ?? '—'} al {dstSem[1] ?? '—'}, y así.
          </p>
          <div className="plan-propio-replicar-semanas">
            <label>
              <span>Semana origen</span>
              <select value={semanaOrigen} onChange={(e) => setSemanaOrigen(Number(e.target.value))}>
                {[1, 2, 3, 4].map((s) => (
                  <option key={s} value={s}>
                    Semana {s} (días {listaDias(numerosSemanaPlan(s))})
                  </option>
                ))}
              </select>
            </label>
            <span className="plan-propio-replicar-arrow" aria-hidden>
              →
            </span>
            <label>
              <span>Semana destino</span>
              <select value={semanaDestino} onChange={(e) => setSemanaDestino(Number(e.target.value))}>
                {[1, 2, 3, 4].map((s) => (
                  <option key={s} value={s}>
                    Semana {s} (días {listaDias(numerosSemanaPlan(s))})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="plan-propio-replicar-btn plan-propio-replicar-btn--primary" onClick={copiarSemana}>
              Copiar semana {semanaOrigen} sobre semana {semanaDestino}
            </button>
          </div>
        </article>

        <details className="plan-propio-replicar-advanced">
          <summary>Opción C — Elegir días sueltos (1–{PLAN_MES1_TOTAL_DIAS})</summary>
          <p className="plan-propio-replicar-hint mb-0">
            Marcá a qué días querés llevar el menú del día {diaPlan}.
          </p>
          <div className="plan-propio-replicar-dias">
            {diasParaElegir.map((d) => (
              <label key={d} className="plan-propio-replicar-dia-chip">
                <input type="checkbox" checked={destinosExtra.has(d)} onChange={() => toggleDestino(d)} />
                <span>Día {d}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            className="plan-propio-replicar-btn plan-propio-replicar-btn--primary"
            onClick={() =>
              aplicarCopiaDia(
                [...destinosExtra],
                `Listo: menú del día ${diaPlan} copiado a ${destinosExtra.size} día(s) marcados.`,
              )
            }
            disabled={destinosExtra.size === 0}
          >
            Copiar a días marcados ({destinosExtra.size})
          </button>
        </details>
      </div>
    </details>
  )
}
