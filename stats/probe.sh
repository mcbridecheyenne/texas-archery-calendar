#!/usr/bin/env bash
set -u
rm -rf stats/out; mkdir -p stats/out
UA="Mozilla/5.0 (compatible; ArcheryInTheUSA/1.0)"
U="https://www.usarchery.org/php/ajax/filterEvents.php"
for p in $(seq 0 60); do
  curl -sS -m 60 -A "$UA" -H "X-Requested-With: XMLHttpRequest" -e "https://www.usarchery.org/events/find-an-event" "$U?level=0&state=0&distance=0&zipcode=&event_name=&page=$p&run=true" -o stats/out/usa-$p.html
  n=$(grep -c "event-information/" stats/out/usa-$p.html || true)
  echo "page $p rows $n" >> stats/out/log.txt
  [ "$n" -eq 0 ] && break
  grep -q 'id="hide" value="hide"\|value="hide"' stats/out/usa-$p.html && { echo "hide at $p" >> stats/out/log.txt; break; }
  sleep 1
done
curl -sS -m 60 -A "$UA" "https://api.worldarchery.org/v3/COMPETITIONS/?Country=USA&StartDate=2026-01-01&EndDate=2028-12-31&RBP=500" -o stats/out/wa.json
