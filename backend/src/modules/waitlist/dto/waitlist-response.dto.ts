import { ApiProperty } from '@nestjs/swagger';

export class WaitlistEntryDto {
  @ApiProperty({ nullable: true })
  wallet_address: string | null;

  @ApiProperty({ nullable: true })
  email_address: string | null;

  @ApiProperty({ nullable: true })
  telegram_username: string | null;

  @ApiProperty()
  joined_at: Date;
}

export class WaitlistResponseDto {
  @ApiProperty({ example: 'You have been added to the waitlist.' })
  message: string;

  @ApiProperty({ type: WaitlistEntryDto })
  data: WaitlistEntryDto;
}
