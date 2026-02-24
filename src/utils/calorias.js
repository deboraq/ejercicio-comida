// MET (equivalente metabólico) por actividad — basado en compendios de actividad física (ej. Ainsworth)
// Fórmula: calorías = MET * peso_kg * (duracion_min / 60)

// Tipos agrupados para el selector (value = clave para MET)
export const TIPOS_EJERCICIO_AGRUPADOS = [
  {
    categoria: 'Cardio / Aeróbico',
    opciones: [
      { value: 'caminata_lenta', label: 'Caminata lenta (pasear)' },
      { value: 'caminata_rapida', label: 'Caminata rápida' },
      { value: 'correr_8', label: 'Correr (8 km/h aprox.)' },
      { value: 'correr_10', label: 'Correr (10 km/h aprox.)' },
      { value: 'correr_12', label: 'Correr (12+ km/h)' },
      { value: 'bici_estatica_ligera', label: 'Bicicleta estática (ligera)' },
      { value: 'bici_estatica_moderada', label: 'Bicicleta estática (moderada)' },
      { value: 'bici_estatica_intensa', label: 'Bicicleta estática (intensa)' },
      { value: 'bici_aire_paseo', label: 'Bicicleta al aire libre (paseo)' },
      { value: 'bici_aire_intensa', label: 'Bicicleta al aire libre (intensa)' },
      { value: 'nadar_suave', label: 'Nadar (suave)' },
      { value: 'nadar_moderado', label: 'Nadar (moderado)' },
      { value: 'nadar_intenso', label: 'Nadar (intenso)' },
      { value: 'eliptica', label: 'Elíptica' },
      { value: 'escaladora', label: 'Escaladora' },
      { value: 'saltar_cuerda', label: 'Saltar la cuerda' },
      { value: 'escaleras', label: 'Subir escaleras' },
      { value: 'hiit', label: 'HIIT / Entrenamiento por intervalos' },
      { value: 'patinar', label: 'Patinar / rollers' },
      { value: 'remo', label: 'Remo (máquina)' },
    ],
  },
  {
    categoria: 'Fuerza',
    opciones: [
      { value: 'pesas_general', label: 'Pesas / musculación (general)' },
      { value: 'pesas_intenso', label: 'Pesas (intenso)' },
      { value: 'crossfit', label: 'CrossFit' },
      { value: 'peso_corporal', label: 'Peso corporal (flexiones, sentadillas...)' },
      { value: 'funcional', label: 'Entrenamiento funcional' },
    ],
  },
  {
    categoria: 'Flexibilidad / Mente-cuerpo',
    opciones: [
      { value: 'estiramiento', label: 'Estiramiento' },
      { value: 'yoga_suave', label: 'Yoga (suave)' },
      { value: 'yoga_moderado', label: 'Yoga (moderado)' },
      { value: 'pilates', label: 'Pilates' },
    ],
  },
  {
    categoria: 'Deportes',
    opciones: [
      { value: 'futbol', label: 'Fútbol' },
      { value: 'tenis_singles', label: 'Tenis (singles)' },
      { value: 'tenis_dobles', label: 'Tenis (dobles)' },
      { value: 'baloncesto', label: 'Baloncesto' },
      { value: 'voleibol', label: 'Vóley' },
      { value: 'padel', label: 'Pádel' },
      { value: 'rugby', label: 'Rugby / fútbol americano' },
      { value: 'artes_marciales', label: 'Artes marciales / boxeo' },
    ],
  },
  {
    categoria: 'Otro',
    opciones: [
      { value: 'otro', label: 'Otro (no especificado)' },
    ],
  },
]

// MET por valor (clave del selector). Compatible con datos antiguos que usaban "Cardio", "Fuerza", etc.
export const MET_POR_TIPO = {
  // Cardio
  caminata_lenta: 2.5,
  caminata_rapida: 5,
  correr_8: 8,
  correr_10: 10,
  correr_12: 12.5,
  bici_estatica_ligera: 4,
  bici_estatica_moderada: 6,
  bici_estatica_intensa: 8,
  bici_aire_paseo: 4,
  bici_aire_intensa: 10,
  nadar_suave: 6,
  nadar_moderado: 8,
  nadar_intenso: 10,
  eliptica: 6,
  escaladora: 9,
  saltar_cuerda: 11,
  escaleras: 9,
  hiit: 8,
  patinar: 7,
  remo: 7,
  // Fuerza
  pesas_general: 5,
  pesas_intenso: 6,
  crossfit: 8,
  peso_corporal: 4,
  funcional: 5,
  // Flexibilidad
  estiramiento: 2.5,
  yoga_suave: 2.5,
  yoga_moderado: 3,
  pilates: 3.5,
  // Deportes
  futbol: 7,
  tenis_singles: 8,
  tenis_dobles: 6,
  baloncesto: 6,
  voleibol: 4,
  padel: 6,
  rugby: 8,
  artes_marciales: 8,
  // Otro + compatibilidad con datos antiguos
  otro: 5,
  Cardio: 8,
  Fuerza: 5,
  Flexibilidad: 3,
  Deportes: 7,
}

const PESO_DEFAULT_KG = 70

export function caloriasQuemadas(tipo, duracionMin, pesoKg = PESO_DEFAULT_KG) {
  const met = MET_POR_TIPO[tipo] ?? 5
  return Math.round(met * pesoKg * (Number(duracionMin) / 60))
}

// Etiqueta legible para mostrar en historial (datos antiguos pueden tener "Cardio", nuevos tienen "caminata_rapida")
export function etiquetaTipo(tipo) {
  if (!tipo) return 'Otro'
  for (const g of TIPOS_EJERCICIO_AGRUPADOS) {
    const op = g.opciones.find((o) => o.value === tipo)
    if (op) return op.label
  }
  return tipo
}

// Categoría del tipo (para consejos: Cardio, Fuerza, Flexibilidad, Deportes, Otro)
const CATEGORIA_PARA_CONSEJOS = {
  'Cardio / Aeróbico': 'Cardio',
  'Fuerza': 'Fuerza',
  'Flexibilidad / Mente-cuerpo': 'Flexibilidad',
  'Deportes': 'Deportes',
  'Otro': 'Otro',
}
export function getCategoriaTipo(tipo) {
  if (!tipo) return 'Otro'
  for (const g of TIPOS_EJERCICIO_AGRUPADOS) {
    if (g.opciones.some((o) => o.value === tipo)) {
      return CATEGORIA_PARA_CONSEJOS[g.categoria] || g.categoria
    }
  }
  if (['Cardio', 'Fuerza', 'Flexibilidad', 'Deportes', 'Otro'].includes(tipo)) return tipo
  return 'Otro'
}

export function formatearFecha(iso) {
  const hoy = new Date()
  const ayer = new Date(hoy)
  ayer.setDate(ayer.getDate() - 1)
  if (iso === hoy.toISOString().slice(0, 10)) return 'Hoy'
  if (iso === ayer.toISOString().slice(0, 10)) return 'Ayer'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function fechaToISO(date) {
  return date.toISOString().slice(0, 10)
}

export function restarDias(iso, dias) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() - dias)
  return fechaToISO(d)
}
