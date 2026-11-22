import { useEffect, useMemo, useState } from "preact/hooks";

type Links = Partial<{
  spotify: string;
  bandcamp: string;
  youtube: string;
}>;

type BrowseRecord = {
  id: string;
  episodeTitle: string;
  episodeSlug: string;
  episodeYoutube: string;
  date: string;
  sectionTitle: string;
  sectionSlug: string;
  links: Links;
  styles: string[];
  year: number | null;
  excerpt: string;
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

function hasProvider(r: BrowseRecord, p: "spotify" | "bandcamp" | "youtube") {
  return Boolean((r.links as any)?.[p]);
}

export default function RandomBox() {
  const [all, setAll] = useState<BrowseRecord[]>([]);
  const [picked, setPicked] = useState<BrowseRecord | null>(null);

  const [style, setStyle] = useState<string>("any");
  const [year, setYear] = useState<string>("any");
  const [provider, setProvider] = useState<
    "any" | "spotify" | "bandcamp" | "youtube" | "nolink"
  >("any");

  const [autoPicked, setAutoPicked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/browse.json");
      const data = await res.json();
      if (!cancelled) setAll((data.records as BrowseRecord[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = useMemo(() => {
    const set = new Set<string>();
    for (const r of all) for (const s of r.styles ?? []) set.add(s);
    return Array.from(set).sort();
  }, [all]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const r of all) if (r.year) set.add(r.year);
    return Array.from(set).sort((a, b) => a - b);
  }, [all]);

  const pool = useMemo(() => {
    return all.filter((r) => {
      if (style !== "any") {
        if (!(r.styles ?? []).includes(style)) return false;
      }
      if (year !== "any") {
        if (r.year !== Number(year)) return false;
      }
      if (
        provider === "spotify" ||
        provider === "bandcamp" ||
        provider === "youtube"
      ) {
        if (!hasProvider(r, provider)) return false;
      }
      if (provider === "nolink") {
        const l = r.links || {};
        if (l.spotify || l.bandcamp || l.youtube) return false;
      }
      return true;
    });
  }, [all, style, year, provider]);

  useEffect(() => {
    // csak egyszer, és csak akkor ha már van pool
    if (!autoPicked && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      setPicked(pool[idx]);
      setAutoPicked(true);
    }
  }, [pool, autoPicked]);

  function pickOne() {
    if (pool.length === 0) {
      setPicked(null);
      return;
    }
    const idx = Math.floor(Math.random() * pool.length);
    setPicked(pool[idx]);
  }

  return (
    <div class="wrap">
      <div class="filters">
        <label>
          <span class="lbl">Stílus</span>
          <select
            value={style}
            onChange={(e) =>
              setStyle((e.currentTarget as HTMLSelectElement).value)
            }
          >
            <option value="any">Bármi</option>
            {styles.map((s) => (
              <option value={s} key={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span class="lbl">Év</span>
          <select
            value={year}
            onChange={(e) =>
              setYear((e.currentTarget as HTMLSelectElement).value)
            }
          >
            <option value="any">Bármi</option>
            {years.map((y) => (
              <option value={String(y)} key={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span class="lbl">Link</span>
          <select
            value={provider}
            onChange={(e) =>
              setProvider((e.currentTarget as HTMLSelectElement).value as any)
            }
          >
            <option value="any">Bármi</option>
            <option value="spotify">Spotify</option>
            <option value="bandcamp">Bandcamp</option>
            <option value="youtube">YouTube</option>
            <option value="nolink">Nincs link</option>
          </select>
        </label>

        <button class="btn" onClick={pickOne}>
          Dobd! 🎲
        </button>
        <button
          class="btn"
          onClick={() => {
            setStyle("any");
            setYear("any");
            setProvider("any");
            setPicked(null);
            setAutoPicked(false);
          }}
        >
          Reset
        </button>
      </div>

      <div class="hint">
        Pool méret: <b>{pool.length}</b>
      </div>

      {!picked ? (
        <div class="empty">
          {pool.length === 0
            ? "Nincs találat a szűrőkre."
            : "Nyomj egy „Dobd!”-ot."}
        </div>
      ) : (
        <div class="card">
          <a
            class="title"
            href={`/epizodok/${picked.episodeSlug}#${picked.sectionSlug}`}
          >
            {picked.sectionTitle}
          </a>

          <div class="meta">
            <span>{picked.episodeTitle}</span>
            <span>•</span>
            <span>{picked.year ?? "—"}</span>
            <span>•</span>
            <a href={picked.episodeYoutube} target="_blank" rel="noreferrer">
              Epizód YouTube
            </a>
          </div>

          <LinkPills links={picked.links} />

          <div class="excerpt">{picked.excerpt}</div>

          {(picked.styles?.length ?? 0) > 0 && (
            <div class="tags">
              {picked.styles.map((s) => (
                <span class="tag" key={s}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        .wrap { display: grid; gap: 14px; }

        .filters {
          display:flex;
          gap:12px;
          flex-wrap:wrap;
          align-items:end;
        }

        label { display:grid; gap:6px; }

        .lbl { font-size:12px; opacity:.75; }

        select {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border-strong);
          font-size: 14px;
          min-width: 220px;
        }

        .btn {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border-strong);
          background: var(--panel);
          cursor: pointer;
        }

        .hint { opacity: .8; }
        .empty { opacity: .8; padding: 12px 0; }

        .card {
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid var(--border);
        }

        .title {
          font-weight:700;
          text-decoration:none;
          font-size:16px;
        }

        .meta {
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          font-size:13px;
          opacity:.8;
          margin-top:6px;
        }

        .excerpt { margin-top:10px; line-height:1.35; }

        .linkbar { display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; }

        .pill {
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:6px 10px;
          border-radius:999px;
          border: 1px solid var(--border);
          text-decoration:none;
          font-size:13px;
        }

        .pill:hover { border-color: var(--border-strong); }

        .tags { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
        .tag {
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid var(--border);
          font-size: 12px;
          opacity: .9;
        }
      `}</style>
    </div>
  );
}
