import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTurnDto {
  @ApiPropertyOptional({
    description: 'Turn order (1-based position in play order)',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'turn_order must be >= 0' })
  @Type(() => Number)
  turn_order?: number;

  @ApiPropertyOptional({
    description: 'Board position (0–39)',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'position must be >= 0' })
  @Type(() => Number)
  position?: number;
}
