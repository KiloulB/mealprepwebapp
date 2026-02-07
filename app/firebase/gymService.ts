import { db } from "./config";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import type { GymPlan, GymSession } from "../types/gym";

export type GymPlanInput = Omit<GymPlan, "id">;
export type GymSessionInput = Omit<GymSession, "id">;

/* ------------------------- Plans ------------------------- */

export const subscribeToGymPlans = (userId: string, cb: (plans: GymPlan[]) => void) => {
  if (!userId) {
    cb([]);
    return () => {};
  }

  const ref = collection(db, "users", userId, "gymPlans");

  return onSnapshot(
    ref,
    (qs) => {
      const plans: GymPlan[] = [];
      qs.forEach((d) => plans.push({ id: d.id, ...(d.data() as Omit<GymPlan, "id">) } as GymPlan));
      cb(plans);
    },
    (err) => {
      console.error("subscribeToGymPlans error:", err);
      cb([]);
    },
  );
};

export const getGymPlanById = async (userId: string, planId: string) => {
  if (!userId) throw new Error("Missing userId");
  if (!planId) throw new Error("Missing planId");

  const ref = doc(db, "users", userId, "gymPlans", planId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return { id: snap.id, ...(snap.data() as Omit<GymPlan, "id">) } as GymPlan;
};

export const saveGymPlan = async (userId: string, data: GymPlanInput) => {
  if (!userId) throw new Error("Missing userId");

  const colRef = collection(db, "users", userId, "gymPlans");
  const newRef = doc(colRef);

  await setDoc(newRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newRef.id;
};

export const updateGymPlan = async (userId: string, planId: string, data: Partial<GymPlanInput>) => {
  if (!userId) throw new Error("Missing userId");
  if (!planId) throw new Error("Missing planId");

  const ref = doc(db, "users", userId, "gymPlans", planId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

export const deleteGymPlan = async (userId: string, planId: string) => {
  if (!userId) throw new Error("Missing userId");
  if (!planId) throw new Error("Missing planId");

  await deleteDoc(doc(db, "users", userId, "gymPlans", planId));
};

/* ------------------------- Sessions ------------------------- */

export const saveGymSession = async (userId: string, data: GymSessionInput) => {
  if (!userId) throw new Error("Missing userId");

  const colRef = collection(db, "users", userId, "gymSessions");
  const newRef = doc(colRef);

  await setDoc(newRef, { ...data, createdAt: serverTimestamp() });
  return newRef.id;
};

/* ------------------------- Progressive overload ------------------------- */
/**
 * Increase-only:
 * - if all sets hit repMin => +stepKg
 * - else keep
 */
export const applyProgressiveOverload = async (
  userId: string,
  planId: string,
  workoutId: string,
  performed: GymSessionInput["performed"],
) => {
  const planRef = doc(db, "users", userId, "gymPlans", planId);
  const snap = await getDoc(planRef);
  if (!snap.exists()) return;

  const plan = snap.data() as Omit<GymPlan, "id">;

  const performedMap = new Map(performed.map((p) => [p.exerciseId, p.sets]));

  const newWorkouts = (plan.workouts || []).map((w) => {
    if (w.id !== workoutId) return w;

    return {
      ...w,
      items: (w.items || []).map((item) => {
        const setLogs = performedMap.get(item.exerciseId) || [];
        const needed = item.sets || 0;
        const used = setLogs.slice(0, needed);

        const allHitMin =
          used.length === needed && used.every((s) => (s.reps ?? 0) >= item.repMin);

        if (!allHitMin) return item;

        return {
          ...item,
          currentWeightKg: Number(item.currentWeightKg || 0) + Number(item.stepKg || 0),
        };
      }),
    };
  });

  await updateDoc(planRef, { workouts: newWorkouts, updatedAt: serverTimestamp() });
};
