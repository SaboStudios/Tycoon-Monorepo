import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName: string;

  @IsString()
  @MinLength(6)
  password: string;
}


export class RegisterUserDto {
  @IsString()
  @Length(3, 100)
  username: string;

  @IsString()
  @Length(3, 100)
  address: string;

  @IsOptional()
  @IsString()
  @Length(3, 50)
  chain?: string; // Optional, defaults to 'BASE' in service
}
