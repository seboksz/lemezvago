import fs from "node:fs";
import path from "node:path";

const inputRoot = process.argv[2] || "imports/episodes";
const outputRoot = process.argv[3] || "imports/normalized";

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const HU_ORDINAL = new Map([
  ["első", 1],
  ["masodik", 2],
  ["második", 2],
  ["harmadik", 3],
  ["negyedik", 4],
  ["ötödik", 5],
  ["hatodik", 6],
  ["hetedik", 7],
  ["nyolcadik", 8],
  ["kilencedik", 9],
  ["tizedik", 10],
]);

function extractSeasonNumber(seasonTitle) {
  // pl. "Első évad (2013)"
  if (!seasonTitle) return null;
  const lower = seasonTitle
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  // "elso evad (2013)" -> "elso"
  const m = lower.match(/^([a-z]+)\s+evad\b/);
  if (!m) return null;
  return HU_ORDINAL.get(m[1]) ?? null;
}

function extractEpisodeNumber(episodeId) {
  // pl. "2013/1" -> 1
  const m = (episodeId || "").match(/\/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

function stripFrontmatter(md) {
  // ha van YAML frontmatter a tetején, levágjuk
  if (!md.startsWith("---")) return { frontmatter: null, body: md };
  const end = md.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: null, body: md };
  const after = md.indexOf("\n", end + 4);
  const fm = md.slice(0, after + 1);
  const body = md.slice(after + 1);
  return { frontmatter: fm, body };
}

function parseExistingFrontmatter(fm) {
  // nagyon laza parser: title/season/seasonTitle mezőt kiszedi, ha vannak
  const out = {};
  if (!fm) return out;
  const lines = fm.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    // vegyük le az idézőjelet, ha "..."
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function normalizeListToH2(body) {
  const lines = body.split(/\r?\n/);

  // list item kezdete: "123. szöveg"
  const itemStartRe = /^\s*(\d+)\.\s+(.*)\s*$/;

  const blocks = [];
  let current = null;

  function flush() {
    if (!current) return;
    const heading = current.heading.trim();
    const text = current.lines.join("\n").trim();

    blocks.push({ heading, text });
    current = null;
  }

  for (const line of lines) {
    const m = line.match(itemStartRe);
    if (m) {
      flush();
      current = { heading: m[2], lines: [] };
      continue;
    }

    if (!current) continue;

    // Docs exportnál tipikus: behúzott sorok ("   ...") vagy tab.
    // Levágjuk a 2+ space/tab indentet, de meghagyjuk a tartalmat.
    const deindented = line.replace(/^\s{2,}/, "").replace(/^\t+/, "");
    current.lines.push(deindented);
  }

  flush();

  // Ha nem talált semmit, akkor visszaadjuk érintetlenül
  if (blocks.length === 0) return body.trim() + "\n";

  // Összerakás: ## + üres sor + text
  const out = [];
  for (const b of blocks) {
    out.push(`## ${b.heading}`);
    out.push("");
    if (b.text) {
      out.push(b.text);
      out.push("");
    } else {
      out.push(""); // legyen egy üres bekezdés, ha nincs szöveg
    }
  }

  return out.join("\n").trim() + "\n";
}

function buildFrontmatter({ title, seasonNum, episodeNum }) {
  // a user által kért sablon: season/episode/date/youtube üresen is jó
  return `---
title: "${(title || "").replace(/"/g, '\\"')}"
season: ${seasonNum ?? "null"}
episode: ${episodeNum ?? "null"}
date: ""
youtube: "https://youtu.be/"
tags: ["hungarian metal", "archívum"]
---
`;
}

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) out.push(full);
  }
  return out;
}

const files = walkFiles(inputRoot);
if (files.length === 0) {
  console.error("Nem találtam .md fájlokat itt:", inputRoot);
  process.exit(1);
}

for (const inPath of files) {
  const rel = path.relative(inputRoot, inPath); // pl. "2013/2013-1.md"
  const raw = fs.readFileSync(inPath, "utf8");

  const { frontmatter, body } = stripFrontmatter(raw);
  const old = parseExistingFrontmatter(frontmatter);

  // title: eddig "2013/1" volt, ezt továbbvisszük (jó epizód ID)
  const title = old.title || path.basename(inPath, ".md");

  const seasonTitle = old.seasonTitle || "";
  const seasonNum = extractSeasonNumber(seasonTitle); // "Első évad..." -> 1
  const episodeNum = extractEpisodeNumber(title); // "2013/1" -> 1

  const newBody = normalizeListToH2(body);

  const fm = buildFrontmatter({
    title,
    seasonNum,
    episodeNum,
  });

  const outPath = path.join(outputRoot, rel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, fm + "\n" + newBody, "utf8");
}

console.log(`✅ Kész. Normalizált fájlok: ${outputRoot}`);
console.log(`Bemenet:  ${inputRoot}`);
console.log(`Fájlok:   ${files.length}`);
