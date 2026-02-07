export type GymPlanExercise = {
  exerciseId: string; // Free Exercise DB exercise.id
  name: string;
  imageUrl?: string;

  primaryMuscles: string[];
  secondaryMuscles: string[];

  sets: number;
  repMin: number;
  repMax: number;
  restSec?: number;

  currentWeightKg: number; // per plan
  stepKg: number;
  requireAllSets: true;
};

export type GymWorkout = {
  id: string; // client uuid
  name: string; // user named: "Workout A"
  items: GymPlanExercise[];
};

export type GymPlan = {
  id: string;
  title: string;
  workouts: GymWorkout[];
  createdAt?: any;
  updatedAt?: any;
};

export type GymSetLog = { reps: number; weightKg: number };

export type GymPerformedExercise = {
  exerciseId: string;
  sets: GymSetLog[];
};

export type GymSession = {
  id: string;
  planId: string;
  workoutId: string;
  startedAt: number;
  finishedAt: number;
  performed: GymPerformedExercise[];
  overloadApplied: boolean;
};
