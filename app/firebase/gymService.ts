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
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

import type { GymSession, GymTemplate } from "../../app/types/gym";

function safeSession(raw: any, id: string): GymSession {
  const exercises = Array.isArray(raw?.exercises) ? raw.exercises : [];
  return {
    id,
    name: String(raw?.name || "Workout"),
    startedAt: Number(raw?.startedAt || Date.now()),
    finishedAt: raw?.finishedAt ? Number(raw.finishedAt) : undefined,
    durationSec: raw?.durationSec ? Number(raw.durationSec) : undefined,
    musclesWorked: Array.isArray(raw?.musclesWorked) ? raw.musclesWorked : [],
    exercises,
  };
}

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
  const qy = query(ref, orderBy("startedAt", "desc"), limit(n)); // supported pattern [web:115]

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

/* -------- Templates (optional) -------- */

function safeTemplate(raw: any, id: string): GymTemplate {
  return {
    id,
    name: String(raw?.name || "Template"),
    createdAt: Number(raw?.createdAt || Date.now()),
    exercises: Array.isArray(raw?.exercises) ? raw.exercises : [],
  };
}

export const subscribeToGymTemplates = (
  userId: string,
  callback: (templates: GymTemplate[]) => void
) => {
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

export const saveGymTemplate = async (
  userId: string,
  data: Omit<GymTemplate, "id">
) => {
  if (!userId) throw new Error("Missing userId");

  const colRef = collection(db, "users", userId, "gymTemplates");
  const newRef = doc(colRef);

  await setDoc(newRef, {
    ...data,
    createdAt: Date.now(),
    updatedAt: serverTimestamp(),
  });

  return newRef.id;
};
