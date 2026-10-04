#!/usr/bin/env bash
set -u
mkdir -p stats/out
UA="Mozilla/5.0 (compatible; ArcheryInTheUSA/1.0)"
B=https://www.usarchery.org/events
curl -sS -m 60 -A "$UA" -c stats/out/jar -L "$B/find-an-event" -o stats/out/usa.html
curl -sS -m 60 -A "$UA" -b stats/out/jar "$B/js/javascript.js?v=88" -o stats/out/javascript.js
curl -sS -m 60 -A "$UA" -b stats/out/jar "$B/js/dashboard.js?v=88" -o stats/out/dashboard.js
curl -sS -m 60 -A "$UA" -b stats/out/jar "https://www.usarchery.org/js/javascript.js?v=88" -o stats/out/javascript-root.js
ls -la stats/out > stats/out/log.txt
grep -n -i -E "load ?more|filter_events|events_calendar|ajax|\.php|url *:" stats/out/*.js | head -80 > stats/out/js-hints.txt
