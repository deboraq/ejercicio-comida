# Asistente Gemini en Mi rutina — guía completa

Esta guía explica **dónde está cada cosa** en Google, en la app y en el código del proyecto.

---

## A. Qué hace el asistente

- Lee un **resumen** de tus datos (metas, comida de hoy, últimos 7 días, ejercicio reciente).
- Responde preguntas en español (ej. “¿cuántas kcal llevo hoy?”).
- Si preguntás por un alimento **fuera del catálogo**, estima kcal/macros (aproximado).
- Si el catálogo local (`referenciaComidas.js`) tiene coincidencias, se envían a Gemini para priorizarlas.
- Podés **“Usar en registro de comida”** cuando Gemini devuelve una estimación estructurada.

---

## B. Google AI Studio — API key gratis

| Paso | Acción | Dónde |
|------|--------|--------|
| B1 | Abrí | https://aistudio.google.com |
| B2 | Iniciá sesión | Cuenta Google |
| B3 | Crear key | https://aistudio.google.com/apikey → **Create API key** |
| B4 | Copiar | String que empieza con `AIza…` |
| B5 | Probar (opcional) | Chat en AI Studio con un modelo **Flash** |
| B6 | Límites | AI Studio → **Rate limits** (tier Free, sin tarjeta) |

**No** subas la key a GitHub ni la commitees en `.env` pública.

---

## C. En la app — uso diario

| Paso | Acción | Dónde en la app |
|------|--------|-----------------|
| C1 | Levantar dev | Terminal: `cd` al proyecto → `npm run dev` → http://localhost:5173 |
| C2 | Config | Pestaña **Config** o http://localhost:5173/config |
| C3 | Bajar a | Sección **Asistente Gemini** (ancla `#asistente-gemini`) |
| C4 | Pegar key | Campo **API key** |
| C5 | Modelo | Dejar **Gemini 2.0 Flash** salvo error 404 |
| C6 | Activar | Checkbox **Activar asistente en Comida → pestaña Consultas** |
| C7 | Comida | Pestaña **Comida** → http://localhost:5173/comida |
| C8 | Consultas | Tab **Consultas IA** / **Consultas** |
| C9 | Preguntar | Input o chips de ejemplo |
| C10 | Agregar comida | Botón **Usar en registro de comida** → te lleva a **Registrar** con datos precargados |

Atajo desde Config: **Abrir Consultas en Comida**.

---

## D. En el proyecto — archivos (mapa)

```
Ejercicio/
├── docs/ASISTENTE_GEMINI.md          ← esta guía
├── package.json                      ← dependencia @google/generative-ai
├── src/
│   ├── pages/
│   │   ├── Config.jsx                ← sección #asistente-gemini (key, modelo, activar)
│   │   └── Comida.jsx                ← pasa config/ejercicios; agregarDesdeAsistente()
│   ├── components/
│   │   ├── ComidaTitanium.jsx        ← tab "Consultas IA"
│   │   └── AsistenteGemini.jsx       ← UI del chat
│   └── utils/
│       ├── asistenteContexto.js      ← JSON de contexto (comida, metas, ejercicio)
│       ├── geminiAsistente.js        ← llamada a Gemini + parse ALIMENTO_JSON
│       └── referenciaComidas.js      ← catálogo local (búsqueda previa)
```

Datos del usuario (storage):

| Clave | Contenido |
|-------|-----------|
| `config` | Incluye `geminiApiKey`, `geminiHabilitado`, `geminiModelo` |
| `comida` | Registros de comidas |
| `ejercicios` | Actividad / deportes |

---

## E. Cómo funciona por dentro (1 consulta)

1. Usuario escribe en **Consultas IA**.
2. `buildAsistenteContexto()` arma JSON (metas, hoy, 7 días, ejercicio, hits del catálogo).
3. `consultarGemini()` envía system prompt + contexto + pregunta a Google.
4. La respuesta se muestra; si hay línea `ALIMENTO_JSON: {...}`, aparece **Usar en registro**.

---

## F. Errores frecuentes

| Mensaje | Qué hacer |
|---------|-----------|
| Falta API key | Config → pegar key y activar checkbox |
| 429 / quota | Esperar; revisar límites en AI Studio |
| Modelo no disponible | Config → probar `gemini-2.0-flash` u otro de la lista |
| Key inválida | Crear key nueva en AI Studio |

---

## G. Privacidad

- En tier **gratis**, Google puede usar prompts para mejorar productos (ver términos de Gemini API).
- No envíes datos que no quieras compartir con Google.
- La key en **Config** se guarda en tu `config` local/sync; no va al repositorio.

---

## H. Deploy (Vercel)

1. `npm run build` en local debe pasar.
2. Push a GitHub / deploy como siempre.
3. Cada dispositivo: volver a cargar la **API key** en Config (si no sincroniza `config` en la nube).

Opcional futuro: proxy `/api/gemini` en Vercel con `GEMINI_API_KEY` en variables de entorno (una key del servidor, no BYOK).

---

## I. Mantenimiento

- Nuevos alimentos fijos → editar `src/utils/referenciaComidas.js` (no hace falta IA).
- Cambiar modelos free → lista en `src/utils/geminiAsistente.js` (`GEMINI_MODELOS_SUGERIDOS`).
- Ajustar qué datos se envían → `src/utils/asistenteContexto.js`.
