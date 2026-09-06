import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { sectionizeByH2 } from "../lib/sectionize";

export const GET: APIRoute = async () => {
  const episodes = await getCollection("episodes");

  const records = episodes.flatMap((ep) => {
    const sections = sectionizeByH2(ep.body);

    return sections.map((s, i) => ({
      id: `${ep.slug}__${s.slug}__${i}`,
      episodeTitle: ep.data.title,
      episodeSlug: ep.slug,
      episodeYoutube: ep.data.youtube,
      date: ep.data.date,

      sectionTitle: s.heading,
      sectionSlug: s.slug,

      links: s.links,
      styles: s.styles ?? [],
      year: s.year ?? null,

      excerpt:
        (s.text || "").replace(/\s+/g, " ").trim().slice(0, 220) +
        ((s.text || "").length > 220 ? "…" : ""),
    }));
  });

  return new Response(JSON.stringify({ records }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
