import { IsString, IsNotEmpty, IsInt } from 'class-validator';

export class SuspendUserDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
