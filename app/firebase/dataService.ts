import type { DailyLog, LoggedFood, Recipe, MealType } from "../types/user";
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

/* ------------------------- Daily log helpers ------------------------- */

const calculateTotals = (foods: LoggedFood[]) => {
  const checkedFoods = foods.filter((food) => food.checked);
  return checkedFoods.reduce(
    (totals, food) => ({
      kcal: totals.kcal + food.kcal * food.servings,
      protein: totals.protein + food.protein * food.servings,
      fat: totals.fat + food.fat * food.servings,
      carbs: totals.carbs + food.carbs * food.servings,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  );
};

const getDateString = (date: Date) => {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
};

/* ------------------------- Daily log subscriptions ------------------------- */

export const subscribeToDailyLog = (
  userId: string,
  date: Date,
  callback: (log: DailyLog | null) => void
) => {
  if (!userId) {
    callback(null);
    return () => {};
  }

  const dateStr = getDateString(date);
  const docRef = doc(db, "users", userId, "dailyLogs", dateStr);

  return onSnapshot(
    docRef,
    (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const log: DailyLog = {
          totals: data.totals || { kcal: 0, protein: 0, fat: 0, carbs: 0 },
          foods: data.foods || [],
        };
        callback(log);
      } else {
        callback({
          totals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
          foods: [],
        });
      }
    },
    (error) => {
      console.error("Error subscribing to daily log:", error);
      callback(null);
    }
  );
};

/* ------------------------- Recipes (read/subscribe) ------------------------- */

export const subscribeToRecipes = (
  userId: string,
  callback: (recipes: Recipe[]) => void
) => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const recipesRef = collection(db, "users", userId, "recipes");

  return onSnapshot(
    recipesRef,
    (querySnapshot) => {
      const recipes: Recipe[] = [];
      querySnapshot.forEach((d) => {
        recipes.push({ id: d.id, ...(d.data() as Omit<Recipe, "id">) } as Recipe);
      });
      callback(recipes);
    },
    (error) => {
      console.error("Error subscribing to recipes:", error);
      callback([]);
    }
  );
};

export const getRecipeById = async (userId: string, recipeId: string) => {
  if (!userId) throw new Error("Missing userId");
  if (!recipeId) throw new Error("Missing recipeId");

  const recipeRef = doc(db, "users", userId, "recipes", recipeId);
  const snap = await getDoc(recipeRef);

  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Recipe, "id">) } as Recipe;
};

/* ------------------------- Recipes (CRUD) ------------------------- */

// What your Expo screen saves: everything except id. [file:3]
export type RecipeInput = Omit<Recipe, "id">;

export const saveRecipe = async (userId: string, data: RecipeInput) => {
  if (!userId) throw new Error("Missing userId");

  const recipesRef = collection(db, "users", userId, "recipes");
  const newRef = doc(recipesRef); // auto-id

  await setDoc(newRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newRef.id;
};

export const updateRecipe = async (
  userId: string,
  recipeId: string,
  data: Partial<RecipeInput>
) => {
  if (!userId) throw new Error("Missing userId");
  if (!recipeId) throw new Error("Missing recipeId");

  const recipeRef = doc(db, "users", userId, "recipes", recipeId);

  await updateDoc(recipeRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteRecipe = async (userId: string, recipeId: string) => {
  if (!userId) throw new Error("Missing userId");
  if (!recipeId) throw new Error("Missing recipeId");

  const recipeRef = doc(db, "users", userId, "recipes", recipeId);
  await deleteDoc(recipeRef);
};

/* ------------------------- Daily log mutations ------------------------- */

export const addFoodToLog = async (
  userId: string,
  date: Date,
  food: Omit<LoggedFood, "id">
) => {
  if (!userId) return;

  const dateStr = getDateString(date);
  const docRef = doc(db, "users", userId, "dailyLogs", dateStr);

  const docSnap = await getDoc(docRef);
  const currentFoods = docSnap.exists() ? docSnap.data()?.foods || [] : [];

  const newFood: LoggedFood = {
    ...food,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  };

  const updatedFoods = [...currentFoods, newFood];
  const updatedTotals = calculateTotals(updatedFoods);

  await setDoc(docRef, {
    foods: updatedFoods,
    totals: updatedTotals,
    lastUpdated: new Date(),
  });
};

export const toggleFoodChecked = async (userId: string, date: Date, foodId: string) => {
  if (!userId) return;

  const dateStr = getDateString(date);
  const docRef = doc(db, "users", userId, "dailyLogs", dateStr);

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;

  const currentFoods: LoggedFood[] = docSnap.data()?.foods || [];

  const updatedFoods = currentFoods.map((food) =>
    food.id === foodId ? { ...food, checked: !food.checked } : food
  );

  const updatedTotals = calculateTotals(updatedFoods);

  await updateDoc(docRef, {
    foods: updatedFoods,
    totals: updatedTotals,
    lastUpdated: new Date(),
  });
};

export const removeFoodFromLog = async (userId: string, date: Date, foodId: string) => {
  if (!userId) return;

  const dateStr = getDateString(date);
  const docRef = doc(db, "users", userId, "dailyLogs", dateStr);

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;

  const currentFoods: LoggedFood[] = docSnap.data()?.foods || [];

  const updatedFoods = currentFoods.filter((food) => food.id !== foodId);
  const updatedTotals = calculateTotals(updatedFoods);

  await updateDoc(docRef, {
    foods: updatedFoods,
    totals: updatedTotals,
    lastUpdated: new Date(),
  });
};
