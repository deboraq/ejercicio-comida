/**
 * Celdas de un mes para mini-calendario (Lunes = primera columna).
 * @param {string} yearMonth YYYY-MM
 */
export function getDiasDelMes(yearMonth) {
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
