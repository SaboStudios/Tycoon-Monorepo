import { PartialType } from '@nestjs/swagger';
import { CreatePerkDto } from './create-perk.dto';

export class UpdatePerkDto extends PartialType(CreatePerkDto) {}
