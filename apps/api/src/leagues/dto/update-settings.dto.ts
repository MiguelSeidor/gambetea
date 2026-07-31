import { IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";

export class UpdateSettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000)
  prizePerPoint?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(0.5)
  salaryRate?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100_000_000)
  compensationStep?: number;

  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000)
  tvRights?: number;

  @IsOptional() @IsInt() @Min(1_000_000) @Max(2_000_000_000)
  initialBudget?: number;

  @IsOptional() @IsInt() @Min(1) @Max(10)
  clauseMultiplier?: number;
}
