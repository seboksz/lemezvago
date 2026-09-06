import fs from "node:fs";
import path from "node:path";

const input = process.argv[2] || "imports/all.md";
const outDir = "imports/episodes";

const src = fs.readFileSync(input, "utf8");
const lines = src.split(/\r?\n/);

let currentSeasonTitle = null; // pl. "Első évad (2013)"
let currentSeasonYear = null;  // pl. 2013
let currentEpisode = null;     // pl. "2013/1"
let buffer = [];

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractYearFromSeason(line) {
  // "# Első évad (2013)"
  const m = line.match(/\((\d{4})\)/);
  return m ? Number(m[1]) : null;
}

function flush() {
  if (!currentEpisode) return;

  const seasonDir = path.join(outDir, String(currentSeasonYear ?? "unknown"));
  fs.mkdirSync(seasonDir, { recursive: true });

  const filename = slugify(currentEpisode) + ".md";
  const outPath = path.join(seasonDir, filename);

  const md = `---
title: "${currentEpisode}"
season: ${currentSeasonYear ?? "null"}
seasonTitle: "${currentSeasonTitle?.replace(/"/g, '\\"') ?? ""}"
---

${buffer.join("\n").trim()}
`;

  fs.writeFileSync(outPath, md, "utf8");
  buffer = [];
}

for (const line of lines) {
  // H1: évad
  if (line.startsWith("# ")) {
    flush();
    currentSeasonTitle = line.replace(/^#\s+/, "").trim();
    currentSeasonYear = extractYearFromSeason(line);
    currentEpisode = null;
    continue;
  }

  // H2: epizód
  if (line.startsWith("## ")) {
    flush();
    currentEpisode = line.replace(/^##\s+/, "").trim();
    continue;
  }

  // minden más megy az aktuális epizódba
  if (currentEpisode) {
    buffer.push(line);
  }
}

flush();

console.log("✅ Kész: epizódokra bontva →", outDir);
