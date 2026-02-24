// Consejos según objetivo del usuario
export const OBJETIVOS = [
  { value: 'bajar_peso', label: 'Bajar de peso', icon: '📉' },
  { value: 'mantener_peso', label: 'Mantener peso', icon: '⚖️' },
  { value: 'aumentar_peso', label: 'Aumentar peso', icon: '📈' },
  { value: 'ganar_musculo', label: 'Ganar músculo', icon: '💪' },
]

// Consejos por objetivo (generales)
const CONSEJOS_OBJETIVO = {
  bajar_peso: [
    'Para bajar de peso: intenta un déficit de 300-500 kcal al día.',
    'Prioriza proteína en cada comida para mantener masa muscular.',
    'El cardio ayuda al déficit; combínalo con algo de fuerza.',
    'Evita bebidas con calorías y controla las porciones.',
  ],
  mantener_peso: [
    'Para mantener: equilibra calorías consumidas y gasto.',
    'Mantén buena proteína (aprox. 1.2 g por kg de peso).',
    'Variedad de ejercicios ayuda a mantener la motivación.',
  ],
  aumentar_peso: [
    'Para subir de peso: superávit moderado (300-500 kcal).',
    'Prioriza calorías nutritivas y proteína (1.6-2 g/kg).',
    'Incluye fuerza para que el aumento sea músculo, no solo grasa.',
  ],
  ganar_musculo: [
    'Para ganar músculo: come en superávit leve y entrena fuerza.',
    'Proteína alta: unos 1.6-2.2 g por kg de peso al día.',
    'Los carbohidratos te dan energía para entrenar fuerte.',
    'Descansa bien: el músculo crece en la recuperación.',
  ],
}

// Consejos según tipo de ejercicio que hace
const CONSEJOS_POR_DEPORTE = {
  Cardio: [
    'Tras cardio intenso, repón con proteína y carbohidratos en la siguiente comida.',
    'Hidrátate bien antes y después del cardio.',
    'Si haces mucho cardio y quieres músculo, no descuides el entrenamiento de fuerza.',
  ],
  Fuerza: [
    'Después de fuerza, toma proteína en las siguientes horas para recuperación.',
    'Los carbohidratos te ayudan a rendir en la siguiente sesión de fuerza.',
    'Prioriza el sueño: la fuerza y el músculo se adaptan al descanso.',
  ],
  Flexibilidad: [
    'Mantente hidratado para evitar calambres.',
    'Estirar después de entrenar ayuda a la recuperación.',
  ],
  Deportes: [
    'En deportes de equipo, hidratación y carbos son clave para el rendimiento.',
    'Recupera con proteína y carbos después del partido o sesión.',
  ],
  Otro: [
    'Cualquier actividad suma: mantén la constancia.',
  ],
}

/**
 * Genera consejos del día según objetivo, datos del día y tipos de ejercicio.
 */
export function getConsejosDelDia(objetivo, dia, pesoKg = 70) {
  const consejos = []
  const obj = objetivo || 'mantener_peso'
  const proteinaMeta = Math.round(pesoKg * 1.4)

  const listObj = CONSEJOS_OBJETIVO[obj]
  if (listObj?.length) {
    consejos.push({ tipo: 'objetivo', texto: listObj[Math.floor(Math.random() * listObj.length)] })
  }

  const tipos = dia?.ejerciciosPorTipo || {}
  Object.keys(tipos).forEach((tipo) => {
    const lista = CONSEJOS_POR_DEPORTE[tipo]
    if (lista?.length && tipos[tipo] > 0) {
      consejos.push({ tipo: 'deporte', texto: lista[Math.floor(Math.random() * lista.length)] })
    }
  })

  const cal = Number(dia?.caloriasConsumidas) || 0
  const pro = Number(dia?.proteinas) || 0
  const car = Number(dia?.carbohidratos) || 0
  const quemadas = Number(dia?.caloriasQuemadas) || 0

  if (obj === 'bajar_peso' && cal > 0 && quemadas > 0 && cal > quemadas + 400) {
    consejos.push({
      tipo: 'dato',
      texto: 'Hoy llevas más calorías que las quemadas. Para bajar, intenta un déficit moderado (menos calorías o más movimiento).',
    })
  }
  if ((obj === 'ganar_musculo' || obj === 'aumentar_peso') && pro < proteinaMeta && cal > 0) {
    consejos.push({
      tipo: 'dato',
      texto: `Para tu objetivo conviene más proteína: intenta llegar a unos ${proteinaMeta} g al día. Puedes añadir en la siguiente comida.`,
    })
  }
  if (pro > 0 && pro < proteinaMeta * 0.6) {
    consejos.push({
      tipo: 'dato',
      texto: 'Hoy llevas poca proteína. Incluye en la cena huevo, pollo, pescado, legumbres o lácteos.',
    })
  }
  if (quemadas > 400 && car < 80 && (obj === 'mantener_peso' || obj === 'ganar_musculo')) {
    consejos.push({
      tipo: 'dato',
      texto: 'Con el ejercicio de hoy, unos carbohidratos extra te ayudan a recuperar y tener energía.',
    })
  }

  return consejos
}
