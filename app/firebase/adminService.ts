import {
  collection, doc, getDocs, deleteDoc, addDoc, updateDoc,
  setDoc, getDoc, serverTimestamp, onSnapshot, query, orderBy, where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";

// ─── User Registry ────────────────────────────────────────────────────────────
// Top-level collection: userRegistry/{uid}
// Populated at registration; read by admin dashboard.

export type UserRegistryEntry = {
  uid: string;
  username: string;
  createdAt: number;
  isAdmin?: boolean;
};

export const saveToUserRegistry = async (uid: string, data: Omit<UserRegistryEntry, "uid">) => {
  await setDoc(doc(db, "userRegistry", uid), { ...data, uid }, { merge: true });
};

// Only writes if the entry doesn't exist yet — safe to call on every login
export const ensureInUserRegistry = async (uid: string, username: string) => {
  const ref = doc(db, "userRegistry", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { uid, username, createdAt: Date.now() });
  }
};

export const setUserAdminRole = async (uid: string, isAdmin: boolean) => {
  await setDoc(doc(db, "userRegistry", uid), { isAdmin }, { merge: true });
};

export const subscribeToUserRegistry = (callback: (users: UserRegistryEntry[]) => void) => {
  return onSnapshot(
    query(collection(db, "userRegistry"), orderBy("createdAt", "desc")),
    (snap) => callback(snap.docs.map((d) => d.data() as UserRegistryEntry)),
    () => callback([])
  );
};

export const resetUserData = async (uid: string) => {
  const subcols = ["dailyLogs", "recipes", "gymSessions", "gymTemplates"];
  for (const sub of subcols) {
    const snap = await getDocs(collection(db, "users", uid, sub));
    if (snap.empty) continue;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  const profileSnap = await getDoc(doc(db, "users", uid, "settings", "profile"));
  const profileData = profileSnap.exists() ? profileSnap.data() : {};

  const settingsBatch = writeBatch(db);
  settingsBatch.delete(doc(db, "users", uid, "settings", "plan"));
  settingsBatch.delete(doc(db, "users", uid, "settings", "macros"));
  settingsBatch.delete(doc(db, "users", uid, "settings", "mealPrepPlan"));
  settingsBatch.set(doc(db, "users", uid, "settings", "profile"), {
    username: profileData.username ?? "",
    pin: profileData.pin ?? "",
    ...(profileData.recoveryCode ? { recoveryCode: profileData.recoveryCode } : {}),
    onboardingComplete: false,
  });
  await settingsBatch.commit();
};

export const deleteUserFirestoreData = async (uid: string) => {
  const subcols = ["dailyLogs", "recipes", "gymSessions", "gymTemplates", "settings"];
  const batch = writeBatch(db);

  for (const sub of subcols) {
    const colRef = collection(db, "users", uid, sub);
    const snap = await getDocs(colRef);
    snap.docs.forEach((d) => batch.delete(d.ref));
  }

  batch.delete(doc(db, "userRegistry", uid));
  await batch.commit();

  // Clean up recovery codes separately so a missing index can't block deletion
  try {
    const recoverySnap = await getDocs(query(collection(db, "recovery"), where("uid", "==", uid)));
    if (!recoverySnap.empty) {
      const rb = writeBatch(db);
      recoverySnap.docs.forEach((d) => rb.delete(d.ref));
      await rb.commit();
    }
  } catch {
    // Recovery cleanup is best-effort; main deletion already succeeded
  }
};

// ─── Global Exercises ─────────────────────────────────────────────────────────
// Top-level collection: globalExercises/{id}

export type GlobalExercise = {
  id: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  category: string;
  image?: string;
  description?: string;
  createdAt?: number;
};

export const subscribeToGlobalExercises = (callback: (items: GlobalExercise[]) => void) => {
  return onSnapshot(
    query(collection(db, "globalExercises"), orderBy("name")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalExercise))),
    () => callback([])
  );
};

export const createGlobalExercise = async (data: Omit<GlobalExercise, "id">) => {
  const ref = await addDoc(collection(db, "globalExercises"), { ...data, createdAt: Date.now() });
  return ref.id;
};

export const updateGlobalExercise = async (id: string, data: Partial<Omit<GlobalExercise, "id">>) => {
  await updateDoc(doc(db, "globalExercises", id), { ...data, updatedAt: serverTimestamp() });
};

export const deleteGlobalExercise = async (id: string) => {
  await deleteDoc(doc(db, "globalExercises", id));
};

// ─── Global Recipes ───────────────────────────────────────────────────────────
// Top-level collection: globalRecipes/{id}

export type GlobalRecipe = {
  id: string;
  title: string;
  category: string;
  portions: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  image?: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  createdAt?: number;
};

export const subscribeToGlobalRecipes = (callback: (items: GlobalRecipe[]) => void) => {
  return onSnapshot(
    query(collection(db, "globalRecipes"), orderBy("title")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GlobalRecipe))),
    () => callback([])
  );
};

export const createGlobalRecipe = async (data: Omit<GlobalRecipe, "id">) => {
  const ref = await addDoc(collection(db, "globalRecipes"), { ...data, createdAt: Date.now() });
  return ref.id;
};

export const updateGlobalRecipe = async (id: string, data: Partial<Omit<GlobalRecipe, "id">>) => {
  await updateDoc(doc(db, "globalRecipes", id), { ...data, updatedAt: serverTimestamp() });
};

export const deleteGlobalRecipe = async (id: string) => {
  await deleteDoc(doc(db, "globalRecipes", id));
};

// Bulk-import built-in recipes into globalRecipes
export const seedBuiltinRecipes = async (recipes: Omit<GlobalRecipe, "id">[]) => {
  const batch = writeBatch(db);
  for (const r of recipes) {
    const ref = doc(collection(db, "globalRecipes"));
    batch.set(ref, { ...r, createdAt: Date.now() });
  }
  await batch.commit();
};
