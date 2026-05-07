import { db } from "./config";
import { doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import type { MealPrepPlan } from "../types/mealPrep";

const planRef = (uid: string) => doc(db, "users", uid, "settings", "mealPrepPlan");

export const subscribeMealPrepPlan = (
  uid: string,
  callback: (plan: MealPrepPlan | null) => void
) => {
  if (!uid) { callback(null); return () => {}; }
  return onSnapshot(
    planRef(uid),
    (snap) => callback(snap.exists() ? (snap.data() as MealPrepPlan) : null),
    () => callback(null)
  );
};

export const saveMealPrepPlan = async (uid: string, plan: MealPrepPlan) => {
  if (!uid) throw new Error("Missing uid");
  await setDoc(planRef(uid), plan);
};

export const completeMealPrepPlan = async (uid: string) => {
  if (!uid) throw new Error("Missing uid");
  await setDoc(planRef(uid), { status: "completed" }, { merge: true });
};

export const deleteMealPrepPlan = async (uid: string) => {
  if (!uid) throw new Error("Missing uid");
  await deleteDoc(planRef(uid));
};
