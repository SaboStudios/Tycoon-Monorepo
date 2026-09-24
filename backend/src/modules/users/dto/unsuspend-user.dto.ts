import { IsInt, IsNotEmpty } from 'class-validator';

export class UnsuspendUserDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;
}
