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
