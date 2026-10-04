#!/usr/bin/env bash
set -u
mkdir -p stats/out
UA="Mozilla/5.0 (compatible; ArcheryInTheUSA/1.0)"
FROM=$(date -u +%Y-%m-%d)
curl -sS -m 60 -A "$UA" "https://api.worldarchery.org/v3/COMPETITIONS/?Country=USA&StartDate=2026-01-01&EndDate=2027-12-31&RBP=500" -o stats/out/wa.json; echo "wa exit $?" > stats/out/log.txt
curl -sS -m 60 -A "$UA" -L "https://www.usarchery.org/events/find-an-event" -o stats/out/usa.html -w "usa page %{http_code} %{size_download}\n" >> stats/out/log.txt
grep -o -E "https?://[^\"' ]*(api|event|json|calendar)[^\"' ]*" stats/out/usa.html | sort -u | head -80 > stats/out/usa-urls.txt
grep -o -E "<script[^>]+src=\"[^\"]+\"" stats/out/usa.html | head -40 >> stats/out/usa-urls.txt
