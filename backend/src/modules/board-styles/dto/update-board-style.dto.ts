import { PartialType } from '@nestjs/swagger';
import { CreateBoardStyleDto } from './create-board-style.dto';

export class UpdateBoardStyleDto extends PartialType(CreateBoardStyleDto) {}
