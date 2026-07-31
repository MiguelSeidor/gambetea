import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateLeagueDto {
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  name!: string;

  /** Nombre del equipo Fantasy del creador dentro de la liga. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  teamName?: string;
}
