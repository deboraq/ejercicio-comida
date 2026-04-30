import { supabase } from './supabase'

/** Asegura fila en `profiles` (requiere SQL de SUPABASE.md). No pisa `role` si ya existe. */
export async function ensureMyProfile(user) {
  if (!supabase || !user?.id) return { ok: false }
  try {
    const email = (user.email || '').trim().toLowerCase()
    const full_name = user.user_metadata?.full_name || ''
    const { data: row, error: e1 } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
    if (e1) return { ok: false, error: e1 }
    if (!row) {
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        email,
        full_name,
        role: 'alumno',
      })
      return { ok: !error, error }
    }
    const { error } = await supabase.from('profiles').update({ email, full_name }).eq('id', user.id)
    return { ok: !error, error }
  } catch {
    return { ok: false }
  }
}

export async function fetchMyProfile(userId) {
  if (!supabase || !userId) return { data: null, error: new Error('Sin cliente') }
  return supabase.from('profiles').select('id, email, full_name, role').eq('id', userId).maybeSingle()
}

/** Solo un usuario con rol `admin` en BD puede cambiar roles (RLS + trigger). */
export async function adminUpdateUserRole(targetUserId, role) {
  if (!supabase || !targetUserId) return { error: new Error('Sin cliente') }
  if (!['alumno', 'profe', 'admin'].includes(role)) return { error: new Error('Rol inválido') }
  return supabase.from('profiles').update({ role }).eq('id', targetUserId)
}

export async function listProfilesForAdmin() {
  if (!supabase) return { data: [], error: new Error('Sin cliente') }
  return supabase.from('profiles').select('id, email, full_name, role, created_at').order('created_at', { ascending: false })
}

export async function listAdminMessagesForTeacher(teacherId) {
  if (!supabase || !teacherId) return { data: [], error: null }
  return supabase
    .from('admin_messages')
    .select('id, body, created_at, admin_id')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
}

export async function createAdminMessage(teacherId, body) {
  if (!supabase || !teacherId) return { error: new Error('Sin cliente') }
  const { data: u } = await supabase.auth.getUser()
  const adminId = u?.user?.id
  if (!adminId) return { error: new Error('Sin sesión') }
  return supabase.from('admin_messages').insert({
    admin_id: adminId,
    teacher_id: teacherId,
    body: (body || '').trim(),
  })
}

export async function findStudentIdByEmail(email) {
  if (!supabase) return { studentId: null, error: new Error('Sin cliente') }
  const { data, error } = await supabase.rpc('find_student_id_by_email', { p_email: (email || '').trim() })
  if (error) return { studentId: null, error }
  return { studentId: data || null, error: null }
}

export async function addTeacherStudent(teacherId, studentId) {
  if (!supabase || !teacherId || !studentId || teacherId === studentId) {
    return { error: new Error('Datos inválidos') }
  }
  return supabase.from('teacher_students').insert({ teacher_id: teacherId, student_id: studentId })
}

export async function listTeacherStudents(teacherId) {
  if (!supabase || !teacherId) return { students: [], error: null }
  const { data: links, error } = await supabase
    .from('teacher_students')
    .select('id, student_id, created_at')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
  if (error || !links?.length) return { students: [], error }
  const ids = links.map((l) => l.student_id)
  const { data: profs, error: e2 } = await supabase.from('profiles').select('id, email, full_name').in('id', ids)
  if (e2) return { students: [], error: e2 }
  const map = Object.fromEntries((profs || []).map((p) => [p.id, p]))
  const students = links.map((l) => ({
    linkId: l.id,
    studentId: l.student_id,
    email: map[l.student_id]?.email || l.student_id,
    fullName: map[l.student_id]?.full_name || '',
    createdAt: l.created_at,
  }))
  return { students, error: null }
}

export async function removeTeacherStudent(linkId) {
  if (!supabase) return { error: new Error('Sin cliente') }
  return supabase.from('teacher_students').delete().eq('id', linkId)
}

export async function createRoutineAssignment(teacherId, studentId, title, payload) {
  if (!supabase) return { error: new Error('Sin cliente') }
  return supabase.from('routine_assignments').insert({
    teacher_id: teacherId,
    student_id: studentId,
    title: title || 'Rutina',
    payload,
  })
}

export async function listAssignmentsForStudent(studentId) {
  if (!supabase || !studentId) return { data: [], error: null }
  return supabase
    .from('routine_assignments')
    .select('id, teacher_id, title, payload, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
}

export async function deleteRoutineAssignment(assignmentId) {
  if (!supabase) return { error: new Error('Sin cliente') }
  return supabase.from('routine_assignments').delete().eq('id', assignmentId)
}

/** Convierte filas de la BD a ítems de `rutinasAsignadas` (con assignmentId para sync). */
export function assignmentsToRutinasItems(rows, teacherLabelById) {
  const base = Date.now()
  return (rows || []).map((row, idx) => {
    const diasRaw = row.payload?.dias
    const diasArr = Array.isArray(diasRaw) && diasRaw.length > 0 ? diasRaw : [{ nombre: 'Día 1', ejercicios: [] }]
    const dias = diasArr.map((d, i) => {
      const nm = String(d?.nombre || `Día ${i + 1}`).trim() || `Día ${i + 1}`
      const ej = Array.isArray(d?.ejercicios) ? d.ejercicios.map((e) => String(e).trim()).filter(Boolean) : []
      return { id: `d_cloud_${row.id}_${i}`, nombre: nm, ejercicios: ej }
    })
    const label = teacherLabelById[row.teacher_id] || 'Entrenador'
    const fecha = (row.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
    return {
      id: `cloud_${row.id}_${base}_${idx}`,
      nombre: row.title || 'Rutina asignada',
      dias,
      _asignacion: {
        por: label,
        fecha,
        assignmentId: row.id,
      },
    }
  })
}
