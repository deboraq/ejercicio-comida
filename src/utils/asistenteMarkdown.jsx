/** Render mínimo de markdown (negritas y listas) para respuestas del asistente. */

function limpiarAsteriscosSueltos(str) {
  return String(str).replace(/\*\*/g, '')
}

function parseInline(str, keyPrefix) {
  const nodes = []
  let last = 0
  const re = /\*\*([^*]+)\*\*/g
  let m
  let k = 0
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) {
      nodes.push(limpiarAsteriscosSueltos(str.slice(last, m.index)))
    }
    nodes.push(
      <strong key={`${keyPrefix}-b-${k}`}>{m[1]}</strong>,
    )
    k += 1
    last = m.index + m[0].length
  }
  if (last < str.length) {
    nodes.push(limpiarAsteriscosSueltos(str.slice(last)))
  }
  return nodes.length ? nodes : [limpiarAsteriscosSueltos(str)]
}

/**
 * @param {string} text
 */
export function AsistenteMensajeMarkdown({ text }) {
  const lines = String(text || '').split('\n')
  const blocks = []
  let listItems = []
  let bi = 0

  const flushList = () => {
    if (!listItems.length) return
    blocks.push(
      <ul key={`ul-${bi}`} className="cd-asistente-msg-list">
        {listItems}
      </ul>,
    )
    listItems = []
    bi += 1
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/)
    if (bullet) {
      listItems.push(
        <li key={`li-${i}`}>{parseInline(bullet[1], `l${i}`)}</li>,
      )
      return
    }
    flushList()
    if (!trimmed) {
      blocks.push(<br key={`br-${i}`} />)
      return
    }
    blocks.push(
      <p key={`p-${i}`} className="cd-asistente-msg-p">
        {parseInline(line, `p${i}`)}
      </p>,
    )
  })
  flushList()

  return <div className="cd-asistente-msg-body">{blocks}</div>
}
