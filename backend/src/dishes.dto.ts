import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class DishIngredientDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @Min(0.001)
  quantity!: number;

  @IsUUID()
  @IsOptional()
  unitId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateDishDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  servings?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  preparationTime?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  cookingTime?: number;

  @IsString()
  @IsOptional()
  instructions?: string;

  @ValidateNested({ each: true })
  @Type(() => DishIngredientDto)
  ingredients!: DishIngredientDto[];
}
