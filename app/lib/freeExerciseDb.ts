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
  const out: string[] = [];

  const add = (t?: string) => {
    if (!t) return;
    if (out.includes(t)) return;
    if (out.length >= 2) return;
    out.push(t);
  };

  const equipment = normalizeTag(ex.equipment || "");
  const category = normalizeTag(ex.category || "");
  const prim = (Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles : []).map(normalizeTag);
  const sec = (Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : []).map(normalizeTag);
  const muscles = new Set([...prim, ...sec]);

  // 1) Tag bucket: modality / equipment (high priority)
  if (category === "cardio") add("Cardio"); // category enum includes "cardio" in schema [web:52]

  if (out.length < 2) {
    if (equipment === "body only") add("Bodyweight"); // equipment enum includes "body only" [web:52]
    else if (equipment === "dumbbell") add("Dumbbell"); // equipment enum includes "dumbbell" [web:52]
    else if (equipment === "cable") add("Cable"); // equipment enum includes "cable" [web:52]
    else if (equipment === "machine") add("Machine"); // equipment enum includes "machine" [web:52]
  }

  // 2) Tag bucket: general body region
  const isCore =
    muscles.has("abdominals") || muscles.has("abductors") || muscles.has("adductors"); // muscle enums include these [web:52]
  const isBack =
    muscles.has("lats") || muscles.has("lower back") || muscles.has("middle back") || muscles.has("traps"); // muscle enums include these [web:52]
  const isArms =
    muscles.has("biceps") || muscles.has("triceps") || muscles.has("forearms"); // muscle enums include these [web:52]

  if (isCore) add("Core");
  else if (isBack) add("Back");
  else if (isArms) add("Arms");

  return out;
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
