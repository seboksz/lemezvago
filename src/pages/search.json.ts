import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { buildSearchData } from "../lib/searchIndex";

export const GET: APIRoute = async () => {
  const episodes = await getCollection("episodes");
  const { index, records } = await buildSearchData(episodes);

  const exportedIndex: any[] = [];
  await new Promise<void>((resolve) => {
    index.export((key: string, data: any) => {
      exportedIndex.push([key, data]);
    });
    resolve();
  });

  return new Response(JSON.stringify({ exportedIndex, records }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
