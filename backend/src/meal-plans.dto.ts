import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export enum MealTypeDto {
  breakfast = "breakfast",
  lunch = "lunch",
  dinner = "dinner",
  snack = "snack",
}

export class MealPlanQueryDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;
}

export class AddMealPlanEntryDto {
  @IsUUID()
  dishId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(MealTypeDto)
  mealType!: MealTypeDto;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  servings?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
