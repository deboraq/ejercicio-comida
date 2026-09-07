export const NOTA_CATEGORIAS = [
  { id: 'recordatorio', label: 'Recordatorio', emoji: '💡', tone: 'purple' },
  { id: 'lesion', label: 'Lesión / Cuidado', emoji: '🚨', tone: 'orange' },
  { id: 'cargas', label: 'Subir cargas', emoji: '📈', tone: 'green' },
  { id: 'objetivo', label: 'Objetivo mes', emoji: '🎯', tone: 'blue' },
]

export function categoriaNota(id) {
  return NOTA_CATEGORIAS.find((c) => c.id === id) || NOTA_CATEGORIAS[0]
}

export function normalizarNota(raw) {
  if (!raw || typeof raw !== 'object') return null
  const now = new Date().toISOString()
  return {
    id: raw.id || `nota_${Date.now()}`,
    text: String(raw.text || '').trim(),
    tag: raw.tag ? String(raw.tag) : '',
    category: NOTA_CATEGORIAS.some((c) => c.id === raw.category) ? raw.category : 'recordatorio',
    studentId: raw.studentId || null,
    checklist: Array.isArray(raw.checklist)
      ? raw.checklist.map((it, i) => ({
          id: it?.id || `chk_${i}`,
          text: String(it?.text || '').trim(),
          done: Boolean(it?.done),
        }))
      : [],
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || raw.createdAt || now,
  }
}

export function formatRelativo(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Editado ahora'
  if (min < 60) return `Editado hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Editado hace ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Editado ayer'
  return `Editado hace ${d} días`
}

export function toggleChecklistItem(nota, itemId) {
  const n = normalizarNota(nota)
  if (!n) return nota
  return {
    ...n,
    checklist: n.checklist.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it)),
    updatedAt: new Date().toISOString(),
  }
}
