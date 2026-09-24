import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ToggleMortgageDto {
  @IsBoolean()
  @IsNotEmpty()
  is_mortgaged: boolean;
}
