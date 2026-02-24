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

create policy "Users can manage own data"
  on public.user_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

4. **Auth**: en Authentication → Providers deja habilitado "Email". Opcional: en Authentication → URL Configuration añade como "Redirect URL" la URL de tu app (ej. `http://localhost:5173/reset-password`) para el correo de recuperar contraseña.

Sin configurar Supabase, la app sigue funcionando con datos solo en el dispositivo (localStorage). En Configuración → Cuenta se puede iniciar sesión o crear cuenta cuando Supabase esté configurado.
