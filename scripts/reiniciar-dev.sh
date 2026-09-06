#!/bin/zsh
# Reinicia el servidor de desarrollo (mata procesos Vite/Node del proyecto).
set -e
cd "$(dirname "$0")/.."
echo "Deteniendo procesos en puertos 5173-5180..."
for p in $(lsof -t -iTCP:5173-5180 -sTCP:LISTEN 2>/dev/null); do
  kill -9 "$p" 2>/dev/null || true
done
pkill -9 -f "vite" 2>/dev/null || true
sleep 1
echo "Iniciando npm run dev en http://127.0.0.1:5173 ..."
exec npm run dev -- --host 127.0.0.1 --port 5173
