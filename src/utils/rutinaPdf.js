import { jsPDF } from 'jspdf'
import { etiquetaPlanEjercicio } from './rutinaEjercicioDia'

function nombreArchivoSeguro(nombre) {
  const base = String(nombre || 'rutina')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ._-]/g, '')
    .slice(0, 80)
  return base || 'rutina'
}

/** Descarga un PDF con la rutina activa (días y ejercicios). */
export function descargarRutinaPdf(rutina) {
  if (!rutina) return
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 16
  const maxW = doc.internal.pageSize.getWidth() - margin * 2
  const pageH = doc.internal.pageSize.getHeight()
  let y = margin
  const lineBase = 5.2

  const titulo = rutina.nombre || 'Rutina'
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, margin, y)
  y += lineBase * 1.6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, margin, y)
  y += lineBase * 1.4
  doc.setTextColor(0, 0, 0)

  const dias = Array.isArray(rutina.dias) ? rutina.dias : []

  const nuevaPaginaSiHaceFalta = (alturaNecesaria) => {
    if (y + alturaNecesaria <= pageH - 14) return
    doc.addPage()
    y = margin
  }

  dias.forEach((d, idx) => {
    const nombreDia = String(d?.nombre || `Día ${idx + 1}`).trim() || `Día ${idx + 1}`
    nuevaPaginaSiHaceFalta(lineBase * 3)

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(nombreDia, margin, y)
    y += lineBase * 1.3

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const ejercicios = Array.isArray(d?.ejercicios) ? d.ejercicios : []
    if (ejercicios.length === 0) {
      doc.setTextColor(110, 110, 110)
      doc.text('Sin ejercicios en este día.', margin + 3, y)
      y += lineBase
      doc.setTextColor(0, 0, 0)
    } else {
      ejercicios.forEach((ex) => {
        const texto = etiquetaPlanEjercicio(ex)
        if (texto === '—') return
        const linea = `• ${texto}`
        const lineas = doc.splitTextToSize(linea, maxW - 3)
        const alto = lineas.length * lineBase * 0.92
        nuevaPaginaSiHaceFalta(alto + 2)
        doc.text(lineas, margin + 3, y)
        y += alto
      })
    }
    y += lineBase * 0.6
  })

  doc.save(`${nombreArchivoSeguro(titulo)}.pdf`)
}
