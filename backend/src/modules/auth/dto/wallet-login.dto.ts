import { IsNotEmpty, IsString } from 'class-validator';

export class WalletLoginDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  chain: string;
}
