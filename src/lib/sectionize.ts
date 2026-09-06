export type Links = Partial<{
  spotify: string;
  bandcamp: string;
  youtube: string;
}>;

export type Section = {
  heading: string;
  slug: string;
  text: string; // review szöveg (link sorok nélkül)
  links: Links; // kinyert szolgáltató linkek
  styles: string[];
  year: number | null;
  at: number | null;
};

function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const META_LINE_RE =
  /^\s*-\s*(spotify|bandcamp|youtube|style|at)\s*:\s*(.+?)\s*$/i;

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

function extractMetaFromTop(lines: string[]) {
  const links: Links = {};
  const styles: string[] = [];
  let i = 0;
  let at: number | null = null;

  // elején üres sorok oké
  while (i < lines.length && lines[i].trim() === "") i++;

  for (; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(META_LINE_RE);
    if (!m) break;

    const key = m[1].toLowerCase();
    const raw = m[2].trim();

    if (key === "style") {
      styles.push(...splitCommaList(raw));
    } else if (key === "spotify" || key === "bandcamp" || key === "youtube") {
      // ha véletlenül valaki nem URL-t ír, az se dől össze
      links[key] = raw;
    }

    if (key === "at") {
      at = parseTimestamp(raw);
    }
  }

  // meta után egy üres sort is levágunk
  while (i < lines.length && lines[i].trim() === "") i++;

  return {
    links,
    styles: Array.from(new Set(styles)),
    at,
    restLines: lines.slice(i),
  };
}

function extractYearFromHeading(heading: string): number | null {
  const m = heading.match(/\((\d{4})\./);
  return m ? Number(m[1]) : null;
}

function parseTimestamp(raw: string): number | null {
  const parts = raw.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;

  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

export function sectionizeByH2(markdownBody: string): Section[] {
  const lines = markdownBody.split("\n");
  const sections: Section[] = [];

  let currentHeading = "";
  let currentTextLines: string[] = [];

  const flush = () => {
    if (!currentHeading) return;

    const raw = currentTextLines.join("\n").trimEnd();
    const rawLines = raw.split("\n");

    const { links, styles, at, restLines } = extractMetaFromTop(rawLines);

    const text = restLines.join("\n").trim();
    const year = extractYearFromHeading(currentHeading);

    sections.push({
      heading: currentHeading.trim(),
      slug: slugify(currentHeading),
      text,
      links,
      styles,
      year,
      at,
    });
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)\s*$/);
    if (h2) {
      flush();
      currentHeading = h2[1];
      currentTextLines = [];
      continue;
    }
    if (currentHeading) currentTextLines.push(line);
  }

  flush();
  return sections;
}
