/** Pestaña Consultas en Comida: cualquier usuario con sesión iniciada. */
export function puedeUsarConsultasGemini(user) {
  return Boolean(user)
}

/** Config técnica (modelo, key local, Vercel): solo administradores. */
export function puedeConfigurarAsistenteGemini(profile) {
  return profile?.role === 'admin'
}
