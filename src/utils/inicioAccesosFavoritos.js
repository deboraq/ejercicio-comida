/**
 * Accesos rápidos del inicio: atajos a módulos o vistas (plan de comida, armar rutina, etc.).
 * Se guardan ids en localStorage (`inicioAccesosFavoritos`).
 */

export const INICIO_ACCESOS_SUGERIDOS = [
  'comida-plan',
  'rutina-plan',
  'comida-hoy',
  'config',
]

/** @typedef {{ id: string, label: string, desc?: string, icon: string, tone: string, navModule?: string, requiresProfe?: boolean, requiresAdmin?: boolean, pathname: string, search?: string, hash?: string, state?: object }} InicioAccesoDef */

/** @type {InicioAccesoDef[]} */
export const INICIO_ACCESOS_CATALOGO = [
  {
    id: 'comida-hoy',
    label: 'Registrar comida',
    desc: 'Anotá desayuno, almuerzo y cena',
    icon: '🍽️',
    tone: 'comida',
    navModule: 'comida',
    pathname: '/comida',
  },
  {
    id: 'comida-plan',
    label: 'Plan alimenticio',
    desc: 'Kanban del plan TMV',
    icon: '📋',
    tone: 'plan',
    navModule: 'comida',
    pathname: '/comida',
    state: { vistaComida: 'plan' },
  },
  {
    id: 'comida-historial',
    label: 'Historial comida',
    desc: 'Días anteriores',
    icon: '📅',
    tone: 'comida',
    navModule: 'comida',
    pathname: '/comida',
    state: { vistaComida: 'historial' },
  },
  {
    id: 'rutina-hoy',
    label: 'Rutina de hoy',
    desc: 'Registrar entrenamiento',
    icon: '🏋️',
    tone: 'rutina',
    navModule: 'rutina',
    pathname: '/rutina',
    search: 'iniciar=1',
  },
  {
    id: 'rutina-plan',
    label: 'Armar rutina',
    desc: 'Días y ejercicios de la rutina elegida',
    icon: '🗓️',
    tone: 'rutina',
    navModule: 'rutina',
    pathname: '/rutina',
    state: { rutinaVista: 'configurar' },
  },
  {
    id: 'rutina-progreso',
    label: 'Progreso rutina',
    desc: 'Cargas y evolución',
    icon: '📈',
    tone: 'rutina',
    navModule: 'rutina',
    pathname: '/rutina',
    state: { rutinaVista: 'progreso' },
  },
  {
    id: 'rutina-asignadas',
    label: 'Rutinas asignadas',
    desc: 'Del entrenador',
    icon: '👤',
    tone: 'rutina',
    navModule: 'rutina',
    pathname: '/rutina',
    state: { rutinaOrigen: 'asignadas' },
  },
  {
    id: 'ejercicios',
    label: 'Ejercicios',
    desc: 'Catálogo y registro',
    icon: '🏃',
    tone: 'ejercicio',
    navModule: 'ejercicios',
    pathname: '/ejercicios',
  },
  {
    id: 'config',
    label: 'Configuración',
    desc: 'Perfil y metas',
    icon: '⚙️',
    tone: 'config',
    navModule: 'config',
    pathname: '/config',
  },
  {
    id: 'config-peso',
    label: 'Seguimiento de peso',
    desc: 'Historial corporal',
    icon: '⚖️',
    tone: 'config',
    navModule: 'config',
    pathname: '/config',
    hash: 'peso-seguimiento',
  },
  {
    id: 'config-plan-comida',
    label: 'Generar plan comida',
    desc: 'Desde objetivos',
    icon: '🎯',
    tone: 'plan',
    navModule: 'config',
    pathname: '/config',
    hash: 'plan-desde-objetivo',
  },
  {
    id: 'profe',
    label: 'Panel Profe',
    desc: 'Alumnos y envíos',
    icon: '🎓',
    tone: 'profe',
    navModule: 'profe',
    requiresProfe: true,
    pathname: '/profe',
  },
  {
    id: 'profe-plantillas',
    label: 'Plantillas rutina',
    desc: 'Taller del entrenador',
    icon: '📝',
    tone: 'profe',
    navModule: 'profe',
    requiresProfe: true,
    pathname: '/profe',
    state: { profeTab: 'plantillas' },
  },
  {
    id: 'admin',
    label: 'Administración',
    desc: 'Usuarios y roles',
    icon: '🛡️',
    tone: 'admin',
    navModule: 'admin',
    requiresAdmin: true,
    pathname: '/admin',
  },
]

/** Índice 0–13 — un tono distinto por acceso (`.inicio-acceso-chip--tone-*`). */
const ACCESO_TONE_BY_ID = {
  'comida-hoy': 0,
  'comida-plan': 1,
  'comida-historial': 2,
  'rutina-hoy': 3,
  'rutina-plan': 4,
  'rutina-progreso': 5,
  'rutina-asignadas': 6,
  ejercicios: 7,
  config: 8,
  'config-peso': 9,
  'config-plan-comida': 10,
  profe: 11,
  'profe-plantillas': 12,
  admin: 13,
}

export const INICIO_ACCESO_TONE_COUNT = 14

export function accesoInicioTone(id) {
  if (id && ACCESO_TONE_BY_ID[id] != null) return ACCESO_TONE_BY_ID[id]
  return 0
}

const catalogById = new Map(INICIO_ACCESOS_CATALOGO.map((a) => [a.id, a]))

export function getAccesoInicioById(id) {
  return catalogById.get(id) || null
}

export function resolverAccesosInicio(ids = []) {
  if (!Array.isArray(ids)) return []
  const out = []
  const seen = new Set()
  for (const id of ids) {
    if (seen.has(id)) continue
    const def = catalogById.get(id)
    if (def) {
      seen.add(id)
      out.push(def)
    }
  }
  return out
}

/** Accesos visibles según rol / módulos bloqueados. */
export function filtrarCatalogoAccesosInicio(
  catalog = INICIO_ACCESOS_CATALOGO,
  { ocultarNav, mostrarProfe, mostrarAdmin } = {},
) {
  const ocultar = typeof ocultarNav === 'function' ? ocultarNav : () => false
  return catalog.filter((item) => {
    if (item.requiresAdmin && !mostrarAdmin) return false
    if (item.requiresProfe && !mostrarProfe) return false
    if (item.navModule && ocultar(item.navModule)) return false
    return true
  })
}

export function accesosInicioVisibles(
  idsGuardados,
  { ocultarNav, mostrarProfe, mostrarAdmin } = {},
) {
  const catalogo = filtrarCatalogoAccesosInicio(INICIO_ACCESOS_CATALOGO, {
    ocultarNav,
    mostrarProfe,
    mostrarAdmin,
  })
  const permitidos = new Set(catalogo.map((a) => a.id))
  const base =
    Array.isArray(idsGuardados) && idsGuardados.length
      ? idsGuardados
      : INICIO_ACCESOS_SUGERIDOS
  return resolverAccesosInicio(base.filter((id) => permitidos.has(id)))
}

export function esAccesoInicioFavorito(favoritos, id) {
  if (!id) return false
  const list = Array.isArray(favoritos) ? favoritos : []
  if (list.length) return list.includes(id)
  return INICIO_ACCESOS_SUGERIDOS.includes(id)
}

export function toggleAccesoInicioFavorito(setFavoritos, id) {
  if (!id) return
  setFavoritos((prev) => {
    const list =
      Array.isArray(prev) && prev.length ? [...prev] : [...INICIO_ACCESOS_SUGERIDOS]
    if (list.includes(id)) return list.filter((x) => x !== id)
    return [...list, id]
  })
}

/** @param {InicioAccesoDef} acceso @param {{ hoyISO?: string }} ctx */
export function buildAccesoInicioLink(acceso, ctx = {}) {
  if (!acceso) return { to: '/', state: undefined }
  let search = acceso.search || ''
  if (acceso.id === 'rutina-hoy' && ctx.hoyISO) {
    const params = new URLSearchParams(search)
    params.set('fecha', ctx.hoyISO)
    params.set('iniciar', '1')
    search = params.toString()
  }
  const pathname = acceso.pathname || '/'
  const hash = acceso.hash ? `#${acceso.hash.replace(/^#/, '')}` : ''
  const q = search ? `?${search.replace(/^\?/, '')}` : ''
  return {
    to: `${pathname}${q}${hash}`,
    state: acceso.state,
  }
}
