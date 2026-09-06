import fs from "node:fs";
import path from "node:path";

const inputRoot = process.argv[2] || "imports/normalized";
const outputRoot = process.argv[3] || "src/content/episodes";

// Flags
const extractLinks = (process.argv.includes("--extract-links"));
const dryRun = (process.argv.includes("--dry-run"));

function unescapeMdPunctuation(s) {
  // Csak a "Markdownban tipikusan escape-elt írásjelek" elől vesszük le a backslash-t.
  // Példa: "\-" -> "-", "\!" -> "!", "\." -> "."
  return s.replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, "$1");
}

function pad2(n) {
  return String(n).padStart(2, "0");
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

function stripFrontmatter(md) {
  if (!md.startsWith("---")) return { fm: null, body: md };
  const end = md.indexOf("\n---", 3);
  if (end === -1) return { fm: null, body: md };
  const after = md.indexOf("\n", end + 4);
  const fm = md.slice(0, after + 1);
  const body = md.slice(after + 1);
  return { fm, body };
}

function parseFrontmatter(fm) {
  const out = {};
  if (!fm) return out;
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // number?
    if (/^\d+$/.test(val)) out[key] = Number(val);
    else if (val === "null") out[key] = null;
    else out[key] = val;
  }
  return out;
}

function detectProvider(url) {
  const u = url.toLowerCase();
  if (u.includes("bandcamp.com")) return "bandcamp";
  if (u.includes("open.spotify.com")) return "spotify";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  return null;
}

// Kinyer egy "első link" sort a szekció elejéről, ha ilyen:
// [valami](https://...)
// (pandoc/Docs export tipikus)
function extractFirstMarkdownLinkFromTop(lines) {
  // átugorjuk az üres sorokat
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;

  if (i >= lines.length) return { url: null, consume: 0 };

  const m = lines[i].match(/^\s*\[[^\]]+\]\((https?:\/\/[^\s)]+)\)\s*$/);
  if (!m) return { url: null, consume: 0 };
  return { url: m[1], consume: 1 };
}

function hasMetaBlockAtTop(lines) {
  // meta blokk: "- bandcamp:" / "- at:" / "- style:" / "- spotify:" / "- youtube:"
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return false;
  return /^\s*-\s*(bandcamp|spotify|youtube|at|style)\s*:/i.test(lines[i]);
}

function ensureMetaBlock(lines, { prefillUrl } = {}) {
  // Ha már meta-val kezd, nem nyúlunk hozzá.
  if (hasMetaBlockAtTop(lines)) return lines;

  // opcionálisan kitöltjük provider URL-lel
  const provider = prefillUrl ? detectProvider(prefillUrl) : null;

  const meta = [];
  meta.push(`- bandcamp: ${provider === "bandcamp" ? prefillUrl : ""}`.trimEnd());
  meta.push(`- spotify: ${provider === "spotify" ? prefillUrl : ""}`.trimEnd());
  meta.push(`- youtube: ${provider === "youtube" ? prefillUrl : ""}`.trimEnd());
  meta.push(`- at: 00:00`);
  meta.push(`- style:`);
  meta.push(""); // üres sor a meta után

  return [...meta, ...lines];
}

function splitByAlbumSections(body) {
  // H2-k mentén vágunk
  const lines = body.split(/\r?\n/);
  const sections = [];
  let current = null;

  const h2re = /^##\s+(.+)\s*$/;

  function flush() {
    if (!current) return;
    sections.push(current);
    current = null;
  }

  for (const line of lines) {
    const m = line.match(h2re);
    if (m) {
      flush();
      current = { heading: unescapeMdPunctuation(m[1]), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();
  return sections;
}

function rebuildBodyFromSections(sections) {
  const out = [];
  for (const s of sections) {
    out.push(`## ${s.heading}`);
	// 🔥 garantált üres sor a heading (dátum) után
	if (s.lines.length === 0 || s.lines[0].trim() !== "") {
	  out.push("");
	}	
    out.push(...s.lines);
    // biztosítsunk legalább 1 üres sort a szekciók között
    if (out.length && out[out.length - 1].trim() !== "") out.push("");
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// --- main ---
const files = walkFiles(inputRoot);
if (files.length === 0) {
  console.error("Nem találtam .md fájlokat itt:", inputRoot);
  process.exit(1);
}

// Rendezés: season, episode (a frontmatterből)
const enriched = files.map((fp) => {
  const raw = fs.readFileSync(fp, "utf8");
  const { fm } = stripFrontmatter(raw);
  const meta = parseFrontmatter(fm);
  return {
    fp,
    season: typeof meta.season === "number" ? meta.season : 0,
    episode: typeof meta.episode === "number" ? meta.episode : 0,
    title: typeof meta.title === "string" ? meta.title : path.basename(fp, ".md"),
    raw,
    meta,
  };
}).sort((a, b) => (a.season - b.season) || (a.episode - b.episode) || a.fp.localeCompare(b.fp));

fs.mkdirSync(outputRoot, { recursive: true });

let globalIdx = 0;

for (const item of enriched) {
  const { raw, meta } = item;
  const { fm, body } = stripFrontmatter(raw);

  const season = typeof meta.season === "number" ? meta.season : null;
  const episode = typeof meta.episode === "number" ? meta.episode : null;

  const sStr = season != null ? pad2(season) : "00";
  const eStr = episode != null ? pad2(episode) : "00";
  const gStr = pad2(globalIdx);

  const outName = `s${sStr}e${eStr}_ep${gStr}.md`;
  globalIdx++;

  // album szekciók feldolgozása
  const sections = splitByAlbumSections(body);

  const processed = sections.map((sec) => {
    let lines = sec.lines.slice();

    let prefillUrl = null;

    if (extractLinks) {
      // ha a szekció elején van egy markdown link sor, azt használjuk kitöltésre,
      // és ki is vehetjük a szövegből (hogy ne duplázódjon)
      const { url, consume } = extractFirstMarkdownLinkFromTop(lines);
      if (url) {
        prefillUrl = url;
        // kivágjuk a link sort a szövegből (opcionális, de szebb)
        lines = lines.slice(consume);
        // ha utána üres sor jön, azt is levágjuk
        while (lines.length && lines[0].trim() === "") lines.shift();
      }
    }

    // beszúrjuk a meta blokkot, ha nincs
    const newLines = ensureMetaBlock(lines, { prefillUrl });

    return { heading: sec.heading, lines: newLines };
  });

  const newBody = rebuildBodyFromSections(processed);

  // a frontmattert meghagyjuk, de ha nincs, akkor generálunk.
  // (a normalized fájlokban már van; itt inkább stabilan átvisszük)
  const outContent = (fm ? fm.trimEnd() : `---\ntitle: "${(meta.title ?? "").toString().replace(/"/g, '\\"')}"\nseason: ${season ?? "null"}\nepisode: ${episode ?? "null"}\ndate: ""\nyoutube: "https://youtu.be/"\ntags: ["hungarian metal", "archívum"]\n---`)
    + "\n\n"
    + newBody;

  const outPath = path.join(outputRoot, outName);

  if (dryRun) {
    console.log("[dry-run]", outName, "←", path.relative(inputRoot, item.fp));
  } else {
    fs.writeFileSync(outPath, outContent, "utf8");
  }
}

console.log(`✅ Kész: ${dryRun ? "DRY RUN (nem írt fájlokat)" : "írt fájlokat"}`);
console.log(`Bemenet:  ${inputRoot}`);
console.log(`Kimenet:  ${outputRoot}`);
console.log(`Fájlok:   ${enriched.length}`);
console.log(`Link kinyerés: ${extractLinks ? "ON" : "OFF"}`);
