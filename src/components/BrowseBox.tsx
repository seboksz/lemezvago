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

export default function BrowseBox() {
  const [all, setAll] = useState<BrowseRecord[]>([]);
  const [style, setStyle] = useState<string>("any");
  const [year, setYear] = useState<string>("any");

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

  const filtered = useMemo(() => {
    return (
      all
        .filter((r) => {
          if (style !== "any") {
            if (!(r.styles ?? []).includes(style)) return false;
          }
          if (year !== "any") {
            if (r.year !== Number(year)) return false;
          }
          return true;
        })
        // opcionális rendezés: év, cím
        .sort((a, b) => {
          const ay = a.year ?? 0;
          const by = b.year ?? 0;
          if (ay !== by) return ay - by;
          return a.sectionTitle.localeCompare(b.sectionTitle, "hu");
        })
    );
  }, [all, style, year]);

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

        <button
          class="btn"
          onClick={() => {
            setStyle("any");
            setYear("any");
          }}
        >
          Reset
        </button>
      </div>

      <div class="hint">
        Találatok: <b>{filtered.length}</b>
      </div>

      <div class="list">
        {filtered.map((r) => {
          const href = `/epizodok/${r.episodeSlug}#${r.sectionSlug}`;
          return (
            <div class="card" key={r.id}>
              <a class="title" href={href}>
                {r.sectionTitle}
              </a>
              <div class="meta">
                <span>{r.episodeTitle}</span>
                <span>•</span>
                <span>{r.year ?? "—"}</span>
                <span>•</span>
                <a href={r.episodeYoutube} target="_blank" rel="noreferrer">
                  Epizód YouTube
                </a>
              </div>

              <LinkPills links={r.links} />

              <div class="excerpt">{r.excerpt}</div>

              {(r.styles?.length ?? 0) > 0 && (
                <div class="tags">
                  {r.styles.map((s) => (
                    <span class="tag" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .wrap { display: grid; gap: 14px; }
        .filters { display:flex; gap:12px; flex-wrap:wrap; align-items:end; }
        label { display:grid; gap:6px; }
        .lbl { font-size:12px; opacity:.75; }
        select {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,.2);
          font-size: 14px;
          min-width: 220px;
        }
        .btn {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,.2);
          background: transparent;
          cursor: pointer;
        }
        .hint { opacity: .8; }

        .list { display:grid; gap:12px; }
        .card {
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,.12);
        }
        .title { font-weight:700; text-decoration:none; font-size:16px; }
        .meta {
          display:flex; gap:8px; flex-wrap:wrap;
          font-size:13px; opacity:.8; margin-top:6px;
        }
        .excerpt { margin-top:10px; line-height:1.35; }

        .linkbar { display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; }
        .pill {
          display:inline-flex; align-items:center; gap:8px;
          padding:6px 10px; border-radius:999px;
          border:1px solid rgba(0,0,0,.12);
          text-decoration:none; font-size:13px;
        }
        .pill:hover { border-color: rgba(0,0,0,.25); }

        .tags { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
        .tag {
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,.12);
          font-size: 12px;
          opacity: .9;
        }
      `}</style>
    </div>
  );
}
