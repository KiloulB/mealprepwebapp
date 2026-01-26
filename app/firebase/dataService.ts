import { DailyLog, LoggedFood, Recipe, MealType } from '../types/user';
import { db, auth } from './config';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

// Helper function to calculate totals from foods
const calculateTotals = (foods: LoggedFood[]) => {
  const checkedFoods = foods.filter(food => food.checked);
  return checkedFoods.reduce(
    (totals, food) => ({
      kcal: totals.kcal + (food.kcal * food.servings),
      protein: totals.protein + (food.protein * food.servings),
      fat: totals.fat + (food.fat * food.servings),
      carbs: totals.carbs + (food.carbs * food.servings),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  );
};

// Helper function to get date string for Firestore
const getDateString = (date: Date) => {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
};

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
  const docRef = doc(db, 'users', userId, 'dailyLogs', dateStr);

  return onSnapshot(docRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      const log: DailyLog = {
        totals: data.totals || { kcal: 0, protein: 0, fat: 0, carbs: 0 },
        foods: data.foods || [],
      };
      callback(log);
    } else {
      // Return empty log for new dates
      callback({
        totals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
        foods: [],
      });
    }
  }, (error) => {
    console.error('Error subscribing to daily log:', error);
    callback(null);
  });
};

export const subscribeToRecipes = (
  userId: string,
  callback: (recipes: Recipe[]) => void
) => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const recipesRef = collection(db, 'users', userId, 'recipes');

  return onSnapshot(recipesRef, (querySnapshot) => {
    const recipes: Recipe[] = [];
    querySnapshot.forEach((doc) => {
      recipes.push({ id: doc.id, ...doc.data() } as Recipe);
    });
    callback(recipes);
  }, (error) => {
    console.error('Error subscribing to recipes:', error);
    callback([]);
  });
};

export const addFoodToLog = async (
  userId: string,
  date: Date,
  food: Omit<LoggedFood, 'id'>
) => {
  if (!userId) return;

  const dateStr = getDateString(date);
  const docRef = doc(db, 'users', userId, 'dailyLogs', dateStr);

  try {
    // Get current document
    const docSnap = await getDoc(docRef);
    const currentFoods = docSnap.exists() ? docSnap.data()?.foods || [] : [];

    // Create new food with unique ID
    const newFood: LoggedFood = {
      ...food,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Add food to array and recalculate totals
    const updatedFoods = [...currentFoods, newFood];
    const updatedTotals = calculateTotals(updatedFoods);

    // Update document
    await setDoc(docRef, {
      foods: updatedFoods,
      totals: updatedTotals,
      lastUpdated: new Date(),
    });

    console.log('Added food to log:', newFood);
  } catch (error) {
    console.error('Error adding food to log:', error);
    throw error;
  }
};

export const toggleFoodChecked = async (
  userId: string,
  date: Date,
  foodId: string
) => {
  if (!userId) return;

  const dateStr = getDateString(date);
  const docRef = doc(db, 'users', userId, 'dailyLogs', dateStr);

  try {
    // Get current document
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const currentFoods: LoggedFood[] = docSnap.data()?.foods || [];

    // Find and toggle the food
    const updatedFoods = currentFoods.map(food =>
      food.id === foodId ? { ...food, checked: !food.checked } : food
    );

    // Recalculate totals
    const updatedTotals = calculateTotals(updatedFoods);

    // Update document
    await updateDoc(docRef, {
      foods: updatedFoods,
      totals: updatedTotals,
      lastUpdated: new Date(),
    });

    console.log('Toggled food checked status:', foodId);
  } catch (error) {
    console.error('Error toggling food checked status:', error);
    throw error;
  }
};

export const removeFoodFromLog = async (
  userId: string,
  date: Date,
  foodId: string
) => {
  if (!userId) return;

  const dateStr = getDateString(date);
  const docRef = doc(db, 'users', userId, 'dailyLogs', dateStr);

  try {
    // Get current document
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const currentFoods: LoggedFood[] = docSnap.data()?.foods || [];

    // Remove the food
    const updatedFoods = currentFoods.filter(food => food.id !== foodId);

    // Recalculate totals
    const updatedTotals = calculateTotals(updatedFoods);

    // Update document
    await updateDoc(docRef, {
      foods: updatedFoods,
      totals: updatedTotals,
      lastUpdated: new Date(),
    });

    console.log('Removed food from log:', foodId);
  } catch (error) {
    console.error('Error removing food from log:', error);
    throw error;
  }
};