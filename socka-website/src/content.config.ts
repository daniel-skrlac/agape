import { defineCollection, z } from 'astro:content';

const obavijesti = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    image: z.string(),
    imageAlt: z.string().optional().default(''),
    category: z.string().optional().default('Obavijest'),
    featured: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false)
  })
});

export const collections = { obavijesti };
