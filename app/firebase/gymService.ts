// firebase/gymService.ts
import { db } from "./config";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

// IMPORTANT: use ONE canonical path for your types everywhere in the app.
// Adjust this import path to wherever your real types/gym.ts lives.
import type {
  GymExerciseRef,
  GymSession,
  GymSessionExercise,
  GymSet,
  GymTemplate,
  GymTemplateExercise,
  GymTemplateSet,
} from "../types/gym";

/* ---------------- Helpers ---------------- */

function safeExerciseRef(raw: any): GymExerciseRef {
  return {
    exerciseId: String(raw?.exerciseId || ""),
    name: String(raw?.name || ""),
    image: raw?.image ? String(raw.image) : "",
    primaryMuscles: Array.isArray(raw?.primaryMuscles) ? raw.primaryMuscles.map(String) : [],
    secondaryMuscles: Array.isArray(raw?.secondaryMuscles) ? raw.secondaryMuscles.map(String) : [],
    tags: Array.isArray(raw?.tags) ? raw.tags.map(String) : [],
    equipment: Array.isArray(raw?.equipment) ? raw.equipment.map(String) : [],
  };
}

function safeSet(raw: any): GymSet {
  return {
    id: String(raw?.id || ""),
    targetReps: Number(raw?.targetReps ?? 0),
    targetKg: Number(raw?.targetKg ?? 0),
    done: Boolean(raw?.done),
    templateSetId: raw?.templateSetId ? String(raw.templateSetId) : undefined,
  };
}

function safeSessionExercise(raw: any): GymSessionExercise {
  const sets: GymSet[] = Array.isArray(raw?.sets) ? raw.sets.map((x: any) => safeSet(x)) : [];
  const allDone = sets.length > 0 ? sets.every((s: GymSet) => !!s.done) : Boolean(raw?.done);

  return {
    id: String(raw?.id || ""),
    ref: safeExerciseRef(raw?.ref),
    sets,
    done: allDone,
    templateExerciseId: raw?.templateExerciseId ? String(raw.templateExerciseId) : undefined,
  };
}

function safeSession(raw: any, id: string): GymSession {
  const exercises = Array.isArray(raw?.exercises) ? raw.exercises.map(safeSessionExercise) : [];

  return {
    id,
    name: String(raw?.name || "Workout"),
    startedAt: Number(raw?.startedAt || Date.now()),
    finishedAt: raw?.finishedAt ? Number(raw.finishedAt) : undefined,
    durationSec: raw?.durationSec ? Number(raw.durationSec) : undefined,
    musclesWorked: Array.isArray(raw?.musclesWorked) ? raw.musclesWorked.map(String) : [],
    exercises,
    templateId: raw?.templateId ? String(raw.templateId) : undefined,
  };
}

function safeTemplateSet(raw: any): GymTemplateSet {
  return {
    id: String(raw?.id || ""),
    targetReps: Number(raw?.targetReps ?? 0),
    targetKg: Number(raw?.targetKg ?? 0),
  };
}

function safeTemplateExercise(raw: any): GymTemplateExercise {
  // backward compatibility: if old template stored only ref (no sets), create an empty array
  const sets = Array.isArray(raw?.sets) ? raw.sets.map(safeTemplateSet) : [];
  return {
    id: String(raw?.id || ""),
    ref: safeExerciseRef(raw?.ref),
    sets,
  };
}

function safeTemplate(raw: any, id: string): GymTemplate {
  // backward compatibility: old templates might have exercises: GymExerciseRef[]
  const rawExercises = Array.isArray(raw?.exercises) ? raw.exercises : [];
  const isOldShape = rawExercises.length > 0 && rawExercises[0] && rawExercises[0].exerciseId && !rawExercises[0].ref;

  let exercises: GymTemplateExercise[] = [];
  if (isOldShape) {
    // old: GymExerciseRef[]  -> convert to template exercises with 3 default sets of 8 reps
    exercises = rawExercises.map((r: any) => ({
      id: String(r?.id || ""), // might be missing
      ref: safeExerciseRef(r),
      sets: [
        { id: "s1", targetReps: 8, targetKg: 0 },
        { id: "s2", targetReps: 8, targetKg: 0 },
        { id: "s3", targetReps: 8, targetKg: 0 },
      ],
    }));
  } else {
    exercises = rawExercises.map(safeTemplateExercise);
  }

  return {
    id,
    name: String(raw?.name || "Template"),
    createdAt: Number(raw?.createdAt || Date.now()),
    musclesWorked: Array.isArray(raw?.musclesWorked) ? raw.musclesWorked.map(String) : [],
    exercises,
  };
}

/* ---------------- Sessions ---------------- */

export const subscribeToRecentGymSessions = (
  userId: string,
  n: number,
  callback: (sessions: GymSession[]) => void
) => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const ref = collection(db, "users", userId, "gymSessions");
  const qy = query(ref, orderBy("startedAt", "desc"), limit(n)); // orderBy + limit is standard [web:29]

  return onSnapshot(
    qy,
    (snap) => {
      const sessions: GymSession[] = [];
      snap.forEach((d) => sessions.push(safeSession(d.data(), d.id)));
      callback(sessions);
    },
    () => callback([])
  );
};

export const subscribeToGymSessionsInRange = (
  userId: string,
  startMs: number,
  endMs: number,
  callback: (sessions: GymSession[]) => void
) => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const ref = collection(db, "users", userId, "gymSessions");
  const qy = query(
    ref,
    where("startedAt", ">=", startMs),
    where("startedAt", "<", endMs),
    orderBy("startedAt", "desc")
  );

  return onSnapshot(
    qy,
    (snap) => {
      const sessions: GymSession[] = [];
      snap.forEach((d) => sessions.push(safeSession(d.data(), d.id)));
      callback(sessions);
    },
    () => callback([])
  );
};

export const getGymSessionById = async (userId: string, sessionId: string) => {
  if (!userId) throw new Error("Missing userId");
  if (!sessionId) throw new Error("Missing sessionId");

  const ref = doc(db, "users", userId, "gymSessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return safeSession(snap.data(), snap.id);
};

export const createGymSession = async (userId: string, session: Omit<GymSession, "id">) => {
  if (!userId) throw new Error("Missing userId");

  const colRef = collection(db, "users", userId, "gymSessions");
  const newRef = doc(colRef);

  await setDoc(newRef, {
    ...session,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newRef.id;
};

export const updateGymSession = async (
  userId: string,
  sessionId: string,
  patch: Partial<Omit<GymSession, "id">>
) => {
  if (!userId) throw new Error("Missing userId");
  if (!sessionId) throw new Error("Missing sessionId");

  const ref = doc(db, "users", userId, "gymSessions", sessionId);
  await updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  });
};

export const deleteGymSession = async (userId: string, sessionId: string) => {
  if (!userId) throw new Error("Missing userId");
  if (!sessionId) throw new Error("Missing sessionId");

  const ref = doc(db, "users", userId, "gymSessions", sessionId);
  await deleteDoc(ref);
};

/* ---------------- Templates ---------------- */

export const subscribeToGymTemplates = (userId: string, callback: (templates: GymTemplate[]) => void) => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const ref = collection(db, "users", userId, "gymTemplates");
  const qy = query(ref, orderBy("createdAt", "desc"));

  return onSnapshot(
    qy,
    (snap) => {
      const out: GymTemplate[] = [];
      snap.forEach((d) => out.push(safeTemplate(d.data(), d.id)));
      callback(out);
    },
    () => callback([])
  );
};

export const saveGymTemplate = async (userId: string, data: Omit<GymTemplate, "id">) => {
  if (!userId) throw new Error("Missing userId");

  const colRef = collection(db, "users", userId, "gymTemplates");
  const newRef = doc(colRef);

  await setDoc(newRef, {
    ...data,
    createdAt: Date.now(), // keep your behavior
    updatedAt: serverTimestamp(),
  });

  return newRef.id;
};

export const deleteGymTemplate = async (userId: string, templateId: string) => {
  if (!userId) throw new Error("Missing userId");
  if (!templateId) throw new Error("Missing templateId");

  const ref = doc(db, "users", userId, "gymTemplates", templateId);
  await deleteDoc(ref);
};
