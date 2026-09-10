/** ID único; funciona también fuera de contexto seguro (p. ej. http://IP:5173 en el celu). */
export function nuevoIdRegistro() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      /* contexto no seguro */
    }
  }
  return `r${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}
