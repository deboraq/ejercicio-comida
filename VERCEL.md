# Deploy en Vercel — Paso a paso

Guía para publicar "Mi rutina" en Vercel y tener una URL que puedas abrir desde el celular o cualquier PC.

---

## 1. Crear cuenta en Vercel (si no tenés)

1. Entrá a **[vercel.com](https://vercel.com)**.
2. Clic en **Sign Up**.
3. Elegí **Continue with GitHub** y autorizá a Vercel para acceder a tu cuenta de GitHub.

---

## 2. Importar el proyecto desde GitHub

1. En el panel de Vercel, clic en **Add New…** → **Project**.
2. En la lista de repositorios, buscá **ejercicio-comida** (o el nombre de tu repo).
3. Si no aparece, clic en **Import Git Repository** y pega la URL del repo, por ejemplo:  
   `https://github.com/deboraq/ejercicio-comida`
4. Clic en **Import** del repo que quieras usar.

---

## 3. Configurar el proyecto (dejar lo que Vercel sugiere)

Vercel suele detectar solo que es un proyecto **Vite**:

- **Framework Preset:** Vite (si no lo detecta, elegilo a mano).
- **Root Directory:** dejalo en blanco (raíz del repo).
- **Build Command:** `npm run build` (por defecto).
- **Output Directory:** `dist` (por defecto para Vite).
- **Install Command:** `npm install` (por defecto).

No hace falta tocar nada más. Clic en **Deploy**.

---

## 4. Esperar el deploy

- Vercel va a clonar el repo, instalar dependencias y ejecutar `npm run build`.
- Al terminar te muestra la URL de la app, por ejemplo:  
  `https://ejercicio-comida-xxxx.vercel.app`

---

## 5. Abrir la app desde el celular u otra PC

- Copiá esa URL y abrila en el navegador del celular o en otra computadora.
- Si configuraste un dominio propio en Vercel, usá ese en su lugar.

---

## Variables de entorno (Supabase)

Si usás Supabase (login y datos en la nube):

1. En Vercel, entrá a tu proyecto → **Settings** → **Environment Variables**.
2. Agregá:
   - **Name:** `VITE_SUPABASE_URL`  
     **Value:** la URL de tu proyecto en Supabase (ej. `https://xxxx.supabase.co`).
   - **Name:** `VITE_SUPABASE_ANON_KEY`  
     **Value:** la clave anónima (anon key) de Supabase.
3. Guardá y hacé un **Redeploy** (Deployments → los tres puntos del último deploy → Redeploy).

---

## Actualizar la app después

Cada vez que hagas **push** a la rama que conectaste (por ejemplo `main`), Vercel hace un nuevo deploy automático. No tenés que hacer nada más.

---

## Resumen rápido

| Paso | Acción |
|------|--------|
| 1 | Cuenta Vercel con GitHub |
| 2 | Add New → Project → importar repo **ejercicio-comida** |
| 3 | Dejar Framework: Vite, Build: `npm run build`, Output: `dist` → Deploy |
| 4 | Copiar la URL que te da Vercel |
| 5 | Abrir esa URL en el celular o en otra PC |

Si algo no funciona (error de build, 404, etc.), en Vercel en **Deployments** podés ver los logs del build para revisar el error.
