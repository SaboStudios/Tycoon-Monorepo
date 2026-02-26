import { PartialType } from '@nestjs/swagger';
import { CreateBoostDto } from './create-boost.dto';

export class UpdateBoostDto extends PartialType(CreateBoostDto) {}
