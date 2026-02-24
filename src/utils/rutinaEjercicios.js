/**
 * Ejercicios típicos de gimnasio / fuerza para elegir en la rutina.
 * El usuario puede elegir de la lista o escribir uno propio.
 */
export const EJERCICIOS_RUTINA = [
  'Press banca',
  'Press banca inclinado',
  'Sentadilla',
  'Sentadilla frontal',
  'Peso muerto',
  'Peso muerto rumano',
  'Dominadas',
  'Jalón al pecho',
  'Remo con barra',
  'Remo con mancuerna',
  'Press militar',
  'Desarrollo con mancuernas',
  'Curl bíceps',
  'Curl bíceps martillo',
  'Fondos en paralelas',
  'Extensión de tríceps',
  'Press francés',
  'Prensa de piernas',
  'Extensiones de cuádriceps',
  'Curl femoral',
  'Elevaciones laterales',
  'Encogimientos',
  'Plancha abdominal',
  'Crunch abdominal',
  'Hip thrust',
  'Zancadas',
  'Curl de pierna',
  'Otro',
]

export function buscarEjercicios(texto) {
  if (!texto || texto.length < 1) return EJERCICIOS_RUTINA.filter((e) => e !== 'Otro')
  const t = texto.toLowerCase().trim()
  return EJERCICIOS_RUTINA.filter((e) => e !== 'Otro' && e.toLowerCase().includes(t))
}
