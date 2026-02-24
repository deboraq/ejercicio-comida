/**
 * Lista de suplementos que el usuario puede marcar por día.
 * id: clave interna; label: texto para la UI.
 */
export const SUPLEMENTOS = [
  { id: 'proteina', label: 'Proteína' },
  { id: 'creatina', label: 'Creatina' },
  { id: 'vitamina_d', label: 'Vitamina D' },
  { id: 'omega3', label: 'Omega 3' },
  { id: 'multivitaminico', label: 'Multivitamínico' },
  { id: 'preentreno', label: 'Preentreno' },
  { id: 'colageno', label: 'Colágeno' },
  { id: 'magnesio', label: 'Magnesio' },
  { id: 'bcaa', label: 'BCAA' },
  { id: 'cafeina', label: 'Cafeína' },
  { id: 'otro', label: 'Otro' },
]

export function getSuplementoLabel(id) {
  return SUPLEMENTOS.find((s) => s.id === id)?.label ?? id
}
