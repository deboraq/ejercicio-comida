/** Normaliza texto para búsquedas (sin acentos). Compatible con Safari/iOS viejos. */
export function textoSinAcentos(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
