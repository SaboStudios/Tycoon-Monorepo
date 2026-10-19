import { IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

/** Hard ceiling on page size so an admin cannot request an unbounded audit-log page. */
export const MAX_AUDIT_LOGS_LIMIT = 100;

export class QueryAuditLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AUDIT_LOGS_LIMIT, {
    message: `limit cannot exceed ${MAX_AUDIT_LOGS_LIMIT}`,
  })
  limit?: number = 10;
}
