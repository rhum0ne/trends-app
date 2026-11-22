import type { HeatLevel } from "@/lib/types";

// Seuils de docs/heat.md : cold < 40 ≤ mild < 60 ≤ warm < 75 ≤ hot < 90 ≤ scorching
export const LEVEL_THRESHOLDS = [40, 60, 75, 90] as const;

export function clampHeat(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function heatLevelIndex(heat: number): 0 | 1 | 2 | 3 | 4 {
  const h = clampHeat(heat);
  if (h >= 90) return 4;
  if (h >= 75) return 3;
  if (h >= 60) return 2;
  if (h >= 40) return 1;
  return 0;
}

const NAMES: HeatLevel[] = ["cold", "mild", "warm", "hot", "scorching"];

export function heatLevel(heat: number): HeatLevel {
  return NAMES[heatLevelIndex(heat)];
}

export function heatVar(heat: number): string {
  return `var(--heat-${heatLevelIndex(heat)})`;
}
