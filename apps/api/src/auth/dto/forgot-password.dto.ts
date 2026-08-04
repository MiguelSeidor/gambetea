import { IsString } from "class-validator";

export class ForgotPasswordDto {
  // Acepta email o usuario; se busca por el campo email.
  @IsString()
  email!: string;
}
