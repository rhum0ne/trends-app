// Schéma de sortie d'une tendance (CLAUDE.md § 6), plus deux champs internes :
// - signal_key : la clé du candidat confirmé par une source gratuite (jamais servie) ;
// - sensitive : true si le sujet est grave ou à risque (jamais publié).
// Les contraintes de longueur sont contrôlées après génération (checks.ts), pas dans le schéma envoyé à l'API.

import { z } from "zod";
import { CATEGORIES, LIFESPANS } from "@/lib/types";

export const AudienceSchema = z.object({ label: z.string(), share: z.number() });
export const AngleSchema = z.object({ tag: z.string(), title: z.string(), example: z.string(), fits: z.string() });
export const SourceSchema = z.object({ title: z.string(), url: z.string() });

export const TrendAnalysisSchema = z.object({
  signal_key: z.string(),
  sensitive: z.boolean(),
  topic: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.enum(CATEGORIES),
  why: z.string(),
  lifespan: z.enum(LIFESPANS),
  brand_safe: z.boolean(),
  risk: z.string().nullable(),
  audiences: z.array(AudienceSchema),
  angles: z.array(AngleSchema),
  image_query: z.string(),
  sources: z.array(SourceSchema),
});

export const AnalysisOutputSchema = z.object({ trends: z.array(TrendAnalysisSchema) });

export type TrendAnalysis = z.infer<typeof TrendAnalysisSchema>;
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

export const LIMITS = {
  title: 28,
  why: 200,
  example: 200,
  audiencesMin: 2,
  audiencesMax: 4,
  anglesMin: 2,
  anglesMax: 3,
  sourcesMin: 2,
  maxTrends: 12,
} as const;
