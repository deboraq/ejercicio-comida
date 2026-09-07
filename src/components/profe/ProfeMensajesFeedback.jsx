import { useState, useMemo } from 'react'
import { useStorage } from '../../hooks/useStorage'
import { formatearFechaHoraLocal } from '../../utils/calorias'

function IconShield({ className }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" />
    </svg>
  )
}

function IconChatBubble({ className }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" />
    </svg>
  )
}

export default function ProfeMensajesFeedback({ adminMessages = [], students = [], busqueda = '', onToast }) {
  const [subTab, setSubTab] = useState('feedback')
  const [feedback] = useStorage('profeFeedbackAlumnos', [])

  const q = (busqueda || '').trim().toLowerCase()
  const feedbackList = Array.isArray(feedback) ? feedback : []

  const adminFiltrados = useMemo(() => {
    if (!q) return adminMessages
    return adminMessages.filter((m) => (m.body || '').toLowerCase().includes(q))
  }, [adminMessages, q])

  const feedbackFiltrados = useMemo(() => {
    if (!q) return feedbackList
    return feedbackList.filter((f) => {
      const blob = `${f.alumnoNombre || ''} ${f.texto || ''} ${f.rutina || ''}`.toLowerCase()
      return blob.includes(q)
    })
  }, [feedbackList, q])

  return (
    <div className="pf-msg-module">
      <div className="pf-info-banner pf-info-banner--compact mb-0">
        <span className="pf-info-ico" aria-hidden>i</span>
        <p className="mb-0">
          Los avisos del admin son de plataforma. El feedback de alumnos llegará cuando registren comentarios desde su app.
        </p>
      </div>

      <div className="pf-subtabs">
        <button
          type="button"
          className={`pf-subtab${subTab === 'feedback' ? ' is-active' : ''}`}
          onClick={() => setSubTab('feedback')}
        >
          <IconChatBubble className="pf-subtab-ico" />
          Feedback Alumnos
          {feedbackFiltrados.length > 0 ? <span className="pf-subtab-count">{feedbackFiltrados.length}</span> : null}
        </button>
        <button
          type="button"
          className={`pf-subtab${subTab === 'admin' ? ' is-active' : ''}`}
          onClick={() => setSubTab('admin')}
        >
          <IconShield className="pf-subtab-ico" />
          Avisos Admin
          {adminFiltrados.length > 0 ? <span className="pf-subtab-count">{adminFiltrados.length}</span> : null}
        </button>
      </div>

      {subTab === 'admin' && (
        <section className="pf-panel pf-panel--admin-msg">
          <h2 className="pf-section-title mb-2">Avisos oficiales del administrador</h2>
          {adminFiltrados.length === 0 ? (
            <p className="pf-muted mb-0">No hay avisos del administrador.</p>
          ) : (
            <ul className="pf-admin-msg-list mb-0">
              {adminFiltrados.map((m) => (
                <li key={m.id} className="pf-admin-msg-item">
                  <span className="pf-badge pf-badge--blue">Plataforma</span>
                  <p className="pf-admin-msg-body mb-1">{m.body}</p>
                  <time className="pf-admin-msg-time">{formatearFechaHoraLocal(m.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {subTab === 'feedback' && (
        <section className="pf-panel pf-panel--feedback">
          <h2 className="pf-section-title mb-2">Feedback y dudas de alumnos</h2>
          {feedbackFiltrados.length === 0 ? (
            <div className="pf-empty-state">
              <p className="mb-2">Todavía no hay mensajes de alumnos vinculados.</p>
              <p className="pf-muted mb-0">
                Cuando un alumno deje un comentario sobre un ejercicio (ej. molestia en press militar), aparecerá acá
                para que puedas responder o marcar como revisado.
              </p>
              {students.length === 0 ? (
                <p className="pf-muted mt-2 mb-0">Primero vinculá alumnos en la pestaña Supervisión &amp; Alumnos.</p>
              ) : null}
            </div>
          ) : (
            <ul className="pf-feedback-list mb-0">
              {feedbackFiltrados.map((f) => (
                <li key={f.id} className="pf-feedback-item">
                  <header className="pf-feedback-head">
                    <strong>{f.alumnoNombre || 'Alumno'}</strong>
                    {f.urgente ? <span className="pf-badge pf-badge--orange">Urgente</span> : null}
                    {f.revisado ? <span className="pf-badge pf-badge--muted">Visto</span> : null}
                  </header>
                  <p className="pf-feedback-text mb-1">{f.texto}</p>
                  {f.rutina ? <p className="pf-feedback-meta mb-0">{f.rutina}</p> : null}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="pf-btn pf-btn--outline pf-btn--sm mt-3"
            onClick={() => onToast?.({ msg: 'Respuesta directa al alumno: próximamente en la app del alumno.' })}
          >
            Responder feedback (próximamente)
          </button>
        </section>
      )}
    </div>
  )
}
