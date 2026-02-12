import exercisesRaw from "../data/exercises.json";

export type FreeExercise = {
  id: string;
  name: string;
  instructions?: string[];
  images?: string[]; // e.g. ["Alternate_Incline_Dumbbell_Curl/0.jpg"]
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  category?: string;
  force?: string;
  level?: string;
  mechanic?: string;
  equipment?: string | null;
};

const RAW_IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

export function getExerciseImageUrl(relative?: string) {
  if (!relative) return "";
  // already absolute?
  if (relative.startsWith("http://") || relative.startsWith("https://")) return relative;
  return `${RAW_IMAGE_BASE}${relative}`;
}

export function getAllExercises(): FreeExercise[] {
  const arr = (exercisesRaw as any) as FreeExercise[];
  return Array.isArray(arr) ? arr : [];
}

export function normalizeTag(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function buildExerciseTags(ex: FreeExercise): string[] {
  const tags = new Set<string>();

  if (ex.category) tags.add(normalizeTag(ex.category));
  if (ex.force) tags.add(normalizeTag(ex.force));
  if (ex.level) tags.add(normalizeTag(ex.level));
  if (ex.mechanic) tags.add(normalizeTag(ex.mechanic));

  // equipment is string | null in this DB [web:109]
  if (typeof (ex as any).equipment === "string" && (ex as any).equipment.trim()) {
    tags.add(normalizeTag((ex as any).equipment));
  }

  (Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles : []).forEach((m) =>
    tags.add(normalizeTag(m))
  );
  (Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : []).forEach((m) =>
    tags.add(normalizeTag(m))
  );

  return [...tags].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function searchExercises(query: string, tagFilters: string[] = []) {
  const q = normalizeTag(query);
  const filters = tagFilters.map(normalizeTag).filter(Boolean);

  const all = getAllExercises();
  return all
    .filter((ex) => {
      const name = normalizeTag(ex.name);
      if (q && !name.includes(q)) return false;

      if (filters.length) {
        const tags = buildExerciseTags(ex);
        for (const f of filters) {
          if (!tags.includes(f)) return false;
        }
      }
      return true;
    })
    .sort((a, b) => normalizeTag(a.name).localeCompare(normalizeTag(b.name)));
}

let _index: Map<string, FreeExercise> | null = null;

export function getExerciseIndex(): Map<string, FreeExercise> {
  if (_index) return _index;

  const all = getAllExercises();
  const m = new Map<string, FreeExercise>();
  for (const ex of all) m.set(String(ex.id), ex);

  _index = m;
  return m;
}

export function getExerciseById(id?: string | null): FreeExercise | null {
  if (!id) return null;
  return getExerciseIndex().get(String(id)) ?? null;
}