# Fitness Pro — Documentación completa del sistema

App de seguimiento fitness (ejercicio, rutina de gimnasio, comida, medidas corporales y consejos).  
Repo: `ejercicio-comida` · Deploy típico: Vercel (push a `main`).

---

## 1. Qué es y para quién

**Fitness Pro** permite a un alumno registrar actividad, comidas y medidas; recibir consejos según lo registrado; y (si hay nube) vincularse con un entrenador (Profe) y ser administrado por un Admin.

| Rol | Uso principal |
|-----|----------------|
| **Alumno** | Usa Inicio, Ejercicios, Rutina, Comida, Config |
| **Profe** | Panel Profe: alumnos, catálogo, plantillas, envío de rutinas |
| **Admin** | Mensajes a profes, menú por rol, usuarios/roles/módulos |

Sin Supabase configurado la app funciona en **modo local** (datos en el navegador, sin cuenta).

---

## 2. Stack técnico

| Capa | Tecnología |
|------|------------|
| UI | React 19 + Bulma + CSS propio (`App.css`) — tema Titanium Dark |
| Build | Vite 7 |
| Rutas | React Router |
| Auth / DB | Supabase (Auth + Postgres + RLS) |
| PDF | jsPDF (exportar rutina) |
| Hosting | Vercel (`vercel.json`: build → `dist`, SPA rewrite) |
| Persistencia | `useStorage`: localStorage y/o tabla `user_data` |

Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

---

## 3. Navegación y layout

- **Desktop:** sidebar colapsable (Inicio, Ejercicios, Rutina, Comida; Profe/Admin si aplica; Config abajo).
- **Móvil:** menú hamburguesa (drawer). Config aparece en la lista del drawer.
- **ModuleGate:** si un módulo está bloqueado para el rol/usuario, redirige a una ruta permitida.
- **Campana:** notificaciones in-app (avisos al profe, etc.).

---

## 4. Módulo Inicio (`/`)

**Para qué:** dashboard del día (o día elegido en el calendario).

**Qué muestra:**
- Calorías consumidas / quemadas, proteínas, carbohidratos del día.
- **Consejos** (máx. 1 de hoy + 1 de la semana).
- Calendario mensual; al tocar un día se ve el detalle.
- Actividad del día: ejercicios libres + registros de rutina (grupos plegables).
- Suplementos del día (checklist según lo activado en Config).
- Resumen **Peso e IMC** (altura, rango orientativo, gasto/día si está calculado).
- Resumen **Medidas corporales** (chips con delta vs. toma anterior).
- Gráfico de calorías por período (semana / 15 días / mes / personalizado).
- Racha de días registrando.
- Accesos rápidos a Comida / Ejercicios / etc.

**Datos que lee:** `ejercicios`, `comida`, `suplementos`, `rutinaPesos`, `pesoHistorial`, `medidasHistorial`, `config`.

---

## 5. Módulo Ejercicios (`/ejercicios`)

**Para qué:** registrar actividad libre (caminata, bici, natación, deportes, etc.) — no es la rutina de mancuernas.

**Qué tiene:**
- Selector de tipo (agrupado: Cardio, Fuerza, Flexibilidad, Deportes, Otro).
- Duración (min) y/o distancia (km) según el tipo.
- Estimación de kcal (según peso en Config) o kcal manual.
- Fecha, notas.
- Historial filtrable por período; editar / eliminar.
- Tarjetas compactas en móvil.

**Storage:** `ejercicios`, `config.pesoKg`.

---

## 6. Módulo Rutina (`/rutina`)

**Para qué:** rutina de gimnasio (días, ejercicios, series, reps, pesos).

### Dos orígenes
1. **Mis rutinas (propias):** las creás y editás vos.
2. **Asignadas:** las manda el entrenador desde Profe (nube). En asignadas la vista se centra en calendario (sin configurar/registrar/progreso de “mis rutinas”).

### Pestañas (solo propias)
| Pestaña | Función |
|---------|---------|
| **Calendario** | Días entrenados; ver qué hiciste ese día |
| **Registrar** | Cargar series/reps/peso del día; pendientes vs “Ya hechos”; + otra tanda; historial con calendario propio |
| **Configurar** | Días de la rutina (renombrar/reordenar/quitar); ejercicios; editar series/reps; **arrastrar** para reordenar |
| **Progreso** | Por ejercicio: última vs anterior, mejor peso, tendencia ↑↓—; filtro de fechas |

También: crear/eliminar rutinas, rutina activa, **Exportar PDF**.

**Storage:** `rutinas`, `rutinasAsignadas`, `rutinaActivaId`, `rutinaPesos`, `config`.

---

## 7. Módulo Comida (`/comida`)

**Para qué:** diario de comidas y macros del día.

### Momentos del día
`Desayuno` → `Almuerzo` → `Merienda` → `Cena`  
(Los viejos “Snack” se muestran como Merienda.)

### Registro
1. Elegís momento + fecha.
2. Buscás en la **base de referencia** (~642 alimentos) o cargás a mano.
3. **Cant.** admite fracciones: `0.5` = media porción, `0.25` = cuarto (escala kcal/P/C).
4. Varias filas por entrada; total de la entrada; guardar al historial.
5. Historial de hoy agrupado por momento (+ “Agregar” si falta uno).
6. Historial completo por período.
7. Barras de progreso vs metas (kcal, proteína, carbos, grasas).
8. Consejos (máx. 1 hoy + 1 semana).

**Storage:** `comida`, más lectura de `ejercicios`, `rutinaPesos`, `medidasHistorial`, `config` para consejos.

### Base de comidas (referencia)

Archivo de código: `src/utils/referenciaComidas.js` — **642** ítems.

**Listado completo con kcal / proteínas / carbohidratos / porción de cada alimento:** ver [`LISTADO_COMIDAS.md`](LISTADO_COMIDAS.md).

| Categoría | Cantidad aprox. |
|-----------|-----------------|
| Comidas saludables | 121 |
| Verduras | 63 |
| Almuerzo | 50 |
| Frutas | 41 |
| Desayuno / Lácteos | 37 |
| Pizza (1 triángulo) | 36 |
| Carbohidratos | 33 |
| Snacks / Bebidas | 33 |
| Tartas (1 porción) | 32 |
| Empanadas (1 unidad) | 31 |
| Pastas | 28 |
| Panificados | 27 |
| Proteínas | 23 |
| Platos típicos | 22 |
| Lácteos y quesos | 20 |
| Harinas | 17 |
| Fiambres | 15 |
| Milanesas y rebozados | 13 |

Cada ítem: nombre, categoría, kcal, proteínas (g), carbohidratos (g), texto de porción.

**Búsqueda:** sin acentos; varias palabras (ej. “tarta acelga pollo”, “media palta”); prioriza coincidencias completas.

**Ejemplos recientes:** media/entera/cuarto de palta; tarta de acelga y pollo; tarta de verdura/espinaca y pollo.

---

## 8. Módulo Config (`/config`)

**Para qué:** perfil, metas y seguimiento corporal. Todo el seguimiento va en **cajas plegables** (cerradas por defecto; CTA tipo “Registrar…” / “Editar…”).

### Secciones (alumno)
1. **Cuenta** — login / nombre / cerrar sesión (si hay Supabase).
2. **Tu objetivo** — Bajar de peso / Mantener / Aumentar / Ganar músculo.
3. **Datos corporales** (plegable) — peso, altura, sexo, edad, nivel de actividad → IMC, rango kg, TMB, gasto diario (TDEE).
4. **Metas diarias** (plegable) — kcal, proteína, carbos, grasas; botón “Aplicar sugerencia” según TDEE + objetivo.
5. **Peso corporal** (plegable) — form + gráfica + historial (`pesoHistorial`).
6. **Medidas corporales** (plegable) — cm + gráfica por campo + historial (`medidasHistorial`).
7. **Suplementos** (plegable) — cuáles aparecen en Inicio.

### Niveles de actividad (multiplicador TDEE)
| Nivel | Factor | Idea |
|-------|--------|------|
| Sedentario | 1.2 | Poco ejercicio |
| Ligero | 1.375 | 1–3 días/semana |
| Moderado | 1.55 | 3–5 días |
| Alto | 1.725 | 6–7 intenso |
| Muy alto | 1.9 | Trabajo físico + entreno |

Fórmula basal: **Mifflin–St Jeor**. Ajuste de metas: bajar ≈ −400 kcal; aumentar ≈ +350; ganar músculo ≈ +250; proteína ~1.4–2.0 g/kg según objetivo.

### Campos de medidas (cm)
Cuello, pecho, cintura alta, cintura baja, cadera, brazo izq/der, muslo izq/der, pantorrilla izq/der.  
Todos opcionales por toma.

**Profe en Config:** solo cuenta (sin secciones de alumno).

---

## 9. Sistema de consejos

**Archivos:** `src/utils/consejos.js`, UI `ConsejosPanel.jsx`.  
**Dónde:** Inicio y Comida.  
**Límite actual:** **1 consejo de hoy** + **1 de la semana** (el de mayor prioridad).

### Datos que mira
- Comidas del día / semana (momentos, kcal, proteína, carbos).
- Ejercicios + rutina (minutos, kcal quemadas, tipo Cardio/Fuerza…).
- Historial de medidas (deltas, días desde última toma).
- Perfil: objetivo, peso, altura, IMC, TDEE, actividad, metas.

### Tipos de consejo

| Tipo | Ejemplos de disparo |
|------|---------------------|
| **comida** | No registraste comidas; faltan momentos; poca proteína; pocas meriendas en la semana |
| **ejercicio** | Día sin actividad; cardio + pocos carbos; fuerza + poca proteína; &lt;3 días activos en la semana |
| **balance** | Muy por encima/debajo de la meta kcal según objetivo; excedente o déficit fuerte vs quemadas |
| **medidas** | Sin tomas; hace +14 días; bajó cintura; subieron brazos; asimetría brazo/muslo; recomposición |
| **perfil** | Falta altura/actividad; tip de IMC vs objetivo; sugerencia de kcal/TDEE |
| **habito** | Buen ritmo de registros en la semana |

---

## 10. Módulo Profe (`/profe`)

Solo con Supabase y rol profe (o admin en supervisión).

**Tabs típicos:**
- **Alumnos** — vincular / ver alumnos.
- **Ejercicios** — catálogo del entrenador (`profeCatalogoEjercicios`).
- **Rutinas** — plantillas y armado/envío (`profePlantillasRutina` → `routine_assignments`).
- **Historial** — envíos.
- **Supervisión** (admin) — relaciones entrenador–alumno.

Avisos del admin llegan por la campana / mensajes.

---

## 11. Módulo Admin (`/admin`)

- Mensajes a profes.
- **Menú por rol** — qué módulos oculta cada rol (`role_nav_hidden`).
- **Usuarios y roles** — asignar alumno/profe/admin; módulos bloqueados / forzados por usuario.

---

## 12. Persistencia (claves)

| Key | Contenido |
|-----|-----------|
| `config` | Objetivo, peso, altura, sexo, edad, actividad, metas, suplementosActivos |
| `ejercicios` | Actividad libre |
| `comida` | Registros de comida |
| `suplementos` | Checklist diario |
| `rutinas` | Plantillas propias |
| `rutinasAsignadas` | Copia local de asignadas |
| `rutinaActivaId` | ID activa |
| `rutinaPesos` | Sesiones de gym |
| `pesoHistorial` | Peso en el tiempo |
| `medidasHistorial` | Circunferencias |
| `profeCatalogoEjercicios` | Catálogo profe |
| `profePlantillasRutina` | Plantillas profe |

Con sesión: se sincronizan en Supabase `user_data` (espejo también en localStorage).  
Solo UI local: `app-sidebar-collapsed`.

Tablas nube (no useStorage): `profiles`, `teacher_students`, `routine_assignments`, `admin_messages`, `role_nav_hidden`, etc. (ver `SUPABASE.md`).

---

## 13. Auth

- `/login` — iniciar sesión / crear cuenta.
- `/reset-password` — nueva contraseña.
- Perfil: `profiles.role` (default alumno).

---

## 14. Cómo se despliega

1. Push a `main` en GitHub (`deboraq/ejercicio-comida`).
2. Vercel (proyecto conectado) construye con `npm run build` y publica `dist`.
3. En Vercel: configurar env de Supabase si usás nube.

---

## 15. Archivos clave (mapa)

```
src/App.jsx, main.jsx
src/pages/{Inicio,Ejercicios,Rutina,Comida,Config,Profe,Admin,Login,ResetPassword}.jsx
src/utils/{consejos,referenciaComidas,composicion,medidas,calorias,estadisticas,navModules}.js
src/components/{ConsejosPanel,SeguimientoCaja,PesoSeguimiento,MedidasSeguimiento,AppNavMenu,...}.jsx
src/hooks/useStorage.js
src/lib/{supabase,profeDb}.js
vercel.json, SUPABASE.md, VERCEL.md
```

---

*Documento alineado al estado del código en el commit de porciones fraccionarias / menos consejos / cajas plegables de seguimiento.*
