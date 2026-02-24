# Mi rutina — Ejercicio y comida

App para registrar ejercicio, comidas, rutina de gimnasio y suplementos. Incluye resumen por día, estadísticas por período y (opcional) login con Supabase para guardar el progreso en la nube.

## Qué incluye

- **Inicio:** Calendario para elegir el día; ves lo que hiciste (rutina de gimnasio + ejercicios), suplementos del día, racha, metas y resumen del día. Más abajo: resumen por semana o mes con gráfico de calorías consumidas/quemadas.
- **Ejercicios:** Registrar actividad (nombre, tipo, duración, fecha). Historial con **filtro** por texto, tipo de actividad y rango de fechas.
- **Rutina:** Varias rutinas con días configurables; registrar series, repeticiones y peso. **Calendario** con días que entrenaste; al tocar un día ves la rutina de ese día. En **Progreso** podés elegir período (semana, mes o personalizado) para ver avance y tendencias.
- **Comida:** Registrar comidas por tipo (desayuno, almuerzo, etc.), calorías, proteínas y carbos.
- **Config:** Objetivo (mantener/bajar/subir peso), peso, metas de calorías y proteína, suplementos activos. Sección **Cuenta** para iniciar sesión o crear cuenta (requiere Supabase).

## Login y guardar progreso en la nube

Opcional: si configurás [Supabase](https://supabase.com), los usuarios pueden crear cuenta, iniciar sesión, recuperar contraseña y tener su progreso (ejercicios, comida, suplementos, config, rutinas) guardado en la nube. Ver **SUPABASE.md** para pasos y SQL. Sin Supabase la app funciona igual con datos solo en el dispositivo (localStorage).

## Cómo correr el proyecto

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` (o el puerto que indique Vite).

Build para producción:

```bash
npm run build
```

## Stack

- React 19, Vite 7, React Router
- Bulma (CSS)
- Supabase (opcional): auth y tabla `user_data` para sincronizar datos por usuario

## Estructura relevante

- `src/pages/` — Inicio, Ejercicios, Rutina, Comida, Config, Login, ResetPassword
- `src/context/AuthContext.jsx` — estado de login y funciones (signIn, signUp, resetPassword, etc.)
- `src/hooks/useStorage.js` — usa Supabase cuando hay usuario, si no localStorage
- `src/lib/supabase.js` — cliente Supabase (variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env`)
