import { IsString, MinLength, IsNotEmpty } from "class-validator";

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
