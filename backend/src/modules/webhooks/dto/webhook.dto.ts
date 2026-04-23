import { IsString, IsObject, IsNotEmpty } from 'class-validator';

export class BaseWebhookDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsObject()
  data: any;

  @IsString()
  @IsNotEmpty()
  created: string;
}

export class StripeWebhookDto extends BaseWebhookDto {
  @IsString()
  @IsNotEmpty()
  livemode: string;

  @IsString()
  @IsNotEmpty()
  api_version: string;

  @IsObject()
  request: any;
}