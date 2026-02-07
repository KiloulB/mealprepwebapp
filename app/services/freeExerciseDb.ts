export type FreeExercise = {
  id: string;
  name: string;

  level: "beginner" | "intermediate" | "expert";
  mechanic: "isolation" | "compound" | null;
  equipment: string | null;
  category: string;

  primaryMuscles: string[];
  secondaryMuscles: string[];

  instructions: string[];
  images: string[]; // relative paths (folder/file) [web:156]
};

let cache: FreeExercise[] | null = null;

export const FREE_EXERCISE_DB_IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"; // [web:156]

export async function loadFreeExerciseDb(): Promise<FreeExercise[]> {
  if (cache) return cache;

  // served from Next public/ folder [web:227]
  const res = await fetch("/dist/exercises.json", { cache: "force-cache" });
  if (!res.ok) throw new Error("Failed to load /dist/exercises.json");
  cache = (await res.json()) as FreeExercise[];
  return cache;
}

export function getExercisePreviewImageUrl(ex: FreeExercise): string {
  const img = ex.images?.[0];
  if (!img) return "";
  return `${FREE_EXERCISE_DB_IMAGE_BASE}${img}`;
}

export function searchExercises(list: FreeExercise[], q: string): FreeExercise[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((x) => (x.name || "").toLowerCase().includes(s));
}
