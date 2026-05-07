export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface LoggedFood {
  id: string;
  type: 'recipe' | 'food';
  sourceId: string;
  name: string;
  image?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  servings: number;
  mealType: MealType;
  checked: boolean;
  grams?: number;
}

export interface RecipeIngredient {
  name: string;
  amount: string;
}

export interface Recipe {
  id: string;
  title: string;
  image?: string;
  portions?: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients?: RecipeIngredient[];
  steps?: string[];
}

export interface DailyLog {
  totals: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  foods: LoggedFood[];
}