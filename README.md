# Mi rutina — Ejercicio y comida

Aplicación web (**PWA**) para seguimiento fitness: actividad, rutina de gimnasio, nutrición, plan alimenticio de 30 días, peso y medidas, suplementos y consejos personalizados. Opcionalmente sincroniza con **Supabase** (cuenta, roles entrenador/admin y datos en la nube).

Repositorio: [`deboraq/ejercicio-comida`](https://github.com/deboraq/ejercicio-comida) · Deploy habitual: **Vercel** (push a `main`).

---

## Índice

1. [Resumen de funcionalidades](#resumen-de-funcionalidades)
2. [Roles y permisos](#roles-y-permisos)
3. [Navegación y diseño](#navegación-y-diseño)
4. [Módulos de la app](#módulos-de-la-app)
5. [Plan alimenticio (Mi plan)](#plan-alimenticio-mi-plan)
6. [Catálogo de alimentos](#catálogo-de-alimentos)
7. [Consejos inteligentes](#consejos-inteligentes)
8. [Cuenta, nube y offline](#cuenta-nube-y-offline)
9. [Exportación de datos](#exportación-de-datos)
10. [Stack y scripts](#stack-y-scripts)
11. [Variables de entorno](#variables-de-entorno)
12. [Cómo correr y desplegar](#cómo-correr-y-desplegar)
13. [Estructura del proyecto](#estructura-del-proyecto)
14. [Documentación adicional](#documentación-adicional)

---

## Resumen de funcionalidades

| Área | Qué podés hacer |
|------|------------------|
| **Inicio** | Dashboard del día: calorías, macros, consejos, calendario, actividad, suplementos, peso/IMC, medidas, gráficos, racha, accesos rápidos |
| **Ejercicios** | Actividad libre (cardio, fuerza, deportes…): duración, distancia, kcal estimadas o manuales, historial con filtros |
| **Rutina** | Rutinas propias o asignadas por el profe: calendario, registrar series/reps/peso, configurar días/ejercicios, progreso, PDF |
| **Comida** | Diario nutricional, hidratación, favoritos, historial, export; pestaña **Mi plan** integrada |
| **Config** | Objetivo, TDEE/metas, peso y medidas, suplementos, plan desde objetivo, cuenta, export global |
| **Profe** | Alumnos, catálogo de ejercicios, plantillas, envío de rutinas (con Supabase) |
| **Admin** | Mensajes a profes, menú por rol, usuarios y módulos bloqueados |

---

## Roles y permisos

| Rol | Descripción |
|-----|-------------|
| **Alumno** (default) | Inicio, Ejercicios, Rutina, Comida, Config |
| **Profe** | Lo anterior + panel **Profe** (alumnos, rutinas, catálogo) |
| **Admin** | Panel **Admin** + puede ver Profe; no se le ocultan módulos por rol |

- **ModuleGate:** si un módulo está bloqueado para tu rol o usuario, la app te redirige a una ruta permitida.
- **Menú por rol:** el admin configura qué pestañas oculta cada rol (`role_nav_hidden`) y puede bloquear/forzar módulos por usuario (`profiles.blocked_modules`, `nav_force_visible`).

Sin Supabase configurado: solo modo **local** (sin login); Profe/Admin no aplican.

---

## Navegación y diseño

- **Tema:** interfaz oscura tipo **Titanium** (CSS propio + Bulma).
- **Escritorio:** barra lateral colapsable (Inicio, Ejercicios, Rutina, Comida; Profe/Admin si corresponde; Config abajo).
- **Móvil:** menú hamburguesa (drawer) + **barra inferior** de acceso rápido a módulos principales.
- **Notificaciones:** campana in-app (avisos admin → profe, etc.).
- **PWA:** service worker (Workbox) para cachear assets y usar la app instalada; banner de **sin conexión / sincronizando** cuando hay cola offline.
- **Sesión:** al cambiar de usuario la app se remonta para no mezclar datos en memoria; aviso si otra cuenta dejó datos locales.

**Rutas**

| Ruta | Página |
|------|--------|
| `/` | Inicio |
| `/ejercicios` | Ejercicios |
| `/rutina` | Rutina |
| `/comida` | Comida (Registrar / Mi plan / Historial) |
| `/plan-mes1` | Redirige a `/comida` con pestaña **Mi plan** |
| `/config` | Configuración |
| `/profe` | Panel entrenador |
| `/admin` | Panel administración |
| `/login` | Iniciar sesión / registrarse |
| `/reset-password` | Nueva contraseña |

---

## Módulos de la app

### Inicio (`/`)

- Elegir **día** en calendario y ver resumen de ese día.
- **Calorías** consumidas vs quemadas, **proteínas, carbohidratos, grasas**.
- Hasta **1 consejo de hoy** + **1 de la semana** (prioridad).
- Listado de **ejercicios libres** y **registros de rutina** del día (plegables).
- **Suplementos** del día (checklist según Config).
- **Peso e IMC**, **medidas corporales** (chips y deltas vs toma anterior).
- Gráfico de calorías por período: semana, 15 días, mes o rango personalizado.
- **Racha** de días con actividad registrada.
- **Accesos favoritos** personalizables (atajos a Comida, Plan, Historial, etc.).

### Ejercicios (`/ejercicios`)

- Tipos agrupados: Cardio, Fuerza, Flexibilidad, Deportes, Otro.
- **Duración** (min), **distancia** (km) cuando aplica, **kcal** (estimadas según peso en Config o manual).
- Fecha, notas; **editar / eliminar**; historial con **filtro** por texto, tipo y fechas.
- Export **JSON** del historial.
- UI compacta en móvil.

### Rutina (`/rutina`)

**Dos orígenes**

1. **Mis rutinas:** las creás y editás vos.
2. **Asignadas:** las envía el entrenador (nube); vista centrada en calendario.

**Pestañas (rutinas propias)**

| Pestaña | Función |
|---------|---------|
| **Calendario** | Días que entrenaste; detalle del día |
| **Registrar** | Series, reps, peso; pendientes vs hechos; + otra tanda |
| **Configurar** | Días de la rutina; ejercicios; reordenar por arrastre |
| **Progreso** | Por ejercicio: última vs anterior, mejor peso, tendencia |

- Varias rutinas guardadas; **rutina activa**.
- **Exportar PDF** de la rutina activa (jsPDF).
- Export **Excel / CSV / JSON** de registros de gym (JSON incluye plan de rutinas).

### Comida (`/comida`)

Tres vistas (pestañas):

1. **Registrar comida** — diario del día elegido.
2. **Mi plan** — tablero del plan alimenticio (ver [Plan alimenticio](#plan-alimenticio-mi-plan)).
3. **Historial completo** — por fechas, filtros de período, export.

**Registro**

- Momentos: **Desayuno → Almuerzo → Merienda → Cena** (legacy “Snack” → Merienda).
- Búsqueda en catálogo (~650 ítems) o **entrada manual** (kcal, P, C, G).
- **Cantidad** con fracciones (`0.5`, `0.25`…) sobre porciones de referencia.
- Varios ítems por comida; editar registro existente.
- Barras / anillos de **metas** (kcal, proteína, carbos, grasas) vs Config.
- **Balance energético** del día (incluye calorías quemadas por ejercicio/rutina).
- **Hidratación:** vasos / +250 ml por día (`hidratacionDia`).
- **Favoritos** en alimentos del catálogo (`comidaFavoritos`).
- Consejos (mismo límite 1+1 que Inicio).
- Export desde historial: **Excel, CSV, JSON**.

**Sincronización plan ↔ comida**

- Al marcar comidas en **Mi plan**, se crean/actualizan registros en Comida con `planRef`.
- Desmarcar o borrar alinea checks del plan y registros (evita duplicados y desfaces).

### Config (`/config`)

Secciones en **cajas plegables** (alumno):

1. **Cuenta** — login, nombre, cerrar sesión (Supabase).
2. **Tu objetivo** — bajar peso / mantener / aumentar / ganar músculo.
3. **Seguimiento → Peso** — historial (`pesoHistorial`); el último peso actualiza `config.pesoKg`.
4. **Seguimiento → Medidas** — cuello, pecho, cinturas, cadera, brazos, muslos, pantorrillas (`medidasHistorial`).
5. **Perfil → Datos para cálculos** — altura, sexo, edad, **nivel de actividad** (TDEE Mifflin–St Jeor).
6. **Perfil → Metas diarias** — kcal y macros (sugeridas según objetivo).
7. **Suplementos** — cuáles aparecen en Inicio (proteína, creatina, vitamina D, omega 3, etc.).
8. **Plan desde objetivo** — enlace al plan guiado de 30 días según perfil.
9. **Exportar datos** — descarga global comidas, gym y actividad (Excel/CSV/JSON).

**Profe en Config:** solo sección **Cuenta**.

### Profe (`/profe`)

Requiere Supabase y rol `profe` (o admin).

- **Alumnos** — vincular por correo, ver progreso.
- **Catálogo de ejercicios** — `profeCatalogoEjercicios`, categorías, favoritos.
- **Rutinas / plantillas** — armado y **envío** al alumno (`routine_assignments` → `rutinasAsignadas` local).
- **Historial** de envíos.
- **Supervisión** (admin): relaciones entrenador–alumno.
- Notas privadas, feedback de alumnos.

### Admin (`/admin`)

- Mensajes a profesores.
- **Menú por rol** — qué módulos oculta cada rol.
- **Usuarios y roles** — alumno / profe / admin; módulos bloqueados o forzados por usuario.

### Auth

- **Login / registro** con email y contraseña.
- **Recuperar contraseña** (`/reset-password`).
- Perfil en tabla `profiles` (rol, bloqueos de navegación, etc.).

---

## Plan alimenticio (Mi plan)

Integrado en **Comida → Mi plan** (también accesible vía `/plan-mes1`).

### Tipos de plan

- **Plan del sistema (guía):** menú de **30 días** según sexo, peso y objetivo en Config (variantes: bajar grasa, mantener, etc.).
- **Plan propio:** menú editable; plantilla vacía o copia desde la guía; editor por día y comida.
- **Biblioteca:** varios planes guardados (`planesNutricion`); elegir activo, crear nuevo, eliminar.

### Tablero (Kanban)

- **Zoom:** 1 día, 2 días, **Semana**, **Mes** (scroll horizontal en vistas amplias).
- **Semanas 1–4** del plan de 30 días.
- **Esquema de comidas:** 5 comidas (con colación), 4 comidas, o **ayuno 16:8**.
- Cada comida: **Opción 1 y Opción 2** (en semana/mes/2 días se ven ambas en escritorio).
- Marcar **Hecho**, desmarcar, **marcar/desmarcar todo el día**, quitar comida del día, **colación extra**.
- Sincroniza con el **registro de Comida** del día calendario correspondiente.
- Ajuste **“Hoy = día X”** del plan si la fecha de inicio y tus marcas no coinciden.
- Tips diarios del plan + tip general del nutricionista según perfil.
- **Móvil:** vista agenda (acordeones por comida, zoom 1 día optimizado).

### Datos del plan

| Clave | Contenido |
|-------|-----------|
| `config.planMes1Inicio` | Fecha inicio día 1 |
| `config.planMes1Variante`, `planMes1Esquema`, … | Variante y esquema |
| `planMes1Estado` | `checks`, `omitidos`, `extras` |
| `planPropio` | Menú editable (plan propio) |
| `planesNutricion` / `planNutricionActivoId` | Biblioteca de planes |

---

## Catálogo de alimentos

- Archivo: `src/utils/referenciaComidas.js` (~**650** ítems).
- Categorías: comidas saludables, verduras, almuerzo, **Salida / Social** (hamburguesa, pinta, delivery…), frutas, proteínas, pastas, empanadas, etc.
- Cada ítem: kcal, proteínas, carbohidratos, grasas, porción, **aliases**.
- Búsqueda sin acentos, varias palabras, sinónimos (frutilla/fresa, pinta/cerveza…).

Listado detallado: [`LISTADO_COMIDAS.md`](LISTADO_COMIDAS.md).

---

## Consejos inteligentes

- Motor: `src/utils/consejos.js`; UI: `ConsejosPanel` / banners en Inicio y Comida.
- Máximo **1 consejo “hoy”** + **1 “semana”** (mayor prioridad).
- Tipos: nutrición, balance, salud, hábitos, recuperación, rendimiento, descanso, ejercicio, medidas, perfil.
- Usan comidas, ejercicios, rutina, peso, medidas, objetivo, TDEE y metas.

Detalle de disparadores: [`DOCUMENTACION.md`](DOCUMENTACION.md) §9.

---

## Cuenta, nube y offline

### Modo local

- Sin `.env` de Supabase: todo en **localStorage** por dispositivo/navegador.
- No hay login; Profe/Admin deshabilitados.

### Modo nube (Supabase)

- Auth + tabla **`user_data`** (clave/valor JSON por usuario).
- Hook **`useStorage`:** merge local ↔ nube; la nube manda al iniciar si hay datos remotos; subida al guardar.
- Claves por usuario en localStorage (`scopedStorageKey`) para no mezclar cuentas en el mismo navegador.
- Cola **offline:** cambios pendientes se envían al volver online (`offlineDataSync`).
- Dedupe de registros (comida, rutina, plan) al fusionar.

Configuración SQL, RLS, tablas profe/admin: [`SUPABASE.md`](SUPABASE.md).

### Claves sincronizadas (`user_data`)

| Key | Contenido |
|-----|-----------|
| `config` | Objetivo, peso, altura, sexo, edad, actividad, metas, suplementos, plan activo |
| `ejercicios` | Actividad libre |
| `comida` | Registros de comida |
| `suplementos` | Checklist diario por fecha |
| `rutinas` | Rutinas propias |
| `rutinasAsignadas` | Rutinas del profe |
| `rutinaActivaId` | Rutina seleccionada |
| `rutinaPesos` | Series/reps/peso por sesión |
| `pesoHistorial` | Pesajes |
| `medidasHistorial` | Medidas corporales |
| `planMes1Estado` | Marcas del plan |
| `planPropio` | Menú plan propio |
| `planesNutricion` | Biblioteca de planes |
| `planNutricionActivoId` | ID plan activo |
| `comidaFavoritos` | Favoritos del catálogo |
| `hidratacionDia` | Vasos por fecha |
| `inicioAccesosFavoritos` | Accesos rápidos Inicio |
| `profeCatalogoEjercicios`, `profePlantillasRutina`, … | Datos del panel Profe |

Tablas solo nube (no `useStorage`): `profiles`, `teacher_students`, `routine_assignments`, `admin_messages`, `role_nav_hidden`, etc.

---

## Exportación de datos

| Origen | Formatos |
|--------|----------|
| Comida (historial o Config) | Excel, CSV, JSON |
| Rutina / gym | Excel, CSV, JSON (+ rutinas en JSON) |
| Ejercicios (actividad) | Excel, CSV, JSON |
| Rutina activa | **PDF** |
| Ejercicios (página) | JSON |
| Profe (plantilla) | JSON (compartir/importar) |

---

## Stack y scripts

| Capa | Tecnología |
|------|------------|
| UI | React 19, Bulma, CSS Titanium (`App.css`, `PlanMes1.css`, `responsive-global.css`) |
| Build | Vite 7 |
| Rutas | React Router 7 |
| Auth / DB | Supabase (opcional) |
| Export | SheetJS (`xlsx`), jsPDF |
| PWA | `vite-plugin-pwa` + Workbox |

```bash
npm install          # dependencias
npm run dev          # desarrollo (Vite --host)
npm run dev:lan      # igual; muestra URL LAN para celular
npm run dev:celu     # script helper para probar en móvil
npm run build        # producción → dist/
npm run preview      # previsualizar build
npm run lint         # ESLint
```

---

## Variables de entorno

Copiá `.env.example` → `.env`:

| Variable | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima (pública en el cliente) |

Sin estas variables la app funciona en modo **solo local**.

---

## Cómo correr y desplegar

### Local

```bash
npm install
npm run dev
```

Abrí `http://localhost:5173` (o el puerto que indique Vite).

### Celular en la misma Wi‑Fi

```bash
npm run dev:lan
```

Usá la URL `http://192.168.x.x:5173` que imprime la terminal.

### Producción (Vercel)

1. Push a `main` en GitHub.
2. Vercel ejecuta `npm run build` y publica `dist/`.
3. Configurá las variables Supabase en el panel de Vercel si usás nube.

Guía paso a paso: [`VERCEL.md`](VERCEL.md).  
Subir el repo: [`GITHUB_PASOS.md`](GITHUB_PASOS.md).

---

## Estructura del proyecto

```
src/
  App.jsx                 # Layout, rutas, sidebar, bottom nav
  main.jsx                # PWA + offline sync bootstrap
  pages/                  # Inicio, Ejercicios, Rutina, Comida, Config, Profe, Admin, Login…
  components/             # UI (ComidaTitanium, MiPlanKanban, ConsejosPanel, ModuleGate…)
  context/                # Auth, Profile, RoleNav, Notifications, MobileNav
  hooks/                  # useStorage, useMyProfile, useLocalStorage
  utils/                  # consejos, referenciaComidas, planMes1, planRegistroSync, export…
  data/                   # planMes1Semanas, tips, seeds profe
  lib/                    # supabase.js, profeDb.js
  styles/                 # responsive-global.css
public/                   # manifest, íconos
vercel.json               # SPA rewrite → index.html
```

Archivos clave del plan: `MiPlanKanban.jsx`, `PlanMes1Panel.jsx`, `planMes1Kanban.js`, `planRegistroSync.js`, `planPropio.js`.

---

## Documentación adicional

| Archivo | Contenido |
|---------|-----------|
| [`DOCUMENTACION.md`](DOCUMENTACION.md) | Documentación técnica ampliada (módulos, TDEE, consejos, mapa de archivos) |
| [`SUPABASE.md`](SUPABASE.md) | SQL, auth, tablas profe/admin, RLS |
| [`VERCEL.md`](VERCEL.md) | Deploy en Vercel |
| [`LISTADO_COMIDAS.md`](LISTADO_COMIDAS.md) | Catálogo completo de alimentos |
| [`GITHUB_PASOS.md`](GITHUB_PASOS.md) | GitHub y remoto |

---

*README alineado al estado actual de la app (plan 30 días, sync plan–comida, roles Profe/Admin, PWA y exportaciones).*
