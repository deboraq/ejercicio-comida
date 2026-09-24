#!/bin/zsh
# Servidor de desarrollo accesible desde el celular (misma Wi‑Fi).
set -e
cd "$(dirname "$0")/.."

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Celular: conectate a la MISMA Wi‑Fi que esta Mac"
echo "  En el navegador del celu abrí EXACTAMENTE:"
if [ -n "$IP" ]; then
  echo ""
  echo "    http://${IP}:5173/"
  echo ""
else
  echo "    (no se detectó IP Wi‑Fi — mirá la línea Network abajo)"
fi
echo "  No uses localhost en el celu."
echo "═══════════════════════════════════════════════════"
echo ""

exec npm run dev -- --host 0.0.0.0 --port 5173
