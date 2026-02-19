// lib/muscleSlugMap.ts
// Detailed muscle → detailed slug (for the body map), PLUS grouping into general buckets.

export const DIRECT: Record<string, string> = {
  // core
  abs: "abs",
  abdominals: "abs",
  obliques: "obliques",

  // chest/arms
  chest: "chest",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearm",
  forearm: "forearm",
  shoulders: "deltoids",
  deltoids: "deltoids",
  trapezius: "trapezius",
  traps: "trapezius",

  // back
  "upper back": "upper-back",
  "middle back": "upper-back",
  "lower back": "lower-back",
  lats: "upper-back",
  "latissimus dorsi": "upper-back",

  // legs
  quadriceps: "quadriceps",
  quads: "quadriceps",
  adductors: "adductors",
  calves: "calves",
  glutes: "gluteal",
  glute: "gluteal",
  gluteal: "gluteal",
  hamstrings: "hamstring",
  hamstring: "hamstring",

  // head/neck
  neck: "neck",
  head: "head",
};

export function normalizeMuscleName(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function toBodySlug(muscleName: string): string | null {
  const key = normalizeMuscleName(muscleName);
  return DIRECT[key] || null;
}

export function musclesToSlugs(primary: string[] = [], secondary: string[] = []) {
  const out = new Set<string>();
  for (const m of [...(primary || []), ...(secondary || [])]) {
    const slug = toBodySlug(m);
    if (slug) out.add(slug);
  }
  return [...out];
}

// -----------------------------
// NEW: group the detailed slugs
// -----------------------------

export type MuscleGroupSlug =
  | "core"
  | "arms"
  | "chest"
  | "shoulders"
  | "back"
  | "legs"
  | "neck"
  | "head"
  | "cardio"
  | "other";

// detailed slug -> general group slug
export const SLUG_TO_GROUP: Record<string, MuscleGroupSlug> = {
  // core
  abs: "core",
  obliques: "core",

  // arms (biceps/triceps/forearms are arm muscles) [web:6]
  biceps: "arms",
  triceps: "arms",
  forearm: "arms",

  // chest
  chest: "chest",

  // shoulders
  deltoids: "shoulders",

  // back
  trapezius: "back",
  "upper-back": "back",
  "lower-back": "back",

  // legs
  quadriceps: "legs",
  adductors: "legs",
  calves: "legs",
  gluteal: "legs",
  hamstring: "legs",

  // head/neck
  neck: "neck",
  head: "head",
};

export function toMuscleGroupSlug(muscleName: string): MuscleGroupSlug | null {
  const detailed = toBodySlug(muscleName);
  if (!detailed) return null;
  return SLUG_TO_GROUP[detailed] || "other";
}

export function musclesToGroupSlugs(primary: string[] = [], secondary: string[] = []) {
  const out = new Set<MuscleGroupSlug>();
  for (const m of [...(primary || []), ...(secondary || [])]) {
    const g = toMuscleGroupSlug(m);
    if (g) out.add(g);
  }
  return [...out];
}

// Optional helper if you want both at once
export function musclesToDetailedAndGroups(primary: string[] = [], secondary: string[] = []) {
  const detailed = musclesToSlugs(primary, secondary);
  const groups = Array.from(
    new Set(detailed.map((s) => SLUG_TO_GROUP[s] || "other"))
  );
  return { detailed, groups };
}
