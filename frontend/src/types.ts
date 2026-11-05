export type Theme = "light" | "dark";
export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};
export type Family = { id: string; name: string; code?: string; role: string };
export type Overview = {
  group: Family;
  lists: {
    id: string;
    name: string;
    itemCount: number;
    completedCount: number;
  }[];
  members: { id: string; firstName: string; lastName: string; role: string }[];
};
export type Product = { id: string; name: string; category: string };
export type Unit = { id: string; name: string; abbreviation: string };
export type RecipeIngredient = Product & {
  quantity: string;
  unitId: string;
  notes: string;
};
export type Dish = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  servings?: number;
  preparationTime?: number;
  cookingTime?: number;
  createdBy?: string;
  creatorFirstName?: string;
  creatorLastName?: string;
  createdAt?: string;
  updatedAt?: string;
  instructions?: string;
  ingredients: (Product & {
    quantity: number;
    unitId?: string;
    unit?: string;
    notes?: string;
  })[];
  steps?: {
    id: string;
    stepNumber: number;
    description: string;
    durationMinutes?: number;
  }[];
};
export type MealEntry = {
  id: string;
  date: string;
  mealType: string;
  servings: number;
  dishId: string;
  dishName: string;
};
export type RecipeStep = {
  stepNumber: number;
  description: string;
  durationMinutes: string;
};
