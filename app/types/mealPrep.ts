export interface PrepMeal {
  id: string;
  recipeId: string;
  recipeTitle: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  pattern: "daily" | "alternateA" | "alternateB" | "manual";
  manualDays?: number[];
}

export interface MealPrepPlan {
  startDate: string;
  endDate: string;
  cookDay: number;
  cookFrequency: "weekly" | "biweekly" | "custom";
  cookFrequencyDays?: number;
  timeSpanWeeks: number;
  mealTypes: ("breakfast" | "lunch" | "dinner")[];
  meals: PrepMeal[];
  status: "active" | "completed";
}
