# Subir el proyecto a GitHub — Paso a paso

## 1. Crear el repositorio en GitHub

1. Entra en **https://github.com** e inicia sesión.
2. Arriba a la derecha, haz clic en **"+"** → **"New repository"**.
3. Rellena:
   - **Repository name:** por ejemplo `ejercicio-comida` (o el nombre que quieras).
   - **Description:** opcional, ej. "App de ejercicio, comida y rutina".
   - **Public** (o Private si quieres que sea privado).
   - **No** marques "Add a README", "Add .gitignore" ni "Choose a license" (el proyecto ya tiene archivos).
4. Clic en **"Create repository"**.
5. En la página del repo nuevo, copia la **URL** (ej. `https://github.com/TU_USUARIO/ejercicio-comida.git`). La usarás en el paso 4.

---

## 2. Inicializar Git en tu carpeta del proyecto

En la terminal, desde la carpeta del proyecto:

```bash
cd /Users/deboraquinteros/Proyectos/Ejercicio
git init
```

---

## 3. Añadir todos los archivos y hacer el primer commit

```bash
git add .
git status
git commit -m "Primer commit: app ejercicio, comida, rutina y login"
```

(Si `git status` muestra algo que no quieras subir, quítalo del `.gitignore` antes de hacer `git add .`.)

---

## 4. Conectar con GitHub y subir

Sustituye `TU_USUARIO` y `NOMBRE_REPO` por tu usuario de GitHub y el nombre del repositorio que creaste:

```bash
git remote add origin https://github.com/TU_USUARIO/NOMBRE_REPO.git
git branch -M main
git push -u origin main
```

Te pedirá usuario y contraseña. En GitHub ya no se usa contraseña normal; usa un **Personal Access Token**:

- GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**.
- Dale un nombre, marca el permiso **repo** y genera.
- Copia el token y úsalo como “contraseña” cuando `git push` te lo pida.

---

## 5. Comprobar

Abre en el navegador la URL del repo (ej. `https://github.com/TU_USUARIO/ejercicio-comida`). Deberías ver todos los archivos del proyecto.

---

## Resumen de comandos (después de crear el repo en GitHub)

```bash
cd /Users/deboraquinteros/Proyectos/Ejercicio
git init
git add .
git commit -m "Primer commit: app ejercicio, comida, rutina y login"
git remote add origin https://github.com/TU_USUARIO/NOMBRE_REPO.git
git branch -M main
git push -u origin main
```
