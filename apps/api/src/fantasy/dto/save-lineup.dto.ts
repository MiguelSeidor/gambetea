import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from "class-validator";
import { FORMATIONS } from "../fantasy.rules";

export class SaveLineupDto {
  /** Jornada objetivo. Si se omite, la próxima jornada editable (UPCOMING/OPEN). */
  @IsOptional()
  @IsString()
  gameweekId?: string;

  @IsIn(Object.keys(FORMATIONS))
  formation!: string;

  @IsArray()
  @ArrayMinSize(11)
  @ArrayMaxSize(11)
  @IsString({ each: true })
  starters!: string[];

  /** Banquillo: 1 hueco (ADR-011). */
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(1)
  @IsString({ each: true })
  bench!: string[];

  @IsOptional()
  @IsString()
  captainId?: string;

  /** Entrenador elegido para la jornada (uno de los del roster). */
  @IsOptional()
  @IsString()
  coachId?: string;
}
