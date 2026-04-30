# Configuración de cuentas (Supabase)

Para que los usuarios puedan crear cuenta, iniciar sesión y guardar su progreso en la nube:

1. **Crear proyecto en [Supabase](https://supabase.com)** (gratis).

2. **Variables de entorno**: copia `.env.example` a `.env` y rellena con las claves de tu proyecto (Dashboard → Settings → API):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. **Tabla para el progreso**: en el SQL Editor de Supabase, ejecuta:

```sql
create table if not exists public.user_data (
  user_id uuid references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

alter table public.user_data enable row level security;

drop policy if exists "Users can manage own data" on public.user_data;
create policy "Users can manage own data"
  on public.user_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Si al ejecutar ves que la tabla y la política ya existían, podés ignorar este bloque por completo: no hace falta repetirlo.

4. **Auth**: en Authentication → Providers deja habilitado "Email". Opcional: en Authentication → URL Configuration añade como "Redirect URL" la URL de tu app (ej. `http://localhost:5173/reset-password`) para el correo de recuperar contraseña.

Sin configurar Supabase, la app sigue funcionando con datos solo en el dispositivo (localStorage). En Configuración → Cuenta se puede iniciar sesión o crear cuenta cuando Supabase esté configurado.

5. **Perfil entrenador y rutinas asignadas** (opcional): para que un entrenador vincule alumnos por correo, envíe rutinas desde la app y el alumno las vea en **Rutina → Asignadas**, ejecuta en el SQL Editor (después de `user_data`):

```sql
-- Perfil por usuario (id = auth.users.id)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text default '',
  role text not null default 'alumno' check (role in ('alumno', 'profe', 'admin')),
  blocked_modules text[] not null default '{}',
  nav_force_visible text[] not null default '{}',
  created_at timestamptz default now()
);

-- Relación entrenador ↔ alumno (tabla antes de políticas que la referencian)
create table if not exists public.teacher_students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (teacher_id, student_id),
  check (teacher_id <> student_id)
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_select_linked_students"
  on public.profiles for select
  using (
    exists (
      select 1 from public.teacher_students ts
      where ts.teacher_id = auth.uid() and ts.student_id = profiles.id
    )
  );

alter table public.teacher_students enable row level security;

create policy "ts_select_teacher_or_student"
  on public.teacher_students for select
  using (teacher_id = auth.uid() or student_id = auth.uid());

create policy "ts_insert_teacher"
  on public.teacher_students for insert
  with check (teacher_id = auth.uid());

create policy "ts_delete_teacher"
  on public.teacher_students for delete
  using (teacher_id = auth.uid());

drop policy if exists "ts_select_admin" on public.teacher_students;
create policy "ts_select_admin"
  on public.teacher_students for select
  using (exists (select 1 from public.admin_accounts a where a.user_id = auth.uid()));

-- Rutinas enviadas por el entrenador (payload.dias = misma forma que el JSON de la app)
create table if not exists public.routine_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Rutina',
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table public.routine_assignments enable row level security;

create policy "ra_select_teacher_or_student"
  on public.routine_assignments for select
  using (teacher_id = auth.uid() or student_id = auth.uid());

create policy "ra_insert_teacher"
  on public.routine_assignments for insert
  with check (teacher_id = auth.uid());

create policy "ra_delete_teacher_or_student"
  on public.routine_assignments for delete
  using (teacher_id = auth.uid() or student_id = auth.uid());

-- Solo permitir insert si el alumno está vinculado al entrenador
create or replace function public.validate_routine_assignment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.teacher_students ts
    where ts.teacher_id = new.teacher_id and ts.student_id = new.student_id
  ) then
    raise exception 'El alumno tiene que estar vinculado antes de asignar rutinas.';
  end if;
  return new;
end;
$$;

drop trigger if exists routine_assignments_validate on public.routine_assignments;
create trigger routine_assignments_validate
  before insert on public.routine_assignments
  for each row
  execute function public.validate_routine_assignment();

-- Buscar id de alumno por email (solo si tu rol en profiles es profe)
create or replace function public.find_student_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_id uuid;
  v_norm text := lower(trim(both from coalesce(p_email, '')));
begin
  if length(v_norm) < 3 then
    return null;
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'profe' then
    return null;
  end if;

  select p.id into v_id
  from public.profiles p
  where lower(trim(both from coalesce(p.email, ''))) = v_norm
    and p.id <> auth.uid()
  limit 1;

  return v_id;
end;
$$;

revoke all on function public.find_student_id_by_email(text) from public;
grant execute on function public.find_student_id_by_email(text) to authenticated;
```

Orden: si `profiles` o `teacher_students` ya existían de un intento previo, podés borrarlas en un proyecto de prueba y volver a ejecutar, o usar `create table if not exists` y crear solo las políticas que falten.

Flujo: el alumno y el entrenador se registran e inician sesión al menos una vez (la app crea su fila en `profiles`). Un **administrador** (cuenta con `role = admin` en `profiles` y fila en `admin_accounts`, sincronizado por el SQL del punto 6; el **primer** admin se asigna con el `UPDATE` del final porque en el SQL Editor `auth.uid()` es null) marca quiénes son **entrenadores** (`profe`) desde la pantalla **Admin**. Cada entrenador entra a **Profe**, ve los avisos del admin, vincula alumnos por correo y envía rutinas. El alumno abre **Rutina → Asignadas** con la sesión iniciada y verá la rutina nueva.

6. **Administrador y mensajes a entrenadores** (ejecutá en SQL Editor si ya aplicaste el punto 5). Si ves `infinite recursion detected in policy for relation "profiles"`, re-ejecutá este bloque entero: las políticas de admin ya **no** leen `profiles` dentro de condiciones sobre `profiles`, sino la tabla `admin_accounts`.

```sql
-- Si venías de una versión anterior con auth_is_admin(), eliminá la función obsoleta
drop function if exists public.auth_is_admin();

-- Permitir rol admin en perfiles ya creados
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('alumno', 'profe', 'admin'));

-- Tabla auxiliar: evita recursión RLS (las políticas de «profiles» NO deben hacer sub-SELECT sobre «profiles»)
create table if not exists public.admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.admin_accounts enable row level security;

drop policy if exists "admin_accounts_read_own" on public.admin_accounts;
create policy "admin_accounts_read_own"
  on public.admin_accounts for select
  using (user_id = auth.uid());

create or replace function public.sync_admin_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.role = 'admin' then
    insert into public.admin_accounts (user_id) values (new.id) on conflict (user_id) do nothing;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if new.role = 'admin' then
      insert into public.admin_accounts (user_id) values (new.id) on conflict (user_id) do nothing;
    else
      delete from public.admin_accounts where user_id = old.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_admin on public.profiles;
create trigger profiles_sync_admin
  after insert or update of role on public.profiles
  for each row
  execute function public.sync_admin_account();

insert into public.admin_accounts (user_id)
select id from public.profiles where role = 'admin'
on conflict (user_id) do nothing;

-- El perfil solo se crea como alumno; solo un admin puede cambiar roles (y altas con otro rol)
create or replace function public.enforce_profile_role_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  select exists (select 1 from public.admin_accounts a where a.user_id = auth.uid()) into is_admin;

  if tg_op = 'INSERT' then
    if new.role <> 'alumno' and not is_admin then
      raise exception 'El perfil solo puede crearse con rol alumno.';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role and not is_admin then
    raise exception 'Solo un administrador puede cambiar el rol.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_rules on public.profiles;
create trigger profiles_role_rules
  before insert or update on public.profiles
  for each row
  execute function public.enforce_profile_role_rules();

-- Admin: ver y editar todos los perfiles (usa admin_accounts, sin tocar profiles en la condición)
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all"
  on public.profiles for select
  using (exists (select 1 from public.admin_accounts a where a.user_id = auth.uid()));

drop policy if exists "profiles_admin_update_any" on public.profiles;
create policy "profiles_admin_update_any"
  on public.profiles for update
  using (exists (select 1 from public.admin_accounts a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_accounts a where a.user_id = auth.uid()));

-- Mensajes del admin hacia un entrenador (solo destinatarios con rol profe)
create table if not exists public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

alter table public.admin_messages enable row level security;

drop policy if exists "am_select_teacher" on public.admin_messages;
create policy "am_select_teacher"
  on public.admin_messages for select
  using (teacher_id = auth.uid());

drop policy if exists "am_select_admin" on public.admin_messages;
create policy "am_select_admin"
  on public.admin_messages for select
  using (exists (select 1 from public.admin_accounts a where a.user_id = auth.uid()));

drop policy if exists "am_insert_admin" on public.admin_messages;
create policy "am_insert_admin"
  on public.admin_messages for insert
  with check (
    admin_id = auth.uid()
    and exists (select 1 from public.admin_accounts a where a.user_id = auth.uid())
  );

create or replace function public.validate_admin_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = new.teacher_id and role = 'profe') then
    raise exception 'Solo se pueden enviar mensajes a cuentas con rol entrenador.';
  end if;
  return new;
end;
$$;

drop trigger if exists admin_messages_validate_teacher on public.admin_messages;
create trigger admin_messages_validate_teacher
  before insert on public.admin_messages
  for each row
  execute function public.validate_admin_message_recipient();
```

**Módulos ocultos por usuario** (pestañas del menú; los `admin` ignoran esta lista):

```sql
alter table public.profiles add column if not exists blocked_modules text[] not null default '{}';
alter table public.profiles add column if not exists nav_force_visible text[] not null default '{}';
```

`nav_force_visible`: claves del menú que **sí** debe ver el usuario aunque el rol las oculte por defecto (el admin las desmarca en «Usuarios y roles»). Las ocultaciones extra siguen en `blocked_modules`.

**Menú por rol** (qué pestañas oculta cada rol por defecto; lo puede editar un admin en la app). Los usuarios pueden tener además `blocked_modules` como extras. Ejecutá después de tener `admin_accounts` (punto 6) para que las políticas de admin existan:

```sql
create table if not exists public.role_nav_hidden (
  role text primary key check (role in ('alumno', 'profe', 'admin')),
  hidden_keys text[] not null default '{}'
);

insert into public.role_nav_hidden (role, hidden_keys) values
  ('alumno', '{}'),
  ('profe', array['inicio', 'ejercicios', 'rutina', 'comida']::text[]),
  ('admin', '{}')
on conflict (role) do nothing;

alter table public.role_nav_hidden enable row level security;

drop policy if exists "role_nav_hidden_select_auth" on public.role_nav_hidden;
create policy "role_nav_hidden_select_auth"
  on public.role_nav_hidden for select
  to authenticated
  using (true);

drop policy if exists "role_nav_hidden_admin_update" on public.role_nav_hidden;
create policy "role_nav_hidden_admin_update"
  on public.role_nav_hidden for update
  using (exists (select 1 from public.admin_accounts a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_accounts a where a.user_id = auth.uid()));

drop policy if exists "role_nav_hidden_admin_insert" on public.role_nav_hidden;
create policy "role_nav_hidden_admin_insert"
  on public.role_nav_hidden for insert
  with check (exists (select 1 from public.admin_accounts a where a.user_id = auth.uid()));
```

**Lectura del perfil en la app** (si en Config ves «Rol: —» pero en SQL sí existe tu fila, ejecutá esto):

```sql
create or replace function public.get_my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select * from public.profiles where id = auth.uid() limit 1;
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;
```

La app intenta esta función primero y, si no existe, usa `select` directo sobre `profiles`.

**Primer administrador** (una vez, con tu correo ya registrado en la app). En el SQL Editor no hay sesión JWT, así que el trigger de roles permite este `UPDATE` y el trigger `profiles_sync_admin` inserta tu `user_id` en `admin_accounts`. **Cambiar el correo en Auth o en `profiles` no borra** rutinas, comidas ni demás tablas vinculadas al `id` de usuario; solo actualizá el campo coherente en todos lados si lo necesitás.

```sql
update public.profiles set role = 'admin' where lower(trim(email)) = lower(trim('tu-correo@ejemplo.com'));
```

Reemplazá `tu-correo@ejemplo.com` por el mail con el que iniciás sesión. Si ya tenías `role = 'admin'` en `profiles` pero la app fallaba, el `insert … select` del punto 6 rellena `admin_accounts`; igual podés forzar: `insert into public.admin_accounts (user_id) select id from public.profiles where lower(trim(email)) = lower(trim('tu-correo@ejemplo.com')) on conflict do nothing;`. Esa cuenta verá la pestaña **Admin** en la app.
