import { IsOptional, IsString, Length, MaxLength } from "class-validator";

export class JoinLeagueDto {
  @IsString()
  @Length(6, 6)
  inviteCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  teamName?: string;
}
