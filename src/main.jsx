import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import 'bulma/css/bulma.min.css'
import './index.css'
import App from './App.jsx'
import './styles/mobile-desktop-parity.css'
import { initOfflineDataSync } from './utils/offlineDataSync'

initOfflineDataSync()

if (import.meta.env.PROD) {
  try {
    registerSW({
      immediate: true,
      onOfflineReady() {
        console.info('[PWA] Lista para usarse sin conexión.')
      },
      onRegisteredSW(_swUrl, registration) {
        registration?.update?.().catch(() => {})
      },
    })
  } catch (err) {
    console.warn('[PWA] Service worker no registrado:', err)
  }
}

const rootEl = document.getElementById('root')
function renderBootError(message) {
  if (!rootEl) return
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem;background:#0d1322;color:#e2e8f0;font-family:system-ui,sans-serif;text-align:center;gap:1rem">
      <p style="margin:0;max-width:22rem;color:#94a3b8;font-size:0.9rem">${message}</p>
      <button type="button" onclick="location.reload()" style="padding:0.55rem 1rem;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-weight:600">Recargar</button>
    </div>`
}

try {
  if (!rootEl) throw new Error('No se encontró #root')
  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
} catch (err) {
  console.error('Boot error:', err)
  renderBootError('No se pudo iniciar la app. Probá recargar o borrar datos del sitio en el navegador.')
}
