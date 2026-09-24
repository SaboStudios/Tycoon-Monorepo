import { IsOptional, IsString } from 'class-validator';

export class ResolveDiscrepancyDto {
  @IsString()
  resolutionNote: string;
}

export class TriggerReconciliationDto {
  @IsOptional()
  dryRun?: boolean;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
