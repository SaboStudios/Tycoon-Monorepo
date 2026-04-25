import { Module } from '@nestjs/common';
import { NearService } from './near.service';

@Module({
  providers: [NearService],
  exports: [NearService],
})
export class NearModule {}
