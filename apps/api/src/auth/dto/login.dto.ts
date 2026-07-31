import { IsString } from "class-validator";

export class LoginDto {
  // Acepta email o nombre de usuario (p. ej. la cuenta "admin"). El registro sí exige email.
  @IsString()
  email!: string;

  @IsString()
  password!: string;
}
