import { fechaToISO } from './calorias.js'

let xlsxPromise = null

function loadXlsx() {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx').then((mod) => mod.default || mod)
  }
  return xlsxPromise
}

function csvEscape(val) {
  const s = val == null ? '' : String(val)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function descargarBlob(nombreArchivo, contenido, tipoMime) {
  const blob = new Blob([contenido], { type: tipoMime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

export function descargarJson(nombreBase, data) {
  const fecha = fechaToISO(new Date())
  descargarBlob(
    `${nombreBase}-${fecha}.json`,
    JSON.stringify(data, null, 2),
    'application/json;charset=utf-8',
  )
}

export function descargarCsv(nombreBase, columnas, filas) {
  const header = columnas.map((c) => csvEscape(c.label)).join(',')
  const body = filas
    .map((fila) => columnas.map((c) => csvEscape(fila[c.key])).join(','))
    .join('\n')
  const fecha = fechaToISO(new Date())
  descargarBlob(`${nombreBase}-${fecha}.csv`, `\uFEFF${header}\n${body}`, 'text/csv;charset=utf-8')
}

function filasTabulares(columnas, filas) {
  const header = columnas.map((c) => c.label)
  const body = filas.map((fila) => columnas.map((c) => {
    const val = fila[c.key]
    return val == null ? '' : val
  }))
  return [header, ...body]
}

export async function descargarExcel(nombreBase, columnas, filas, nombreHoja = 'Datos') {
  const XLSX = await loadXlsx()
  const fecha = fechaToISO(new Date())
  const sheet = XLSX.utils.aoa_to_sheet(filasTabulares(columnas, filas))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, nombreHoja.slice(0, 31))
  const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
  descargarBlob(
    `${nombreBase}-${fecha}.xlsx`,
    buffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
}

const COLUMNAS_COMIDA = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'comida', label: 'Momento' },
  { key: 'hora', label: 'Hora' },
  { key: 'descripcion', label: 'Alimento' },
  { key: 'calorias', label: 'Calorías' },
  { key: 'proteinas', label: 'Proteínas (g)' },
  { key: 'carbohidratos', label: 'Carbohidratos (g)' },
  { key: 'grasas', label: 'Grasas (g)' },
  { key: 'porciones', label: 'Porciones' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'notas', label: 'Notas' },
]

const COLUMNAS_GYM = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'ejercicio', label: 'Ejercicio' },
  { key: 'pesoKg', label: 'Peso (kg)' },
  { key: 'repeticiones', label: 'Repeticiones' },
  { key: 'series', label: 'Series planificadas' },
  { key: 'serieNum', label: 'Nº serie' },
  { key: 'rpe', label: 'RPE' },
  { key: 'kcalManual', label: 'Kcal' },
  { key: 'notas', label: 'Notas' },
  { key: 'rutinaId', label: 'ID rutina' },
  { key: 'diaRutinaId', label: 'ID día' },
]

const COLUMNAS_ACTIVIDAD = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'nombre', label: 'Actividad' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'duracion', label: 'Duración (min)' },
  { key: 'distanciaKm', label: 'Distancia (km)' },
  { key: 'caloriasManual', label: 'Calorías' },
  { key: 'notas', label: 'Notas' },
]

function ordenarPorFechaDesc(a, b) {
  return String(b.fecha || '').localeCompare(String(a.fecha || ''))
}

export function exportarComidasJson(comidas = []) {
  const lista = [...comidas].sort(ordenarPorFechaDesc)
  descargarJson('comidas', lista)
  return lista.length
}

export function exportarComidasCsv(comidas = []) {
  const lista = [...comidas].sort(ordenarPorFechaDesc)
  descargarCsv('comidas', COLUMNAS_COMIDA, lista)
  return lista.length
}

export async function exportarComidasExcel(comidas = []) {
  const lista = [...comidas].sort(ordenarPorFechaDesc)
  await descargarExcel('comidas', COLUMNAS_COMIDA, lista, 'Comidas')
  return lista.length
}

export function exportarGymJson(registros = [], rutinas = [], rutinaActivaId = null) {
  const series = [...registros].sort(ordenarPorFechaDesc)
  descargarJson('gym-entrenamientos', {
    exportadoEl: fechaToISO(new Date()),
    rutinaActivaId,
    rutinas,
    series,
  })
  return series.length
}

export function exportarGymCsv(registros = []) {
  const lista = [...registros].sort(ordenarPorFechaDesc)
  descargarCsv('gym-entrenamientos', COLUMNAS_GYM, lista)
  return lista.length
}

export async function exportarGymExcel(registros = []) {
  const lista = [...registros].sort(ordenarPorFechaDesc)
  await descargarExcel('gym-entrenamientos', COLUMNAS_GYM, lista, 'Gimnasio')
  return lista.length
}

export function exportarEjerciciosActividadJson(ejercicios = []) {
  const lista = [...ejercicios].sort(ordenarPorFechaDesc)
  descargarJson('ejercicios-actividad', lista)
  return lista.length
}

export function exportarEjerciciosActividadCsv(ejercicios = []) {
  const lista = [...ejercicios].sort(ordenarPorFechaDesc)
  descargarCsv('ejercicios-actividad', COLUMNAS_ACTIVIDAD, lista)
  return lista.length
}

export async function exportarEjerciciosActividadExcel(ejercicios = []) {
  const lista = [...ejercicios].sort(ordenarPorFechaDesc)
  await descargarExcel('ejercicios-actividad', COLUMNAS_ACTIVIDAD, lista, 'Actividad')
  return lista.length
}

const COLUMNAS_RUTINA_PLAN = [
  { key: 'rutinaId', label: 'ID rutina' },
  { key: 'rutinaNombre', label: 'Rutina' },
  { key: 'diaId', label: 'ID día' },
  { key: 'diaNombre', label: 'Día' },
  { key: 'ejercicio', label: 'Ejercicio' },
  { key: 'series', label: 'Series' },
  { key: 'reps', label: 'Reps' },
  { key: 'grupoMuscular', label: 'Grupo muscular' },
]

function filasRutinasPlan(rutinas = []) {
  const filas = []
  for (const r of rutinas || []) {
    const rid = r.id || ''
    const rn = r.nombre || ''
    for (const d of r.dias || []) {
      const did = d.id || ''
      const dn = d.nombre || ''
      for (const ej of d.ejercicios || []) {
        if (typeof ej === 'string') {
          filas.push({
            rutinaId: rid,
            rutinaNombre: rn,
            diaId: did,
            diaNombre: dn,
            ejercicio: ej,
            series: '',
            reps: '',
            grupoMuscular: '',
          })
          continue
        }
        filas.push({
          rutinaId: rid,
          rutinaNombre: rn,
          diaId: did,
          diaNombre: dn,
          ejercicio: ej.nombre || ej.ejercicio || '',
          series: ej.series ?? '',
          reps: ej.repeticiones ?? ej.reps ?? '',
          grupoMuscular: ej.grupoMuscular ?? '',
        })
      }
    }
  }
  return filas
}

async function descargarExcelMulti(nombreBase, hojas = []) {
  const XLSX = await loadXlsx()
  const fecha = fechaToISO(new Date())
  const book = XLSX.utils.book_new()
  for (const h of hojas) {
    const sheet = XLSX.utils.aoa_to_sheet(filasTabulares(h.columnas, h.filas))
    XLSX.utils.book_append_sheet(book, sheet, h.nombreHoja.slice(0, 31))
  }
  const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
  descargarBlob(
    `${nombreBase}-${fecha}.xlsx`,
    buffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
}

/** Respaldo completo en un solo JSON (comidas, gym, actividad y plan). */
export function exportarTodoJson(bundle = {}) {
  const payload = {
    exportadoEl: fechaToISO(new Date()),
    comidas: [...(bundle.comidas || [])].sort(ordenarPorFechaDesc),
    rutinaPesos: [...(bundle.rutinaPesos || [])].sort(ordenarPorFechaDesc),
    ejerciciosActividad: [...(bundle.ejerciciosActividad || [])].sort(ordenarPorFechaDesc),
    rutinas: bundle.rutinas || [],
    rutinaActivaId: bundle.rutinaActivaId || null,
  }
  descargarJson('mi-rutina-backup', payload)
  return (
    payload.comidas.length
    + payload.rutinaPesos.length
    + payload.ejerciciosActividad.length
  )
}

/** Excel con una hoja por categoría (y plan de rutinas si hay). */
export async function exportarTodoExcel(bundle = {}) {
  const comidas = [...(bundle.comidas || [])].sort(ordenarPorFechaDesc)
  const gym = [...(bundle.rutinaPesos || [])].sort(ordenarPorFechaDesc)
  const actividad = [...(bundle.ejerciciosActividad || [])].sort(ordenarPorFechaDesc)
  const plan = filasRutinasPlan(bundle.rutinas)
  const hojas = []
  if (comidas.length) hojas.push({ nombreHoja: 'Comidas', columnas: COLUMNAS_COMIDA, filas: comidas })
  if (gym.length) hojas.push({ nombreHoja: 'Gimnasio', columnas: COLUMNAS_GYM, filas: gym })
  if (actividad.length) hojas.push({ nombreHoja: 'Actividad', columnas: COLUMNAS_ACTIVIDAD, filas: actividad })
  if (plan.length) hojas.push({ nombreHoja: 'Plan rutinas', columnas: COLUMNAS_RUTINA_PLAN, filas: plan })
  if (hojas.length === 0) return 0
  await descargarExcelMulti('mi-rutina-completo', hojas)
  return comidas.length + gym.length + actividad.length
}
