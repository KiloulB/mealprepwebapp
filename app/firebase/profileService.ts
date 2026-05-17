import { db } from "./config";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import type { MacroResult } from "../lib/nutritionCalc";

export interface ProfileData {
  firstName?: string;
  birthDate?: string;
  gender?: string;
  weight?: number;
  height?: number;
  username?: string;
  pin?: string;
  weightUnit?: string;
  sleepHours?: number;
  jobType?: string;
  exerciseDaysPerWeek?: number;
  onboardingComplete?: boolean;
  mealPrepEnabled?: boolean;
  helpModeEnabled?: boolean;
  recoveryCode?: string;
}

export interface WeightEntry {
  date: string; // "YYYY-MM-DD"
  weight: number;
}

export interface PlanData {
  goalType?: string;
  goalAmount?: number;
  goalDate?: string;
  startWeight?: number;
  targetWeight?: number;
  dailyCalories?: number;
  planName?: string;
  planDescription?: string;
  weightHistory?: WeightEntry[];
}

export const subscribeToProfile = (uid: string, callback: (data: ProfileData) => void) => {
  const ref = doc(db, "users", uid, "settings", "profile");
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? (snap.data() as ProfileData) : {});
  }, () => callback({}));
};

export const updateProfile = async (uid: string, data: Partial<ProfileData>) => {
  const ref = doc(db, "users", uid, "settings", "profile");
  await setDoc(ref, data, { merge: true });
};

export const subscribeToPlan = (uid: string, callback: (data: PlanData) => void) => {
  const ref = doc(db, "users", uid, "settings", "plan");
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? (snap.data() as PlanData) : {});
  }, () => callback({}));
};

export const updatePlan = async (uid: string, data: Partial<PlanData>) => {
  const ref = doc(db, "users", uid, "settings", "plan");
  await setDoc(ref, data, { merge: true });
};

export const checkOnboardingComplete = async (uid: string): Promise<boolean> => {
  const ref = doc(db, "users", uid, "settings", "profile");
  const snap = await getDoc(ref);
  return snap.exists() && snap.data()?.onboardingComplete === true;
};

export const saveOnboardingData = async (
  uid: string,
  data: {
    profile: ProfileData & { onboardingComplete: true };
    plan: PlanData;
    macros: MacroResult;
  }
) => {
  await setDoc(doc(db, "users", uid, "settings", "profile"), data.profile, { merge: true });
  await setDoc(doc(db, "users", uid, "settings", "plan"), data.plan, { merge: true });
  await setDoc(doc(db, "users", uid, "settings", "macros"), data.macros, { merge: true });
};

export const subscribeToMacros = (
  uid: string,
  callback: (macros: MacroResult | null) => void
) => {
  const ref = doc(db, "users", uid, "settings", "macros");
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? (snap.data() as MacroResult) : null);
  }, () => callback(null));
};

export const toggleMealPrep = async (uid: string, enabled: boolean) => {
  const ref = doc(db, "users", uid, "settings", "profile");
  await setDoc(ref, { mealPrepEnabled: enabled }, { merge: true });
};

export const saveRegistrationProfile = async (uid: string, username: string, pin: string) => {
  const ref = doc(db, "users", uid, "settings", "profile");
  await setDoc(ref, { username, pin }, { merge: true });
};

export const toggleHelpMode = async (uid: string, enabled: boolean) => {
  const ref = doc(db, "users", uid, "settings", "profile");
  await setDoc(ref, { helpModeEnabled: enabled }, { merge: true });
};

export const addWeightEntry = async (uid: string, entry: WeightEntry) => {
  const ref = doc(db, "users", uid, "settings", "plan");
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const history: WeightEntry[] = (data.weightHistory as WeightEntry[]) || [];
  const updated = [...history.filter((e) => e.date !== entry.date), entry].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  await setDoc(ref, { weightHistory: updated }, { merge: true });
  await updateProfile(uid, { weight: entry.weight });
};

export const removeWeightEntry = async (uid: string, date: string) => {
  const ref = doc(db, "users", uid, "settings", "plan");
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const history: WeightEntry[] = (data.weightHistory as WeightEntry[]) || [];
  const updated = history.filter((e) => e.date !== date);
  await setDoc(ref, { weightHistory: updated }, { merge: true });
  if (updated.length > 0) {
    const last = updated[updated.length - 1];
    await updateProfile(uid, { weight: last.weight });
  }
};
