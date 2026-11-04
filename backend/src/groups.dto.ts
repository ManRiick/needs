import { IsString, MinLength } from "class-validator";

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

export class JoinGroupDto {
  @IsString()
  @MinLength(6)
  code!: string;
}
