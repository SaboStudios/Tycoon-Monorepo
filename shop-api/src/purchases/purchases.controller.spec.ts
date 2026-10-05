import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { PurchasesController } from "./purchases.controller";
import { PurchasesService } from "./purchases.service";
import { Purchase, PurchaseStatus } from "./entities/purchase.entity";

const mockPurchase: Purchase = {
  id: "purchase-uuid-1",
  userId: "user-1",
  sku: "sku_gold_pack_100",
  itemId: "sku_gold_pack_100",
  quantity: 1,
  amountMinor: 1999,
  amount: 19.99,
  currency: "USD",
  status: PurchaseStatus.COMPLETED,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Purchase;

const mockService = {
  create: jest.fn(),
  findOne: jest.fn(),
};

describe("PurchasesController", () => {
  let controller: PurchasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchasesController],
      providers: [{ provide: PurchasesService, useValue: mockService }],
    })
      .overrideGuard(require("../common/guards/api-key.guard").ApiKeyAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(
        require("../common/guards/idempotency-key.guard").IdempotencyKeyGuard,
      )
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PurchasesController);
    jest.clearAllMocks();
  });

  const dto = {
    userId: "user-1",
    sku: "sku_gold_pack_100",
    quantity: 1,
    amountMinor: 1999,
    currency: "USD",
  } as any;

  // ── POST /purchases ───────────────────────────────────────────────────────

  it("creates a purchase when a valid idempotency key is provided", async () => {
    mockService.create.mockResolvedValue(mockPurchase);

    const result = await controller.create(dto, "valid-key-001", {
      headers: {},
    } as any);

    expect(mockService.create).toHaveBeenCalledWith(
      dto,
      "valid-key-001",
      undefined,
    );
    expect(result).toEqual(mockPurchase);
  });

  it("propagates Idempotency-Key and x-request-id to service", async () => {
    mockService.create.mockResolvedValue(mockPurchase);
    const req = {
      headers: { "x-request-id": "req-123" },
    } as any;
    await controller.create(dto, "valid-key-002", req);
    expect(mockService.create).toHaveBeenCalledWith(
      dto,
      "valid-key-002",
      "req-123",
    );
  });

  it("propagates ConflictException from service (concurrent duplicate / payload conflict)", async () => {
    mockService.create.mockRejectedValue(
      new ConflictException("Already processing"),
    );

    await expect(
      controller.create(dto, "concurrent-key", { headers: {} } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ── GET /purchases/:id ────────────────────────────────────────────────────

  it("returns a purchase by ID", async () => {
    mockService.findOne.mockResolvedValue(mockPurchase);

    const result = await controller.findOne("purchase-uuid-1");
    expect(result).toEqual(mockPurchase);
  });

  it("throws NotFoundException when purchase does not exist", async () => {
    mockService.findOne.mockResolvedValue(null);

    await expect(controller.findOne("nonexistent-id")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
