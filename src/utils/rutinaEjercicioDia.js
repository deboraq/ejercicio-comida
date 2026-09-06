/**
 * Cada ítem de día puede ser string (legacy) u objeto
 * { nombre, series?, repeticiones?, superserie?, descansoPostRonda?, grupoMuscular?, carga?, notas? }.
 * Los registros y la UI de alumno usan el nombre (string) como clave lógica.
 */
export function nombreDeEjercicioDiaItem(ex) {
  if (ex == null) return ''
  if (typeof ex === 'string') return ex.trim()
  if (typeof ex === 'object' && ex.nombre != null) return String(ex.nombre).trim()
  return String(ex).trim()
}

/** Quita prefijos tipo "1- " / "0." del nombre para display limpio. */
export function nombreDisplayPlan(nombre) {
  return String(nombre || '')
    .replace(/^\s*\d+\s*[-–.)]\s*/, '')
    .trim() || String(nombre || '')
}

/** Normaliza nombre para comparar plan vs registros (prefijos, superserie, acentos). */
export function normalizarNombreEjercicio(nombre) {
  return String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\s*\d+\s*[-–.)]\s*/, '')
    .replace(/superseriado con:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True si dos nombres de ejercicio apuntan al mismo movimiento. */
export function nombresEjercicioCoinciden(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  const na = normalizarNombreEjercicio(a)
  const nb = normalizarNombreEjercicio(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.length >= 12 && nb.length >= 12 && (na.includes(nb) || nb.includes(na))) return true
  return false
}

export function itemEjercicioDiaNormalizado(ex) {
  const nombre = nombreDeEjercicioDiaItem(ex)
  if (!nombre) return null
  if (typeof ex === 'string') {
    return {
      nombre,
      series: '',
      repeticiones: '',
      superserie: '',
      descansoPostRonda: '',
      grupoMuscular: '',
      carga: '',
      notas: '',
    }
  }
  return {
    nombre,
    series: ex.series != null ? String(ex.series) : '',
    repeticiones: ex.repeticiones != null ? String(ex.repeticiones) : '',
    superserie: ex.superserie != null ? String(ex.superserie).trim() : '',
    descansoPostRonda: ex.descansoPostRonda != null ? String(ex.descansoPostRonda) : '',
    grupoMuscular: ex.grupoMuscular != null ? String(ex.grupoMuscular).trim() : '',
    carga: ex.carga != null ? String(ex.carga).trim() : (ex.pesoKg != null ? String(ex.pesoKg).trim() : ''),
    notas: ex.notas != null ? String(ex.notas).trim() : '',
  }
}

export function etiquetaPlanEjercicio(ex) {
  const it = itemEjercicioDiaNormalizado(ex)
  if (!it) return '—'
  const s = it.series?.trim()
  const r = it.repeticiones?.trim()
  if (s && r) return `${it.nombre} · ${s}×${r}`
  if (s) return `${it.nombre} · ${s} series`
  if (r) return `${it.nombre} · ${r} reps`
  return it.nombre
}

export function nombresEjerciciosDia(dia) {
  return (dia?.ejercicios || []).map(nombreDeEjercicioDiaItem).filter(Boolean)
}

/** Para JSON mínimo y payload en Supabase */
export function ejercicioDiaAJson(e) {
  const it = itemEjercicioDiaNormalizado(e)
  if (!it) return null
  const o = { nombre: it.nombre }
  if (it.series.trim()) o.series = it.series.trim()
  if (it.repeticiones.trim()) o.repeticiones = it.repeticiones.trim()
  if (it.superserie) o.superserie = it.superserie
  if (it.descansoPostRonda.trim()) o.descansoPostRonda = it.descansoPostRonda.trim()
  if (it.grupoMuscular) o.grupoMuscular = it.grupoMuscular
  if (it.carga.trim()) o.carga = it.carga.trim()
  if (it.notas.trim()) o.notas = it.notas.trim()
  if (Object.keys(o).length === 1) return o.nombre
  return o
}

export const MUSCLE_KEYWORDS = [
  { key: 'Calentamiento', re: /bici|el[ií]ptic[oa]|cinta|cardio|calentamiento|spinning|movilidad/i },
  { key: 'Espalda', re: /espalda|jal[oó]n|dominada|pull.?up|dorsal|deadlift|peso muerto|face\s*pull|(?:^|[^a-záéíóú])remo(?:\s|$| con| unilateral)/i },
  { key: 'Pecho', re: /pecho|press banca|bench|aperturas|push.?up|pectoral|fondos en paralelas/i },
  { key: 'Piernas', re: /sentadilla|squat|prensa|femoral|cu[aá]driceps|gemelo|zancada|hip thrust|gl[uú]teo|goblet/i },
  { key: 'Hombros', re: /hombro|militar|elevaci[oó]n(?:es)?\s*lateral(?:es)?|delto|desarrollo|encogimiento|face\s*pull/i },
  { key: 'Bíceps', re: /b[ií]ceps|curl(?!\s*femoral)/i },
  { key: 'Tríceps', re: /tr[ií]ceps|extensi[oó]n(?!\s*de\s*cu[aá])|press franc[eé]s|fondos(?!\s*en\s*paralelas)/i },
  { key: 'Core', re: /abdomen|core|plancha|crunch|piernas? elev/i },
]

export const FILTROS_BIBLIOTECA = [
  { id: 'Todos', label: 'Todos' },
  { id: 'Espalda', label: 'Espalda' },
  { id: 'Pecho', label: 'Pecho' },
  { id: 'Piernas', label: 'Piernas' },
  { id: 'Brazos', label: 'Brazos' },
  { id: 'Hombros', label: 'Hombros' },
  { id: 'Core', label: 'Core' },
  { id: 'Cardio', label: 'Cardio' },
]

/** Infiera un grupo muscular a partir del nombre (o del campo explícito). */
export function inferirGrupoMuscular(nombreOItem) {
  const it = typeof nombreOItem === 'object' ? itemEjercicioDiaNormalizado(nombreOItem) : null
  if (it?.grupoMuscular) return it.grupoMuscular
  const nombre = it?.nombre || String(nombreOItem || '')
  for (const m of MUSCLE_KEYWORDS) {
    if (m.re.test(nombre)) return m.key
  }
  return 'Otro'
}

export function esCalentamientoPlan(nombreOItem) {
  const g = inferirGrupoMuscular(nombreOItem)
  return g === 'Calentamiento'
}

/** Infiera etiqueta de grupos musculares del día a partir de los nombres. */
export function inferirGruposMuscularesDia(ejercicios = []) {
  const hits = new Set()
  for (const ex of ejercicios) {
    const it = itemEjercicioDiaNormalizado(ex)
    if (!it) continue
    const g = inferirGrupoMuscular(it)
    if (g === 'Calentamiento') {
      hits.add('Calentamiento')
      continue
    }
    if (g && g !== 'Otro') hits.add(g)
  }
  const arr = [...hits].filter((h) => h !== 'Calentamiento')
  if (arr.length === 0) {
    return hits.has('Calentamiento') ? 'Calentamiento' : ''
  }
  if (arr.length === 1) return arr[0]
  return arr.slice(0, 2).join(' & ')
}

/**
 * Agrupa ejercicios del plan: bloques normales y superseries.
 * Items con el mismo `superserie` consecutivos forman un bloque.
 * Incluye `startIdx` para mapear al índice en el array del día.
 */
export function agruparPlanEnBloques(ejercicios = []) {
  const items = ejercicios.map(itemEjercicioDiaNormalizado).filter(Boolean)
  const bloques = []
  let i = 0
  while (i < items.length) {
    const cur = items[i]
    if (cur.superserie) {
      const key = cur.superserie
      const group = [cur]
      const indices = [i]
      let j = i + 1
      while (j < items.length && items[j].superserie === key) {
        group.push(items[j])
        indices.push(j)
        j += 1
      }
      bloques.push({
        tipo: 'superserie',
        id: `ss-${key}-${i}`,
        label: key,
        descansoPostRonda: group.find((g) => g.descansoPostRonda)?.descansoPostRonda || '90',
        items: group,
        indices,
        startIdx: i,
      })
      i = j
    } else {
      bloques.push({
        tipo: 'simple',
        id: `ex-${i}-${cur.nombre}`,
        items: [cur],
        indices: [i],
        startIdx: i,
      })
      i += 1
    }
  }
  return bloques
}

export function parseNumSeriesPlan(seriesStr, fallback = 3) {
  const n = parseInt(String(seriesStr || '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : fallback
}

/**
 * Series efectivas de un ítem del plan.
 * Usa el campo `series`, o lo infiere del nombre ("4 series × 8", "3 x 10"),
 * o 3 por defecto en fuerza / 1 en calentamiento.
 */
export function seriesEfectivasDeItem(itOrEx) {
  const it = itemEjercicioDiaNormalizado(itOrEx)
  if (!it) return 0
  if (esCalentamientoPlan(it)) return 1
  if (it.series?.trim()) return parseNumSeriesPlan(it.series, 3)
  const nombre = String(it.nombre || '')
  const m =
    nombre.match(/(\d+)\s*series?\b/i) ||
    nombre.match(/\b(\d+)\s*[x×]\s*\d/i) ||
    nombre.match(/:\s*(\d+)\s*[x×]/i)
  if (m) {
    const n = parseInt(m[1], 10)
    if (Number.isFinite(n) && n > 0) return Math.min(n, 12)
  }
  return 3
}

/** Extrae un kg promedio aproximado de strings tipo "25-30" / "12.5 kg". */
export function parseCargaMediaKg(cargaStr) {
  const s = String(cargaStr || '')
  const nums = [...s.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) => Number(String(m[1]).replace(',', '.')))
  if (!nums.length) return 0
  const valid = nums.filter((n) => Number.isFinite(n) && n > 0)
  if (!valid.length) return 0
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

/**
 * Resumen KPI + distribución muscular del día (series por grupo).
 */
export function resumenPlanDia(ejercicios = []) {
  const items = ejercicios.map(itemEjercicioDiaNormalizado).filter(Boolean)
  let seriesTotales = 0
  let volumenKg = 0
  let superseries = 0
  const porGrupo = {}
  const vistosSs = new Set()

  for (const it of items) {
    const effective = seriesEfectivasDeItem(it)
    seriesTotales += effective
    const g = inferirGrupoMuscular(it)
    const key = g === 'Calentamiento' ? 'Core & Calentamiento' : g
    porGrupo[key] = (porGrupo[key] || 0) + effective
    const cargaTexto = it.carga || (String(it.nombre).match(/peso:\s*([^).]+)/i)?.[1] || '')
    const carga = parseCargaMediaKg(cargaTexto)
    if (carga > 0 && effective > 0) {
      const repsApprox =
        parseInt(String(it.repeticiones || '').match(/\d+/)?.[0] || '', 10) ||
        parseInt(String(it.nombre).match(/(\d+)\s*(?:a\s*\d+\s*)?reps?/i)?.[1] || '8', 10) ||
        8
      volumenKg += carga * repsApprox * effective
    }
    if (it.superserie && !vistosSs.has(it.superserie)) {
      vistosSs.add(it.superserie)
      superseries += 1
    }
  }

  const tiempoMin = Math.max(15, Math.round(seriesTotales * 2.8 + items.length * 1.2))
  const dist = Object.entries(porGrupo)
    .filter(([, n]) => n > 0)
    .map(([grupo, series]) => ({
      grupo,
      series,
      pct: seriesTotales > 0 ? Math.round((series / seriesTotales) * 100) : 0,
    }))
    .sort((a, b) => b.series - a.series)

  return {
    totalEjercicios: items.length,
    seriesEfectivas: seriesTotales,
    tiempoMin,
    volumenKg,
    superseries,
    distribucion: dist,
  }
}

/** Siguiente etiqueta de superserie libre (A, B, C…). */
export function siguienteLabelSuperserie(ejercicios = []) {
  const usados = new Set(
    ejercicios
      .map(itemEjercicioDiaNormalizado)
      .filter((it) => it?.superserie)
      .map((it) => it.superserie.toUpperCase())
  )
  for (let i = 0; i < 26; i += 1) {
    const L = String.fromCharCode(65 + i)
    if (!usados.has(L)) return L
  }
  return `SS${Date.now() % 1000}`
}

/** ¿El filtro de biblioteca coincide con el ejercicio? */
export function matchFiltroBiblioteca(nombre, filtroId) {
  if (!filtroId || filtroId === 'Todos') return true
  const g = inferirGrupoMuscular(nombre)
  if (filtroId === 'Brazos') return g === 'Bíceps' || g === 'Tríceps'
  if (filtroId === 'Cardio') return g === 'Calentamiento'
  return g === filtroId
}
