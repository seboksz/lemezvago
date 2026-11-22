import fs from "node:fs";
import path from "node:path";

const input = process.argv[2] || "imports/all.md";
const outDir = "imports/episodes";

const src = fs.readFileSync(input, "utf8");
const lines = src.split(/\r?\n/);

let currentSeasonTitle = null;
let currentSeasonYear = null;
let currentEpisode = null;
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

function cleanHeading(line) {
  return line
    .replace(/^#+\s+/, "")
    .replace(/\\([.!])/g, "$1")
    .trim();
}

function extractYearFromSeason(line) {
  // Régi forma: "# Első évad (2013)"
  const match = line.match(/\((\d{4})\)/);
  return match ? Number(match[1]) : null;
}

function extractYearFromEpisode(line) {
  // Új forma: "## S07E01 - 2019/1"
  const match = line.match(/\b(\d{4})\/\d+\b/);
  return match ? Number(match[1]) : null;
}

function yamlString(value) {
  return JSON.stringify(value ?? "");
}

function flush() {
  if (!currentEpisode) {
    return;
  }

  const seasonDir = path.join(
    outDir,
    String(currentSeasonYear ?? "unknown")
  );

  fs.mkdirSync(seasonDir, { recursive: true });

  const filename = `${slugify(currentEpisode)}.md`;
  const outPath = path.join(seasonDir, filename);

  const md = `---
title: ${yamlString(currentEpisode)}
season: ${currentSeasonYear ?? "null"}
seasonTitle: ${yamlString(currentSeasonTitle)}
---

${buffer.join("\n").trim()}
`;

  fs.writeFileSync(outPath, md, "utf8");
  buffer = [];
}

for (const line of lines) {
  // H1: "# 7\\. évad"
  if (line.startsWith("# ")) {
    flush();

    currentSeasonTitle = cleanHeading(line);

    // Így a régi formátum is támogatott marad.
    currentSeasonYear = extractYearFromSeason(line);

    currentEpisode = null;
    continue;
  }

  // H2: "## S07E01 - 2019/1"
  if (line.startsWith("## ")) {
    flush();

    currentEpisode = cleanHeading(line);

    // Az új szerkezetben innen érkezik az évszám.
    currentSeasonYear =
      extractYearFromEpisode(line) ?? currentSeasonYear;

    continue;
  }

  if (currentEpisode) {
    buffer.push(line);
  }
}

flush();

console.log("✅ Kész: epizódokra bontva →", outDir);