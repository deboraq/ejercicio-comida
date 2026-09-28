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
  registerSW({
    immediate: true,
    onOfflineReady() {
      console.info('[PWA] Lista para usarse sin conexión.')
    },
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
