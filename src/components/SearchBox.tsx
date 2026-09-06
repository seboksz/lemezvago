import { useEffect, useState, useRef } from "preact/hooks";
import FlexSearch from "flexsearch";

type Links = Partial<{
  spotify: string;
  bandcamp: string;
  youtube: string;
}>;

type SearchRecord = {
  id: string;
  episodeTitle: string;
  episodeSlug: string;
  youtube: string;
  sectionTitle: string;
  sectionSlug: string;
  excerpt: string;
  date: string;
  links: Links;
};

const LinkPills = ({ links }: { links?: Links }) => {
  if (!links) return null;
  if (!links.spotify && !links.bandcamp && !links.youtube) return null;

  return (
    <div class="linkbar">
      {links.spotify && (
        <a class="pill" href={links.spotify} target="_blank" rel="noreferrer">
          🟢 Spotify
        </a>
      )}
      {links.bandcamp && (
        <a class="pill" href={links.bandcamp} target="_blank" rel="noreferrer">
          🟣 Bandcamp
        </a>
      )}
      {links.youtube && (
        <a class="pill" href={links.youtube} target="_blank" rel="noreferrer">
          🔴 YouTube
        </a>
      )}
    </div>
  );
};

function extractYearFromTitle(title: string): string | null {
  const m = title.match(/\((\d{4})\./);
  return m ? m[1] : null;
}

export default function SearchBox() {
  const [q, setQ] = useState("");
  const [ready, setReady] = useState(false);
  const [recordsById, setRecordsById] = useState<Map<string, SearchRecord>>(
    new Map()
  );
  const [index, setIndex] = useState<any>(null);
  const [results, setResults] = useState<string[]>([]);
  const [year, setYear] = useState<"any" | string>("any");
  const [years, setYears] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const resultRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // 👇 IDE JÖN A SZŰRÉS
  const filteredIds = results.filter((id) => {
    const r = recordsById.get(id);
    if (!r) return false;

    if (year !== "any") {
      const y = extractYearFromTitle(r.sectionTitle);
      if (y !== year) return false;
    }

    return true;
  });

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const res = await fetch("/search.json");
      const data = await res.json();

      const idx = new FlexSearch.Index({
        tokenize: "forward",
        cache: 200,
        context: true,
      } as any);

      for (const [key, payload] of data.exportedIndex) {
        idx.import(key, payload);
      }

      const map = new Map<string, SearchRecord>();
      for (const r of data.records as SearchRecord[]) {
        map.set(r.id, r);
      }

      const yearSet = new Set<string>();
      for (const r of data.records as SearchRecord[]) {
        const y = extractYearFromTitle(r.sectionTitle);
        if (y) yearSet.add(y);
      }
      const yearList = Array.from(yearSet).sort(); // növekvő

      if (!cancelled) {
        setIndex(idx);
        setRecordsById(map);
        setReady(true);
        setYears(yearList);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !index) return;

    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }

    const ids = index.search(term);
    setResults(Array.isArray(ids) ? (ids as string[]) : []);
  }, [q, ready, index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (q.trim()) {
          e.preventDefault();
          setQ("");
        }
        inputRef.current?.blur();
        return;
      }

      // ↑/↓/Enter csak akkor, ha van query és van találat
      const visibleIds = filteredIds.slice(0, 25);

      if (q.trim() && visibleIds.length > 0) {
        // fel/le: léptetés
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();

          setActiveIdx((prev) => {
            const max = visibleIds.length - 1;
            if (prev === -1) return e.key === "ArrowDown" ? 0 : max;

            const next = e.key === "ArrowDown" ? prev + 1 : prev - 1;
            if (next < 0) return max;
            if (next > max) return 0;
            return next;
          });

          return;
        }

        // Enter: nyitás
        if (e.key === "Enter" && activeIdx >= 0) {
          e.preventDefault();

          const a = resultRefs.current[activeIdx];
          if (a) {
            // Ctrl/Cmd+Enter: új tab
            if (e.ctrlKey || e.metaKey) {
              window.open(a.href, "_blank", "noreferrer");
            } else {
              a.click();
            }
          }
          return;
        }
      }

      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, filteredIds, activeIdx]);

  useEffect(() => {
    setActiveIdx(-1);
    resultRefs.current = [];
  }, [q]);

  useEffect(() => {
    if (activeIdx < 0) return;

    const el = resultRefs.current[activeIdx];
    if (!el) return;

    el.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeIdx]);

  return (
    <div class="search">
      <input
        ref={inputRef}
        type="search"
        placeholder="Keress előadóra / albumra / kulcsszóra…"
        value={q}
        onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
      />

      <div class="results">
        {!q.trim() ? null : filteredIds.length === 0 ? (
          <p class="muted">Nincs találat.</p>
        ) : (
          <>
            <div class="hint">{filteredIds.length} találat</div>

            {filteredIds.slice(0, 25).map((id, idx) => {
              const r = recordsById.get(id);
              if (!r) return null;

              const href = `/epizodok/${r.episodeSlug}#${r.sectionSlug}`;

              return (
                <div class="card" key={id}>
                  <a
                    class={`title ${activeIdx === idx ? "active" : ""}`}
                    href={href}
                    ref={(el) => {
                      resultRefs.current[idx] = el;
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    {r.sectionTitle}
                  </a>

                  <div class="meta">
                    <span>{r.episodeTitle}</span>
                    <span>•</span>
                    <span>{r.date}</span>
                    <span>•</span>
                    <a href={r.youtube} target="_blank" rel="noreferrer">
                      YouTube
                    </a>
                  </div>

                  <LinkPills links={r.links} />

                  <div class="excerpt">{r.excerpt}</div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <style>{`
        .search { display: grid; gap: 12px; }

        input[type="search"] {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,.2);
          font-size: 16px;
        }

        .results { display: grid; gap: 12px; padding: 12px 10px; border-radius: 10px; }

        .card {
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,.12);
        }

        .title {
          font-weight: 700;
          text-decoration: none;
          font-size: 16px;
        }

        .meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 13px;
          opacity: .8;
          margin-top: 6px;
        }

        .excerpt {
          margin-top: 10px;
          line-height: 1.35;
        }

        .muted { opacity: .7; }

        .linkbar {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,.12);
          text-decoration: none;
          font-size: 13px;
        }

        .pill:hover { border-color: rgba(0,0,0,.25); }

        .filters {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        label {
          display: grid;
          gap: 6px;
        }

        .lbl {
          font-size: 12px;
          opacity: .75;
        }

        select {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,.2);
          font-size: 14px;
        }

        .hint {
          font-size: 13px;
          opacity: 0.8;
          margin: 4px 0 8px;
        }   
          
        .title.active {
          text-decoration: underline;
        }

        .card:has(.title.active) {
          outline: 2px solid rgba(0,0,0,.18);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
