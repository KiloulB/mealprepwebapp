import { DailyLog, LoggedFood, Recipe, MealType } from '../types/user';

// Mock data
const mockDailyLog: DailyLog = {
  totals: {
    kcal: 1200,
    protein: 80,
    fat: 40,
    carbs: 150,
  },
  foods: [
    {
      id: '1',
      type: 'recipe',
      sourceId: 'r1',
      name: 'Chicken Salad',
      kcal: 400,
      protein: 30,
      carbs: 20,
      fat: 20,
      servings: 1,
      mealType: 'lunch',
      checked: true,
    },
  ],
};

const mockRecipes: Recipe[] = [
  {
    id: 'r1',
    title: 'Chicken Salad',
    kcal: 400,
    protein: 30,
    carbs: 20,
    fat: 20,
  },
];

export const subscribeToDailyLog = (
  userId: string,
  date: Date,
  callback: (log: DailyLog | null) => void
) => {
  // Mock: return mock data after a delay
  setTimeout(() => callback(mockDailyLog), 100);
  return () => {}; // Unsubscribe
};

export const subscribeToRecipes = (
  userId: string,
  callback: (recipes: Recipe[]) => void
) => {
  setTimeout(() => callback(mockRecipes), 100);
  return () => {};
};

export const addFoodToLog = async (
  userId: string,
  date: Date,
  food: Omit<LoggedFood, 'id'>
) => {
  // Mock: do nothing
  console.log('Added food:', food);
};

export const toggleFoodChecked = async (
  userId: string,
  date: Date,
  foodId: string
) => {
  // Mock: do nothing
  console.log('Toggled food:', foodId);
};

export const removeFoodFromLog = async (
  userId: string,
  date: Date,
  foodId: string
) => {
  // Mock: do nothing
  console.log('Removed food:', foodId);
};