import { PartialType } from '@nestjs/swagger';
import { CreateSkinDto } from './create-skin.dto';

export class UpdateSkinDto extends PartialType(CreateSkinDto) {}
