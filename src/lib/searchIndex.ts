import FlexSearch from "flexsearch";
import type { CollectionEntry } from "astro:content";
import { sectionizeByH2 } from "./sectionize";
import type { Links } from "./sectionize";

export type SearchRecord = {
  id: string;
  episodeTitle: string;
  episodeSlug: string;
  youtube: string;
  sectionTitle: string;
  sectionSlug: string;
  excerpt: string;
  body: string;
  date: string;
  links: Links;
};

function makeExcerpt(text: string, maxLen = 220) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen).trim() + "…";
}

export async function buildSearchData(episodes: CollectionEntry<"episodes">[]) {
  const index = new FlexSearch.Index({
    tokenize: "forward",
    cache: 200,
    context: true,
  } as any);

  const records: SearchRecord[] = [];

  for (const ep of episodes) {
    const sections = sectionizeByH2(ep.body);

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const id = `${ep.slug}__${sec.slug}__${i}`;

      const record: SearchRecord = {
        id,
        episodeTitle: ep.data.title,
        episodeSlug: ep.slug,
        youtube: ep.data.youtube,
        sectionTitle: sec.heading,
        sectionSlug: sec.slug,
        excerpt: makeExcerpt(sec.text),
        body: `${sec.heading}\n${sec.text}`,
        date: ep.data.date,
        links: sec.links,
      };

      index.add(id, record.body);
      records.push(record);
    }
  }

  return { index, records };
}
