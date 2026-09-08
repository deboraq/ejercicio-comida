import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStorage } from '../../hooks/useStorage'
import { exportarRutinaAJson } from '../../utils/rutinaShare'
import { createRoutineAssignment } from '../../lib/profeDb'
import {
  FILTRO_ALUMNO,
  buildFeedActividad,
  contarPorFiltro,
  filtrarAlumnos,
  inicialesAlumno,
  avatarToneClass,
} from '../../utils/profeAlumnosSnapshot'
import { AppNotificacionesCampana } from '../../context/AppNotificationsContext'
import {
  NOTA_CATEGORIAS,
  categoriaNota,
  normalizarNota,
  formatRelativo,
  toggleChecklistItem,
} from '../../utils/profeNotas'
import ProfeMensajesFeedback from './ProfeMensajesFeedback'
import ProfeCatalogoEjercicios from './ProfeCatalogoEjercicios'
import ProfeRutinasWorkshop from './ProfeRutinasWorkshop'
import ProfeHistorialAsignaciones from './ProfeHistorialAsignaciones'
import './ProfeTitanium.css'

const TABS = [
  { id: 'alumnos', label: 'Supervisión & Alumnos', Icon: IconUsers },
  { id: 'historial', label: 'Rutinas Asignadas & Envíos', Icon: IconClipboard },
  { id: 'mensajes', label: 'Mensajes y Feedback', Icon: IconMessage },
  { id: 'plantillas', label: 'Plantillas & Catálogo', Icon: IconTemplate },
]

function IconUsers({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
    </svg>
  )
}

function IconClipboard({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  )
}

function IconMessage({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" />
    </svg>
  )
}

function IconTemplate({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
    </svg>
  )
}

function IconSearch({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  )
}

function IconCloudUpload({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 16V8m0 0l-3 3m3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconLightning({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z" />
    </svg>
  )
}

function IconChat({ className }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" />
    </svg>
  )
}

function IconMail({ className }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" strokeLinecap="round" />
    </svg>
  )
}

function IconNotes({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function labelAlumnoSelect(s) {
  const name = (s.fullName || 'Alumno').trim()
  const mail = (s.email || '').trim()
  return mail ? `${name} (${mail})` : name
}

function labelPlantillaSelect(p) {
  const nombre = (p.nombre || 'Sin nombre').trim()
  return nombre.startsWith('🔥') ? nombre : `🔥 ${nombre}`
}

function FeedItemRow({ item }) {
  return (
    <li className="pf-feed-item">
      <span
        className="pf-feed-avatar"
        style={{
          background: `${item.avatarColor || '#3b82f6'}30`,
          color: item.avatarColor || '#93c5fd',
        }}
      >
        {item.initials || '?'}
      </span>
      <div className="pf-feed-body">
        <p className="pf-feed-line mb-0">
          {(item.segments || []).map((seg, i) => (
            <span
              key={`${item.id}_${i}`}
              className={[
                seg.bold ? 'pf-feed-bold' : '',
                seg.tone ? `pf-feed-tone pf-feed-tone--${seg.tone}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {seg.text}
            </span>
          ))}
        </p>
        {item.subtext ? (
          <p className={`pf-feed-sub mb-0${item.subtextTone ? ` pf-feed-sub--${item.subtextTone}` : ''}`}>
            {item.subtext}
          </p>
        ) : null}
      </div>
    </li>
  )
}

function NotaPrivadaRow({ nota, students = [], onQuitar, onToggleCheck }) {
  const n = normalizarNota(nota)
  if (!n) return null
  const cat = categoriaNota(n.category)
  const alumno = n.studentId ? students.find((s) => s.studentId === n.studentId) : null
  const alumnoLabel = alumno ? alumno.fullName || alumno.email : null
  const parts = n.text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)

  return (
    <li className="pf-notes-row">
      <div className="pf-notes-row-main">
        <div className="pf-notes-row-top">
          <span className={`pf-notes-cat pf-notes-cat--${cat.tone}`}>
            {cat.emoji} {cat.label}
          </span>
          {alumnoLabel ? <span className="pf-notes-alumno">{alumnoLabel}</span> : null}
          <time className="pf-notes-time">{formatRelativo(n.updatedAt)}</time>
        </div>
        <p className="pf-notes-text mb-0">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i}>{part.slice(2, -2)}</strong>
            }
            return part
          })}
        </p>
        {n.checklist.length > 0 ? (
          <ul className="pf-notes-checklist mb-0">
            {n.checklist.map((it) => (
              <li key={it.id}>
                <label className="pf-notes-check">
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={() => onToggleCheck?.(n.id, it.id)}
                  />
                  <span className={it.done ? 'is-done' : ''}>{it.text}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <button type="button" className="pf-notes-del" aria-label="Eliminar nota" onClick={() => onQuitar?.(n.id)}>
        ×
      </button>
    </li>
  )
}

function rolAlumnoLabel(alumno) {
  const mail = (alumno.email || '').toLowerCase()
  const name = (alumno.fullName || '').toLowerCase()
  if (mail.includes('admin') || name.includes('admin')) return 'Admin + Alumna'
  return null
}

function AlumnoCard({ alumno, onEditarRutina, onVerFicha, onToast }) {
  const s = alumno.snapshot || {}
  const ini = inicialesAlumno(alumno.fullName, alumno.email)
  const avatarTone = avatarToneClass(alumno.email || alumno.studentId)
  const tone = s.estadoTone || 'blue'
  const rolLabel = rolAlumnoLabel(alumno)

  return (
    <article className={`pf-alumno-card pf-alumno-card--${tone}`}>
      <header className="pf-alumno-head">
        <div className="pf-alumno-id">
          <span className="pf-alumno-avatar-wrap">
            <span className={`pf-alumno-avatar ${avatarTone}`}>
              {ini}
            </span>
            <span className={`pf-alumno-live pf-alumno-live--${tone}`} aria-hidden />
          </span>
          <div className="pf-alumno-meta">
            <h3 className="pf-alumno-name mb-0">{alumno.fullName || alumno.email}</h3>
            <p className="pf-alumno-mail mb-0">
              <IconMail className="pf-alumno-mail-ico" />
              {alumno.email}
            </p>
            <div className="pf-alumno-badges">
              <span className={`pf-badge pf-badge--${tone}`}>{s.estadoLabel || 'Al día'}</span>
              {rolLabel ? <span className="pf-badge pf-badge--role">{rolLabel}</span> : null}
            </div>
          </div>
        </div>
        <div className="pf-alumno-actions">
          {s.pendienteRevision ? (
            <button type="button" className="pf-btn pf-btn--outline-orange" onClick={() => onEditarRutina?.(alumno)}>
              Revisar Cargas
            </button>
          ) : (
            <button type="button" className="pf-btn pf-btn--outline-blue" onClick={() => onEditarRutina?.(alumno)}>
              Editar Rutina
            </button>
          )}
          <button type="button" className="pf-btn pf-btn--outline" onClick={() => onVerFicha?.(alumno)}>
            Ver Ficha
          </button>
          <button
            type="button"
            className="pf-btn pf-btn--icon"
            aria-label="Mensaje"
            onClick={() => onToast?.({ msg: 'Mensajes directos próximamente.' })}
          >
            <IconChat />
          </button>
        </div>
      </header>
      <div className="pf-alumno-stats">
        <div className="pf-alumno-stat">
          <span className="pf-alumno-stat-lbl">Rutina activa vinculada</span>
          <strong className={`pf-alumno-stat-val pf-alumno-stat-val--dot pf-alumno-stat-val--dot-${tone}${s.rutinaActiva === 'Sin rutina asignada' ? ' pf-alumno-stat-val--empty' : ''}`}>
            {s.rutinaActiva}
          </strong>
        </div>
        <div className="pf-alumno-stat">
          <span className="pf-alumno-stat-lbl">Cumplimiento semanal</span>
          <strong className={`pf-alumno-stat-val pf-alumno-stat-val--${tone}`}>{s.cumplimientoLabel}</strong>
          <div className="pf-alumno-progress" aria-hidden>
            <span
              className={`pf-alumno-progress-fill pf-alumno-progress-fill--${tone}`}
              style={{ width: `${s.pctCumplimiento || 0}%` }}
            />
          </div>
        </div>
        <div className="pf-alumno-stat">
          <span className="pf-alumno-stat-lbl">Última actividad registrada</span>
          <strong className="pf-alumno-stat-val pf-alumno-stat-val--muted">{s.ultimaActividad}</strong>
        </div>
      </div>
    </article>
  )
}

function SidebarEnvio({ students, teacherId, feedItems, onToast, onEnviado, preselectStudentId }) {
  const [plantillas] = useStorage('profePlantillasRutina', [])
  const [notasPrivadas, setNotasPrivadas] = useStorage('profeNotasPrivadas', [])
  const [alumnoId, setAlumnoId] = useState(preselectStudentId || '')
  const [plantillaId, setPlantillaId] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [modalNota, setModalNota] = useState(false)
  const [notaTexto, setNotaTexto] = useState('')
  const [notaCategoria, setNotaCategoria] = useState('recordatorio')
  const [notaAlumnoId, setNotaAlumnoId] = useState('')
  const [notaChecklist, setNotaChecklist] = useState('')

  const plantillasList = Array.isArray(plantillas) ? plantillas : []
  const notasList = Array.isArray(notasPrivadas) ? notasPrivadas : []
  const hayAlumnos = students.length > 0
  const alumnoSel = hayAlumnos ? (alumnoId || preselectStudentId || students[0]?.studentId || '') : ''

  useEffect(() => {
    if (preselectStudentId) setAlumnoId(preselectStudentId)
  }, [preselectStudentId])

  useEffect(() => {
    if (!plantillaId && plantillasList.length) setPlantillaId(plantillasList[0].id)
  }, [plantillaId, plantillasList])

  const publicar = async () => {
    if (!teacherId || !alumnoSel) {
      onToast?.({ err: 'Elegí un alumno.' })
      return
    }
    const p = plantillasList.find((x) => x.id === plantillaId)
    if (!p) {
      onToast?.({ err: 'Elegí una plantilla de entrenamiento.' })
      return
    }
    setEnviando(true)
    try {
      const obj = JSON.parse(exportarRutinaAJson({ nombre: p.nombre, dias: p.dias }))
      const dias = Array.isArray(obj.dias) ? obj.dias : []
      const payload = { dias }
      if (mensaje.trim()) payload.notaProfe = mensaje.trim()
      const { error } = await createRoutineAssignment(teacherId, alumnoSel, p.nombre || 'Rutina', payload)
      if (error) {
        onToast?.({ err: error.message || 'No se pudo publicar.' })
      } else {
        onToast?.({ msg: `Rutina «${p.nombre}» publicada en la app del alumno.` })
        setMensaje('')
        onEnviado?.()
      }
    } catch (e) {
      onToast?.({ err: e?.message || 'Error al preparar la rutina.' })
    }
    setEnviando(false)
  }

  const abrirModalNota = () => {
    setNotaTexto('')
    setNotaCategoria('recordatorio')
    setNotaAlumnoId(alumnoSel || '')
    setNotaChecklist('')
    setModalNota(true)
  }

  const guardarNota = () => {
    const text = notaTexto.trim()
    if (!text) {
      onToast?.({ err: 'Escribí el recordatorio.' })
      return
    }
    const checklist = notaChecklist
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => ({ id: `chk_${Date.now()}_${i}`, text: line, done: false }))
    const nota = normalizarNota({
      id: `nota_${Date.now()}`,
      text,
      category: notaCategoria,
      studentId: notaAlumnoId || null,
      checklist,
    })
    setNotasPrivadas((prev) => [nota, ...(Array.isArray(prev) ? prev.map((x) => normalizarNota(x)).filter(Boolean) : [])])
    setModalNota(false)
    onToast?.({ msg: 'Nota privada guardada.' })
  }

  const quitarNota = (id) => {
    setNotasPrivadas((prev) => (Array.isArray(prev) ? prev.filter((n) => n.id !== id) : []))
  }

  const toggleCheckNota = (notaId, itemId) => {
    setNotasPrivadas((prev) =>
      (Array.isArray(prev) ? prev : []).map((raw) => {
        const n = normalizarNota(raw)
        if (!n || n.id !== notaId) return raw
        return toggleChecklistItem(n, itemId)
      }),
    )
  }

  const notasNormalizadas = useMemo(
    () => notasList.map((x) => normalizarNota(x)).filter(Boolean),
    [notasList],
  )

  return (
    <aside className="pf-aside">
      <section className="pf-panel pf-panel--cloud">
        <header className="pf-panel-head">
          <span className="pf-panel-ico" aria-hidden><IconCloudUpload /></span>
          <div className="pf-panel-head-main">
            <div className="pf-panel-head-row">
              <h2 className="pf-panel-title mb-0">Enviar Rutina a la Nube</h2>
              <span className="pf-sync-badge">Sync v2.4</span>
            </div>
          </div>
        </header>
        <label className="pf-field">
          <span>Seleccionar Alumno</span>
          <select value={alumnoSel} onChange={(e) => setAlumnoId(e.target.value)} disabled={!hayAlumnos}>
            {!hayAlumnos ? (
              <option value="">Vinculá un alumno primero…</option>
            ) : (
              students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {labelAlumnoSelect(s)}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="pf-field">
          <span>Plantilla de Entrenamiento</span>
          <select value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
            <option value="">Elegir plantilla…</option>
            {plantillasList.map((p) => (
              <option key={p.id} value={p.id}>
                {labelPlantillaSelect(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="pf-field">
          <span>Mensaje para la pestaña &apos;Rutina&apos;</span>
          <textarea
            rows={3}
            placeholder="Ej: ¡Vamos con todo esta semana! Priorizá técnica en sentadilla..."
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="pf-btn-publicar"
          disabled={enviando || !hayAlumnos || !plantillaId}
          onClick={publicar}
        >
          <IconLightning />
          {enviando ? 'Publicando…' : 'Publicar en la app del Alumno'}
        </button>
      </section>

      <section className="pf-panel pf-panel--feed">
        <header className="pf-feed-head">
          <div className="pf-feed-head-left">
            <span className="pf-live-dot" aria-label="Supervisión en vivo activa" />
            <h2 className="pf-panel-title mb-0">Feed en Vivo de Alumnos</h2>
          </div>
          <span className="pf-feed-today">Hoy</span>
        </header>
        {feedItems.length === 0 ? (
          <p className="pf-feed-empty mb-0">Sin actividad reciente de alumnos.</p>
        ) : (
          <ul className="pf-feed-list mb-0">
            {feedItems.map((it) => (
              <FeedItemRow key={it.id} item={it} />
            ))}
          </ul>
        )}
      </section>

      <section className="pf-panel pf-panel--notes pf-panel--notes-purple">
        <header className="pf-notes-head">
          <div className="pf-notes-head-left">
            <span className="pf-panel-ico pf-panel-ico--purple" aria-hidden><IconNotes /></span>
            <div>
              <h2 className="pf-panel-title mb-0">Notas Privadas del Profe</h2>
              <span className="pf-notes-confidential">Solo visible para ti</span>
            </div>
          </div>
          <button type="button" className="pf-notes-add" onClick={abrirModalNota}>
            + Añadir
          </button>
        </header>
        <p className="pf-notes-desc mb-0">
          Scratchpad confidencial por alumno: lesiones, cargas, objetivos y pendientes de revisión.
        </p>
        {notasNormalizadas.length === 0 ? (
          <p className="pf-notes-empty mb-0">Todavía no hay notas. Usá + Añadir para crear un recordatorio.</p>
        ) : (
          <ul className="pf-notes-list mb-0">
            {notasNormalizadas.map((nota) => (
              <NotaPrivadaRow
                key={nota.id}
                nota={nota}
                students={students}
                onQuitar={quitarNota}
                onToggleCheck={toggleCheckNota}
              />
            ))}
          </ul>
        )}
      </section>

      {modalNota && (
        <div className="pf-modal" role="dialog" aria-modal="true" aria-labelledby="pf-modal-nota-title">
          <button type="button" className="pf-modal-backdrop" aria-label="Cerrar" onClick={() => setModalNota(false)} />
          <div className="pf-modal-panel">
            <h2 id="pf-modal-nota-title" className="pf-panel-title mb-3">Nueva nota privada</h2>
            <label className="pf-field">
              <span>Categoría</span>
              <select value={notaCategoria} onChange={(e) => setNotaCategoria(e.target.value)}>
                {NOTA_CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span>Alumno vinculado (opcional)</span>
              <select value={notaAlumnoId} onChange={(e) => setNotaAlumnoId(e.target.value)}>
                <option value="">Nota general del profe</option>
                {students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {labelAlumnoSelect(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span>Recordatorio</span>
              <textarea
                rows={4}
                value={notaTexto}
                onChange={(e) => setNotaTexto(e.target.value)}
                placeholder="Ej: Preguntarle a Debora cómo sintió las 4 series de Jalón con 35kg."
                autoFocus
              />
            </label>
            <label className="pf-field">
              <span>Checklist de pendientes (una línea por tarea)</span>
              <textarea
                rows={3}
                value={notaChecklist}
                onChange={(e) => setNotaChecklist(e.target.value)}
                placeholder={'Revisar técnica en video\nEnviar corrección de carga'}
              />
            </label>
            <div className="pf-modal-actions">
              <button type="button" className="pf-btn pf-btn--outline" onClick={() => setModalNota(false)}>
                Cancelar
              </button>
              <button type="button" className="pf-btn pf-btn--primary" onClick={guardarNota}>
                Guardar nota
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

export default function ProfeTitanium({
  profile,
  user,
  students = [],
  studentsLoading,
  alumnosEnriquecidos = [],
  userDataMap = {},
  adminMessages = [],
  busqueda = '',
  setBusqueda,
  filtro = FILTRO_ALUMNO.todos,
  setFiltro,
  emailAlumno = '',
  setEmailAlumno,
  vincularAlumno,
  quitarAlumno,
  onToast,
  historialTick,
  setHistorialTick,
  esAdmin,
  userDataSyncWarn = false,
  onRefreshAlumnos,
}) {
  const [tab, setTab] = useState('alumnos')
  const [modalVincular, setModalVincular] = useState(false)
  const [preselectStudentId, setPreselectStudentId] = useState('')
  const [bannerCerrado, setBannerCerrado] = useState(false)

  const conteos = useMemo(() => contarPorFiltro(alumnosEnriquecidos), [alumnosEnriquecidos])
  const alumnosFiltrados = useMemo(
    () => filtrarAlumnos(alumnosEnriquecidos, busqueda, filtro),
    [alumnosEnriquecidos, busqueda, filtro],
  )
  const feedItems = useMemo(
    () => buildFeedActividad(alumnosEnriquecidos, userDataMap),
    [alumnosEnriquecidos, userDataMap],
  )

  const nombreProfe = (profile?.full_name || user?.email || 'Entrenador').trim()
  const mailProfe = (profile?.email || user?.email || '').trim()
  const mensajesNoLeidos = adminMessages.length

  const chips = [
    { id: FILTRO_ALUMNO.todos, label: `Todos (${conteos.total})` },
    { id: FILTRO_ALUMNO.activos, label: `Activos hoy (${conteos.activos})`, tone: 'green', dot: 'green' },
    { id: FILTRO_ALUMNO.revisar, label: `Por revisar (${conteos.revisar})`, tone: 'orange', dot: 'orange' },
    { id: FILTRO_ALUMNO.pausa, label: `En pausa (${conteos.pausa})`, tone: 'muted', dot: 'muted' },
  ]

  const irEditarRutina = (alumno) => {
    setPreselectStudentId(alumno.studentId)
    setTab('plantillas')
    onToast?.({ msg: `Plantillas: podés enviar rutina a ${alumno.fullName || alumno.email}.` })
  }

  const handleVincular = async () => {
    await vincularAlumno?.()
    setModalVincular(false)
  }

  return (
    <div className="pf-root">
      <div className="pf-topbar">
        <p className="pf-breadcrumb mb-0">
          <span className="pf-breadcrumb-brand">Fitness Pro</span>
          <span className="pf-breadcrumb-dot" aria-hidden />
          <span className="pf-breadcrumb-active">Módulo Profe</span>
        </p>
        <div className="pf-topbar-actions">
          <span className="pf-cloud-badge">Supervisión Cloud Activa</span>
          <button type="button" className="pf-btn-vincular" onClick={() => setModalVincular(true)}>
            + Vincular nuevo alumno
          </button>
          <div className="pf-campana">
            <AppNotificacionesCampana />
          </div>
        </div>
      </div>

      <header className="pf-header">
        <div className="pf-header-main">
          <div className="pf-coach-row">
            <span className="pf-coach-avatar" aria-hidden>🧑‍🏫</span>
            <div>
              <div className="pf-title-row">
                <h1 className="pf-title mb-0">Panel del Entrenador</h1>
                <span className="pf-online-badge">● En línea</span>
              </div>
              <p className="pf-subtitle mb-0">
                Supervisión directa, seguimiento de entrenamientos en tiempo real y sincronización automática a la
                pestaña Rutina del alumno.
              </p>
              <p className="pf-coach-meta mb-0">
                {nombreProfe}
                {mailProfe ? ` (${mailProfe})` : ''}
                {profile?.role === 'admin' ? (
                  ' · Admin + Entrenador'
                ) : (
                  <>
                    {' · Especialidad: '}
                    <span className="pf-coach-spec">Fuerza &amp; Hipertrofia</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="pf-header-kpis">
          <div className="pf-kpi pf-kpi--total">
            <span className="pf-kpi-lbl">Alumnos</span>
            <strong className="pf-kpi-val">{conteos.total}</strong>
          </div>
          <div className="pf-kpi pf-kpi--green">
            <span className="pf-kpi-lbl">Activos hoy</span>
            <strong className="pf-kpi-val">{conteos.activos}</strong>
          </div>
          <div className="pf-kpi pf-kpi--orange">
            <span className="pf-kpi-lbl">Por revisar</span>
            <strong className="pf-kpi-val">{conteos.revisar}</strong>
          </div>
        </div>
      </header>

      <nav className="pf-tabs" aria-label="Secciones del entrenador">
        {TABS.map((t) => {
          const TabIcon = t.Icon
          return (
          <button
            key={t.id}
            type="button"
            className={`pf-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <TabIcon className="pf-tab-ico" />
            {t.label}
            {t.id === 'alumnos' && (
              <span className="pf-tab-count">{conteos.total}</span>
            )}
            {t.id === 'mensajes' && mensajesNoLeidos > 0 && (
              <span className="pf-tab-dot" aria-label={`${mensajesNoLeidos} mensajes`} />
            )}
          </button>
          )
        })}
      </nav>

      {!bannerCerrado && (
        <div className="pf-info-banner">
          <span className="pf-info-ico" aria-hidden>i</span>
          <p className="mb-0">
            Los roles del menú se gestionan en <Link to="/admin">Administración</Link>. Una cuenta alumno sigue viendo
            solo Inicio, Ejercicios, Rutina, Comida y Config; el resto depende del rol y de lo que habilite el admin.
          </p>
          <button type="button" className="pf-info-close" aria-label="Cerrar aviso" onClick={() => setBannerCerrado(true)}>
            ×
          </button>
        </div>
      )}

      {userDataSyncWarn && (
        <div className="pf-info-banner pf-info-banner--warn">
          <span className="pf-info-ico" aria-hidden>!</span>
          <p className="mb-2">
            No se pudo leer la actividad real de tus alumnos en la nube. Ejecutá en Supabase el bloque{' '}
            <strong>Supervisión Profe (user_data)</strong> de SUPABASE.md (política RLS + función RPC).
          </p>
          <button type="button" className="pf-btn-vincular pf-btn-vincular--sm" onClick={() => onRefreshAlumnos?.()}>
            Reintentar sync
          </button>
        </div>
      )}

      {tab === 'alumnos' ? (
        <div className="pf-alumnos-view">
          <div className="pf-filter-bar">
            <div className="pf-search">
              <IconSearch className="pf-search-ico" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda?.(e.target.value)}
                placeholder="Buscar alumno por nombre, correo (ej: debora, debocab2@...), o..."
                autoComplete="off"
              />
            </div>
            <div className="pf-chips">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`pf-chip${filtro === c.id ? ' is-active' : ''}${c.tone ? ` pf-chip--${c.tone}` : ''}`}
                  onClick={() => setFiltro?.(c.id)}
                >
                  {c.dot ? <span className={`pf-chip-dot pf-chip-dot--${c.dot}`} aria-hidden /> : null}
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pf-layout">
            <div className="pf-main">
              {studentsLoading ? (
                <p className="pf-muted">Cargando alumnos…</p>
              ) : students.length === 0 ? (
                <div className="pf-empty">
                  <p className="mb-0">Todavía no tenés alumnos vinculados.</p>
                  <button type="button" className="pf-btn-vincular" onClick={() => setModalVincular(true)}>
                    + Vincular primer alumno
                  </button>
                </div>
              ) : alumnosFiltrados.length === 0 ? (
                <p className="pf-muted pf-panel">No hay alumnos que coincidan con la búsqueda o el filtro.</p>
              ) : (
                <div className="pf-alumnos-list">
                  {alumnosFiltrados.map((a) => (
                    <AlumnoCard
                      key={a.linkId}
                      alumno={a}
                      onEditarRutina={irEditarRutina}
                      onVerFicha={() => onToast?.({ msg: 'Ficha detallada del alumno próximamente.' })}
                      onToast={onToast}
                    />
                  ))}
                </div>
              )}
            </div>

            <SidebarEnvio
              students={students}
              teacherId={user?.id}
              feedItems={feedItems}
              onToast={onToast}
              onEnviado={() => setHistorialTick?.((n) => n + 1)}
              preselectStudentId={preselectStudentId}
            />
          </div>
        </div>
      ) : (
        <div className="pf-tab-view">
          {(tab === 'historial' || tab === 'mensajes' || tab === 'plantillas') && (
            <div className="pf-filter-bar pf-filter-bar--tab">
              <div className="pf-search">
                <IconSearch className="pf-search-ico" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda?.(e.target.value)}
                  placeholder={
                    tab === 'historial'
                      ? 'Buscar por alumno, correo o plantilla…'
                      : tab === 'mensajes'
                        ? 'Filtrar mensajes o feedback…'
                        : 'Buscar plantilla o ejercicio del catálogo…'
                  }
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <div className="pf-layout pf-layout--full">
            <div className="pf-main">
              {tab === 'historial' && (
                <ProfeHistorialAsignaciones
                  key={historialTick}
                  teacherId={user?.id}
                  students={students}
                  userDataMap={userDataMap}
                  busqueda={busqueda}
                  onToast={onToast}
                  onReenviado={() => setHistorialTick?.((n) => n + 1)}
                />
              )}

              {tab === 'mensajes' && (
                <ProfeMensajesFeedback
                  adminMessages={adminMessages}
                  students={students}
                  busqueda={busqueda}
                  onToast={onToast}
                />
              )}

              {tab === 'plantillas' && (
                <div className="pf-plantillas-wrap">
                  <ProfeRutinasWorkshop
                    students={students}
                    teacherId={user?.id}
                    busqueda={busqueda}
                    onToast={onToast}
                    onEnviado={() => setHistorialTick?.((n) => n + 1)}
                  />
                  <div className="pf-plantillas-extra">
                    <ProfeCatalogoEjercicios busqueda={busqueda} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modalVincular && (
        <div className="pf-modal" role="dialog" aria-modal="true" aria-labelledby="pf-modal-vincular-title">
          <button type="button" className="pf-modal-backdrop" aria-label="Cerrar" onClick={() => setModalVincular(false)} />
          <div className="pf-modal-panel">
            <h2 id="pf-modal-vincular-title" className="pf-panel-title mb-3">Vincular nuevo alumno</h2>
            <p className="pf-muted mb-3">El alumno debe tener cuenta registrada con ese correo.</p>
            <label className="pf-field">
              <span>Correo del alumno</span>
              <input
                type="email"
                value={emailAlumno}
                onChange={(e) => setEmailAlumno?.(e.target.value)}
                placeholder="alumno@email.com"
              />
            </label>
            <div className="pf-modal-actions">
              <button type="button" className="pf-btn pf-btn--outline" onClick={() => setModalVincular(false)}>
                Cancelar
              </button>
              <button type="button" className="pf-btn pf-btn--primary" onClick={handleVincular}>
                Vincular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
