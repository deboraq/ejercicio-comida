/**
 * Cada ítem de día puede ser string (legacy) u objeto
 * { nombre, series?, repeticiones?, superserie?, descansoPostRonda?, grupoMuscular? }.
 * Los registros y la UI de alumno usan el nombre (string) como clave lógica.
 */
export function nombreDeEjercicioDiaItem(ex) {
  if (ex == null) return ''
  if (typeof ex === 'string') return ex.trim()
  if (typeof ex === 'object' && ex.nombre != null) return String(ex.nombre).trim()
  return String(ex).trim()
}

export function itemEjercicioDiaNormalizado(ex) {
  const nombre = nombreDeEjercicioDiaItem(ex)
  if (!nombre) return null
  if (typeof ex === 'string') {
    return { nombre, series: '', repeticiones: '', superserie: '', descansoPostRonda: '', grupoMuscular: '' }
  }
  return {
    nombre,
    series: ex.series != null ? String(ex.series) : '',
    repeticiones: ex.repeticiones != null ? String(ex.repeticiones) : '',
    superserie: ex.superserie != null ? String(ex.superserie).trim() : '',
    descansoPostRonda: ex.descansoPostRonda != null ? String(ex.descansoPostRonda) : '',
    grupoMuscular: ex.grupoMuscular != null ? String(ex.grupoMuscular).trim() : '',
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
  if (Object.keys(o).length === 1) return o.nombre
  return o
}

const MUSCLE_KEYWORDS = [
  { key: 'Calentamiento', re: /bici|el[ií]ptic[oa]|cinta|cardio|calentamiento|spinning|movilidad/i },
  { key: 'Pecho', re: /pecho|press banca|bench|aperturas|push.?up|pectoral/i },
  { key: 'Espalda', re: /espalda|jal[oó]n|dominada|pull.?up|dorsal|deadlift|peso muerto|(?:^|[^a-záéíóú])remo(?:\s|$| con)/i },
  { key: 'Hombros', re: /hombro|militar|elevaci[oó]n\s*lateral|delto/i },
  { key: 'Piernas', re: /sentadilla|squat|prensa|femoral|cu[aá]driceps|gemelo|zancada|hip thrust|gl[uú]teo/i },
  { key: 'Bíceps', re: /b[ií]ceps|curl/i },
  { key: 'Tríceps', re: /tr[ií]ceps|extensi[oó]n/i },
  { key: 'Core', re: /abdomen|core|plancha|crunch|piernas? elev/i },
]

/** Infiera etiqueta de grupos musculares del día a partir de los nombres. */
export function inferirGruposMuscularesDia(ejercicios = []) {
  const hits = new Set()
  for (const ex of ejercicios) {
    const it = itemEjercicioDiaNormalizado(ex)
    if (!it) continue
    if (it.grupoMuscular) {
      hits.add(it.grupoMuscular)
      continue
    }
    const nombre = it.nombre
    // Si es calentamiento/cardio, no mezclar con otros grupos del mismo ítem
    if (/bici|el[ií]ptica|cinta|cardio|calentamiento|spinning/i.test(nombre)) {
      hits.add('Calentamiento')
      continue
    }
    for (const m of MUSCLE_KEYWORDS) {
      if (m.key === 'Calentamiento') continue
      if (m.re.test(nombre)) hits.add(m.key)
    }
  }
  const arr = [...hits]
  if (arr.length === 0) return ''
  if (arr.length === 1) return arr[0]
  return arr.slice(0, 2).join(' & ')
}

/**
 * Agrupa ejercicios del plan: bloques normales y superseries.
 * Items con el mismo `superserie` consecutivos forman un bloque.
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
      let j = i + 1
      while (j < items.length && items[j].superserie === key) {
        group.push(items[j])
        j += 1
      }
      bloques.push({
        tipo: 'superserie',
        id: `ss-${key}-${i}`,
        label: key,
        descansoPostRonda: group.find((g) => g.descansoPostRonda)?.descansoPostRonda || '90',
        items: group,
      })
      i = j
    } else {
      bloques.push({ tipo: 'simple', id: `ex-${i}-${cur.nombre}`, items: [cur] })
      i += 1
    }
  }
  return bloques
}

export function parseNumSeriesPlan(seriesStr, fallback = 3) {
  const n = parseInt(String(seriesStr || '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : fallback
}
