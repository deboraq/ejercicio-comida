import os from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Muestra en consola la URL para abrir la app desde el celular (misma Wi‑Fi). */
function lanUrlsPlugin() {
  return {
    name: 'lan-urls',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address()
        const port = typeof addr === 'object' && addr ? addr.port : 5173
        const ips = []
        for (const ifaces of Object.values(os.networkInterfaces())) {
          for (const net of ifaces || []) {
            const v4 = net.family === 'IPv4' || net.family === 4
            if (v4 && !net.internal) ips.push(net.address)
          }
        }
        if (ips.length) {
          console.log('\n  Celular (misma Wi‑Fi):')
          for (const ip of ips) console.log(`     → http://${ip}:${port}/`)
          console.log('')
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), lanUrlsPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
})
