// types/gym.ts

export type GymExerciseRef = {
  exerciseId: string; // Free Exercise DB id (string)
  name: string;
  image?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  tags: string[];
  equipment?: string[];
};

export type GymSet = {
  id: string;
  targetReps: number;
  targetKg: number;
  done: boolean;

  // When this session was created from a template, this links the session set
  // back to the template set so we can show “Previous” and prefill correctly.
  templateSetId?: string;
};

export type GymSessionExercise = {
  id: string;
  ref: GymExerciseRef;

  sets: GymSet[];
  done: boolean;

  // Links session exercise back to template exercise (if created from template)
  templateExerciseId?: string;
};

export type GymSession = {
  id: string;
  name: string;
  startedAt: number;
  finishedAt?: number;
  durationSec?: number;

  exercises: GymSessionExercise[];
  musclesWorked: string[];

  // Present only when started from template
  templateId?: string;
};

// ===== Templates (store sets + reps + kg + count) =====

export type GymTemplateSet = {
  id: string; // stable id within template
  targetReps: number;
  targetKg: number;
};

export type GymTemplateExercise = {
  id: string; // stable id within template
  ref: GymExerciseRef;
  sets: GymTemplateSet[]; // set count per exercise
};

export type GymTemplate = {
  id: string;
  name: string;
  createdAt: number;
  musclesWorked: string[];
  exercises: GymTemplateExercise[];
};
