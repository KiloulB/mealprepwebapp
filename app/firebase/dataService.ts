import { DailyLog, LoggedFood, Recipe, MealType } from '../types/user';

// In-memory storage for mock data
let mockDailyLogs: { [key: string]: DailyLog } = {
  'default': {
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
      {
        id: '2',
        type: 'recipe',
        sourceId: 'r2',
        name: 'Protein Shake',
        kcal: 200,
        protein: 25,
        carbs: 10,
        fat: 5,
        servings: 1,
        mealType: 'breakfast',
        checked: true,
      },
      {
        id: '3',
        type: 'recipe',
        sourceId: 'r3',
        name: 'Salmon Dinner',
        kcal: 600,
        protein: 45,
        carbs: 30,
        fat: 35,
        servings: 1,
        mealType: 'dinner',
        checked: false,
      },
    ],
  }
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
  {
    id: 'r2',
    title: 'Protein Shake',
    kcal: 200,
    protein: 25,
    carbs: 10,
    fat: 5,
  },
  {
    id: 'r3',
    title: 'Salmon Dinner',
    kcal: 600,
    protein: 45,
    carbs: 30,
    fat: 35,
  },
];

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

// Update totals whenever foods change
const updateTotals = (userId: string) => {
  const log = mockDailyLogs[userId];
  if (log) {
    log.totals = calculateTotals(log.foods);
  }
};

export const subscribeToDailyLog = (
  userId: string,
  date: Date,
  callback: (log: DailyLog | null) => void
) => {
  // Mock: return mock data after a delay
  const log = mockDailyLogs[userId] || mockDailyLogs['default'];
  setTimeout(() => callback(log), 100);

  // Return unsubscribe function (mock)
  return () => {};
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
  // Mock: add food to the log
  const log = mockDailyLogs[userId] || mockDailyLogs['default'];
  const newFood: LoggedFood = {
    ...food,
    id: Date.now().toString(), // Simple ID generation
  };
  log.foods.push(newFood);
  updateTotals(userId);
  console.log('Added food:', newFood);
};

export const toggleFoodChecked = async (
  userId: string,
  date: Date,
  foodId: string
) => {
  // Mock: toggle food checked status
  const log = mockDailyLogs[userId] || mockDailyLogs['default'];
  const food = log.foods.find(f => f.id === foodId);
  if (food) {
    food.checked = !food.checked;
    updateTotals(userId);
    console.log('Toggled food:', foodId, 'to', food.checked);
  }
};

export const removeFoodFromLog = async (
  userId: string,
  date: Date,
  foodId: string
) => {
  // Mock: remove food from the log
  const log = mockDailyLogs[userId] || mockDailyLogs['default'];
  const index = log.foods.findIndex(f => f.id === foodId);
  if (index !== -1) {
    log.foods.splice(index, 1);
    updateTotals(userId);
    console.log('Removed food:', foodId);
  }
};