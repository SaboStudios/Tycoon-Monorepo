import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { QueryAuditLogsDto, MAX_AUDIT_LOGS_LIMIT } from "./query-audit-logs.dto";

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(QueryAuditLogsDto, plain);
  const errors = await validate(dto);
  return { dto, errors };
}

describe("QueryAuditLogsDto", () => {
  describe("defaults", () => {
    it("should default page to 1 and limit to 10 when nothing is provided", async () => {
      const { dto, errors } = await validateDto({});
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(10);
    });
  });

  describe("page", () => {
    it("should accept a valid page number", async () => {
      const { errors } = await validateDto({ page: "3" });
      expect(errors).toHaveLength(0);
    });

    it("should coerce string numbers to integers", async () => {
      const { dto } = await validateDto({ page: "5" });
      expect(dto.page).toBe(5);
    });

    it("should reject page < 1", async () => {
      const { errors } = await validateDto({ page: "0" });
      expect(errors.some((e) => e.property === "page")).toBe(true);
    });

    it("should reject negative page", async () => {
      const { errors } = await validateDto({ page: "-1" });
      expect(errors.some((e) => e.property === "page")).toBe(true);
    });

    it("should reject non-integer page", async () => {
      const { errors } = await validateDto({ page: "1.5" });
      expect(errors.some((e) => e.property === "page")).toBe(true);
    });
  });

  describe("limit", () => {
    it("should accept a valid limit", async () => {
      const { errors } = await validateDto({ limit: "50" });
      expect(errors).toHaveLength(0);
    });

    it("should coerce string limit to number", async () => {
      const { dto } = await validateDto({ limit: "25" });
      expect(dto.limit).toBe(25);
    });

    it("should reject limit < 1", async () => {
      const { errors } = await validateDto({ limit: "0" });
      expect(errors.some((e) => e.property === "limit")).toBe(true);
    });

    it("should accept a limit at the maximum bound", async () => {
      const { errors, dto } = await validateDto({ limit: String(MAX_AUDIT_LOGS_LIMIT) });
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(MAX_AUDIT_LOGS_LIMIT);
    });

    it("should reject a limit above the maximum bound", async () => {
      const { errors } = await validateDto({ limit: String(MAX_AUDIT_LOGS_LIMIT + 1) });
      expect(errors.some((e) => e.property === "limit")).toBe(true);
    });

    it("should reject an unbounded/huge limit request", async () => {
      const { errors } = await validateDto({ limit: "1000000" });
      expect(errors.some((e) => e.property === "limit")).toBe(true);
    });

    it("should accept limit of exactly 1", async () => {
      const { errors } = await validateDto({ limit: "1" });
      expect(errors).toHaveLength(0);
    });
  });

  describe("combined", () => {
    it("should accept both valid page and limit", async () => {
      const { dto, errors } = await validateDto({ page: "2", limit: "15" });
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(15);
    });
  });
});
