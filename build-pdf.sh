#!/usr/bin/env bash
# Собирает priruchenny-ogon.pdf из index.html — тёмные слайды 1920×1080.
# Запуск:  ./build-pdf.sh
set -euo pipefail

cd "$(dirname "$0")"
OUT="priruchenny-ogon.pdf"
PORT=8799

CHROME=""
for c in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "$(command -v google-chrome || true)" \
  "$(command -v chromium || true)"; do
  [ -n "$c" ] && [ -x "$c" ] && CHROME="$c" && break
done
if [ -z "$CHROME" ]; then
  echo "Не найден Chrome. Установите Google Chrome или соберите PDF вручную:"
  echo "открыть index.html → Cmd+P → Сохранить как PDF, поля «Нет», фоновая графика вкл."
  exit 1
fi

# локальный сервер: по file:// не подхватятся кадры из assets/scenes
python3 -m http.server $PORT >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 1.5

echo "Собираю $OUT …"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=15000 \
  --print-to-pdf="$OUT" "http://localhost:$PORT/index.html" 2>/dev/null

PAGES=$(python3 -c "
import re,sys
d=open('$OUT','rb').read()
print(len(re.findall(rb'/Type\s*/Page[^s]',d)))
")
SIZE=$(du -h "$OUT" | cut -f1)
echo "Готово: $OUT — $PAGES стр., $SIZE"
[ "$PAGES" = "14" ] || echo "ВНИМАНИЕ: ожидалось 14 слайдов. Контент секции перерос слайд — проверьте вёрстку."
