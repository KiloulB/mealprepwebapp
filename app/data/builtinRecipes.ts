import type { Recipe } from "../types/user";

export type BuiltinRecipe = Recipe & { id: string; category: string };

export const builtinRecipes: BuiltinRecipe[] = [];
