import { IsEnum, IsNotEmpty } from "class-validator";
import { UserStatus } from "../entities/user.entity";

export class UpdateUserStatusDto {
  @IsNotEmpty()
  @IsEnum(UserStatus)
  status: UserStatus;
}
