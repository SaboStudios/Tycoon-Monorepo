import {
  Controller,
  Post,
  Headers,
  Req,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { Request } from 'express';
import { StripeWebhookDto } from './dto/webhook.dto';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Headers('x-stripe-signature') signature: string,
    @Headers('x-stripe-timestamp') timestamp: string,
    @Req() req: Request & { rawBody: Buffer },
    @Body() body: StripeWebhookDto,
  ) {
    try {
      const isValid = this.webhooksService.verifySignature(
        signature,
        timestamp,
        req.rawBody,
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature');
      }

      return await this.webhooksService.processWebhook(body);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Invalid webhook payload');
    }
  }
}
