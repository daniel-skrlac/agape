import { defineCollection, z } from 'astro:content';

const obavijesti = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    image: z.string().optional().default('/images/og/socka-share.png'),
    imageAlt: z.string().optional().default(''),
    category: z.string().optional().default('Obavijest'),
    featured: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
    sourceUrl: z.string().url().optional(),
    imageCredit: z.string().optional()
  })
});

export const collections = { obavijesti };
