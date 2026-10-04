// Scratch probe 5: run the PR branch's nationwide collector and keep the output.
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const sh = (c) => execSync(c, { stdio: "inherit" });
sh("git fetch origin club-calendar-feeds");
sh("git checkout FETCH_HEAD -- api script/collect-usa-events.ts data");
mkdirSync("probe-out/p5", { recursive: true });
sh("node --experimental-strip-types script/collect-usa-events.ts probe-out/p5/events-usa.json > probe-out/p5/usa.log 2>&1 || true");
const { events, sources } = JSON.parse(readFileSync("probe-out/p5/events-usa.json", "utf8"));
const club = events.filter((e) => e.source === "CLUB");
writeFileSync("probe-out/p5/club-events.json", JSON.stringify({ club, sources: sources.filter((s) => s.name.startsWith("CLUB")) }, null, 1));
// For checking the dedupe: association events on the same dates as raw club entries.
writeFileSync("probe-out/p5/texas-events.json", JSON.stringify(events.filter((e) => ["TFAA", "ASA", "TSAA"].includes(e.source)), null, 1));
sh("git reset -q HEAD -- api script data && git checkout -- api script data || true");
