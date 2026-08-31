import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** The only event names this endpoint accepts (issue #1313). */
export const TOUR_EVENT_NAMES = [
  'tour_started',
  'tour_completed',
  'tour_skipped',
  'tour_step_viewed',
] as const;

export type TourEventName = (typeof TOUR_EVENT_NAMES)[number];

export class TourEventDataDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  step?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalSteps?: number;

  @IsOptional()
  @IsString()
  stepId?: string;

  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}

export class TrackTourEventDto {
  /** Rejects unknown event names instead of silently accepting them. */
  @IsIn(TOUR_EVENT_NAMES, {
    message: `event must be one of: ${TOUR_EVENT_NAMES.join(', ')}`,
  })
  event: TourEventName;

  @ValidateNested()
  @Type(() => TourEventDataDto)
  data: TourEventDataDto;
}
