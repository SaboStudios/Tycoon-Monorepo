import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UnlockSkinDto {
  @ApiProperty({ description: 'The ID of the skin to unlock', example: 1 })
  @IsNumber()
  skinId: number;
}
