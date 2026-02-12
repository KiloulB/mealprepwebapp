const DIRECT: Record<string, string> = {
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

  // head/neck (your map includes these) [file:97][file:98]
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
