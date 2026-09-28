export const OBJETIVOS = [
  { value: 'bajar_peso', label: 'Bajar de peso', icon: '📉' },
  { value: 'mantener_peso', label: 'Mantener peso', icon: '⚖️' },
  { value: 'aumentar_peso', label: 'Aumentar peso', icon: '📈' },
  { value: 'ganar_musculo', label: 'Ganar músculo', icon: '💪' },
]

const VALID = new Set(OBJETIVOS.map((o) => o.value))

/** Orden para metas, plan guiado y campo legacy `objetivo`. */
export const OBJETIVO_PRIORIDAD = ['bajar_peso', 'mantener_peso', 'ganar_musculo', 'aumentar_peso']

export function normalizeObjetivosConfig(config) {
  const raw = config?.objetivos
  if (Array.isArray(raw) && raw.length) {
    const list = [...new Set(raw.filter((v) => VALID.has(v)))]
    if (list.length) return list
  }
  const single = config?.objetivo
  if (single && VALID.has(single)) return [single]
  return ['mantener_peso']
}

export function objetivoPrimario(config) {
  const list = normalizeObjetivosConfig(config)
  for (const id of OBJETIVO_PRIORIDAD) {
    if (list.includes(id)) return id
  }
  return list[0]
}

export function labelsObjetivos(config) {
  return normalizeObjetivosConfig(config)
    .map((id) => OBJETIVOS.find((o) => o.value === id)?.label)
    .filter(Boolean)
}

export function labelsObjetivosTexto(config, separador = ' · ') {
  return labelsObjetivos(config).join(separador)
}

/** Toggle multi-selección; siempre queda al menos un objetivo. */
export function toggleObjetivoEnLista(config, value) {
  if (!VALID.has(value)) return config
  const current = normalizeObjetivosConfig(config)
  const has = current.includes(value)
  let next = has ? current.filter((x) => x !== value) : [...current, value]
  if (next.length === 0) next = [value]
  const primario = objetivoPrimario({ ...config, objetivos: next })
  return { ...config, objetivos: next, objetivo: primario }
}

export function resolveObjetivosParaConsejos(objetivoArg, config = {}) {
  if (Array.isArray(objetivoArg) && objetivoArg.length) {
    return normalizeObjetivosConfig({ objetivos: objetivoArg })
  }
  return normalizeObjetivosConfig({
    ...config,
    objetivo: objetivoArg || config?.objetivo,
  })
}
