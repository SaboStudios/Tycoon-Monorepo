import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum GiftResponse {
  ACCEPT = 'accept',
  REJECT = 'reject',
}

export class RespondGiftDto {
  @ApiProperty({
    enum: GiftResponse,
    description: 'Accept or reject the gift',
  })
  @IsEnum(GiftResponse)
  @IsNotEmpty()
  action: GiftResponse;
}
