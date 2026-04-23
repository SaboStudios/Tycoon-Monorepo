import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WalletLoginDto {
  @ApiProperty({ example: '0xAbCd1234...', description: 'EVM wallet address' })
  @IsString({ message: 'address must be a string' })
  @IsNotEmpty({ message: 'address should not be empty' })
  @MaxLength(100, { message: 'address must be at most 100 characters' })
  @Matches(/^0x[0-9a-fA-F]{1,}$/, {
    message: 'address must be a valid hex wallet address starting with 0x',
  })
  address: string;

  @ApiProperty({ example: 'BASE', description: 'Blockchain chain identifier' })
  @IsString({ message: 'chain must be a string' })
  @IsNotEmpty({ message: 'chain should not be empty' })
  @MaxLength(50, { message: 'chain must be at most 50 characters' })
  chain: string;
}
