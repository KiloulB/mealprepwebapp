export type GymExerciseRef = {
  exerciseId: string; // Free Exercise DB id (string)
  name: string;
  image?: string; // relative path like "Some_Exercise/0.jpg"
  primaryMuscles: string[];
  secondaryMuscles: string[];
  tags: string[]; // normalized tags: e.g. ["dumbbell","shoulders"]
  equipment?: string[];
};

export type GymSet = {
  id: string;
  targetReps: number;
  targetKg: number;
  done: boolean;
};

export type GymSessionExercise = {
  id: string;
  ref: GymExerciseRef;

  // what user should do today
  sets: GymSet[];

  // UI completion: exercise done when all sets done
  done: boolean;
};

export type GymSession = {
  id: string;
  name: string; // e.g. "Workout"
  startedAt: number; // ms epoch
  finishedAt?: number; // ms epoch
  durationSec?: number;

  exercises: GymSessionExercise[];

  // computed at start from selected exercises (primary+secondary)
  musclesWorked: string[]; // slugs compatible with your TS map, e.g. "upper-back"
};

export type GymTemplate = {
  id: string;
  name: string;
  exercises: GymExerciseRef[];
  createdAt: number;
};
