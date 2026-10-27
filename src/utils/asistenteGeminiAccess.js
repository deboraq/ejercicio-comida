/** Asistente Gemini: solo administradores (config técnica + pestaña Consultas). */
export function puedeUsarAsistenteGemini(profile) {
  return profile?.role === 'admin'
}
