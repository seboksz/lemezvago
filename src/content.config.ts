import { defineCollection, z } from "astro:content";

const episodes = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    season: z.number().int().optional(),
    episode: z.number().int().optional(),
    date: z.string(), // ISO: "2026-01-02"
    youtube: z.string().url(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { episodes };
