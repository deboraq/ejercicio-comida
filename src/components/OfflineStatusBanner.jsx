import { useEffect, useState } from 'react'
import {
  OFFLINE_SYNC_EVENT,
  flushPendingCloudWrites,
  getOfflineQueuePendingCount,
  isAppOnline,
} from '../utils/offlineDataSync'

export default function OfflineStatusBanner() {
  const [online, setOnline] = useState(() => isAppOnline())
  const [pendingKeys, setPendingKeys] = useState(() => getOfflineQueuePendingCount())
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)

  useEffect(() => {
    const onStatus = (e) => {
      const d = e.detail || {}
      if (typeof d.online === 'boolean') setOnline(d.online)
      if (typeof d.pendingKeys === 'number') setPendingKeys(d.pendingKeys)
      if (typeof d.syncing === 'boolean') setSyncing(d.syncing)
      if (d.flushError != null) setSyncError(d.flushError || null)
      if (d.lastFlush && !d.flushError) setSyncError(null)
    }
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)

    window.addEventListener(OFFLINE_SYNC_EVENT, onStatus)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setPendingKeys(getOfflineQueuePendingCount())

    return () => {
      window.removeEventListener(OFFLINE_SYNC_EVENT, onStatus)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (online && pendingKeys === 0 && !syncing && !syncError) return null

  let message = ''
  if (syncError) {
    message = `No se pudo sincronizar con tu cuenta: ${syncError}. Revisá internet o iniciá sesión de nuevo.`
  } else if (!online) {
    message =
      pendingKeys > 0
        ? `Sin conexión · ${pendingKeys} cambio${pendingKeys === 1 ? '' : 's'} guardado${pendingKeys === 1 ? '' : 's'} en el teléfono. Se subirán solos al volver internet.`
        : 'Sin conexión · Podés seguir usando la app; tus datos quedan en este dispositivo.'
  } else if (syncing || pendingKeys > 0) {
    message = `Sincronizando con tu cuenta… (${pendingKeys} pendiente${pendingKeys === 1 ? '' : 's'})`
  }

  return (
    <div
      className={`app-offline-banner${online ? ' app-offline-banner--sync' : ' app-offline-banner--offline'}`}
      role="status"
      aria-live="polite"
    >
      <span className="app-offline-banner-text">{message}</span>
      {online && pendingKeys > 0 && !syncing && (
        <button
          type="button"
          className="app-offline-banner-btn"
          onClick={() => flushPendingCloudWrites()}
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
