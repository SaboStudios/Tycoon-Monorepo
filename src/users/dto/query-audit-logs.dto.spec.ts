import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { QueryAuditLogsDto, MAX_AUDIT_LOGS_LIMIT } from "./query-audit-logs.dto";

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(QueryAuditLogsDto, plain);
  const errors = await validate(dto);
  return { dto, errors };
}

describe("QueryAuditLogsDto", () => {
  it("defaults page to 1 and limit to 10 when nothing is provided", async () => {
    const { dto, errors } = await validateDto({});
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
  });

  it("accepts a limit at the maximum bound", async () => {
    const { errors, dto } = await validateDto({ limit: String(MAX_AUDIT_LOGS_LIMIT) });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(MAX_AUDIT_LOGS_LIMIT);
  });

  it("rejects a limit above the maximum bound", async () => {
    const { errors } = await validateDto({ limit: String(MAX_AUDIT_LOGS_LIMIT + 1) });
    expect(errors.some((e) => e.property === "limit")).toBe(true);
  });

  it("rejects an unbounded/huge limit request", async () => {
    const { errors } = await validateDto({ limit: "1000000" });
    expect(errors.some((e) => e.property === "limit")).toBe(true);
  });

  it("rejects limit < 1", async () => {
    const { errors } = await validateDto({ limit: "0" });
    expect(errors.some((e) => e.property === "limit")).toBe(true);
  });

  it("rejects page < 1", async () => {
    const { errors } = await validateDto({ page: "0" });
    expect(errors.some((e) => e.property === "page")).toBe(true);
  });
});
