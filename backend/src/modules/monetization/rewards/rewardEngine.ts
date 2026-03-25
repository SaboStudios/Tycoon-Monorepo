import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InventoryService } from '../../perks-boosts/services/inventory.service';
import { PerksService } from '../../perks/perks.service';

interface PerkGrantInput {
  userId: number;
  perkId: number;
  quantity?: number;
  source: string;
}

interface PurchasePerkInput {
  userId: number;
  perkId: number;
  quantity?: number;
  availableCurrency: number;
  clientUnitPrice?: number;
}

@Injectable()
export class RewardEngine {
  private readonly logger = new Logger(RewardEngine.name);
  private readonly purchaseWindows = new Map<number, number[]>();

  private readonly maxPurchasesPerMinute = 10;

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly perksService: PerksService,
  ) {}

  async buyPerk(input: PurchasePerkInput) {
    const {
      userId,
      perkId,
      quantity = 1,
      availableCurrency,
      clientUnitPrice,
    } = input;

    this.guardPurchaseRateLimit(userId);

    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    const perk = await this.perksService.findOnePublic(perkId);
    const serverUnitPrice = Number(perk.price);

    if (
      typeof clientUnitPrice === 'number' &&
      Math.abs(clientUnitPrice - serverUnitPrice) > 0.01
    ) {
      this.logger.warn(
        `Suspicious client price for user=${userId} perk=${perkId}. client=${clientUnitPrice} server=${serverUnitPrice}`,
      );
      throw new BadRequestException('Price mismatch');
    }

    const totalCost = serverUnitPrice * quantity;
    if (availableCurrency < totalCost) {
      throw new BadRequestException('Insufficient currency');
    }

    await this.inventoryService.addPerksToInventory(userId, [
      { perkId, quantity },
    ]);

    return {
      purchased: true,
      totalCost,
      remainingCurrency: availableCurrency - totalCost,
    };
  }

  async earnPerk(input: PerkGrantInput) {
    return this.grantPerk(input, false);
  }

  async grantPromotionalPerk(
    input: Omit<PerkGrantInput, 'source'> & { grantedBy: string },
  ) {
    return this.grantPerk(
      {
        userId: input.userId,
        perkId: input.perkId,
        quantity: input.quantity,
        source: `promo:${input.grantedBy}`,
      },
      true,
    );
  }

  private async grantPerk(input: PerkGrantInput, promotional: boolean) {
    const { userId, perkId, quantity = 1, source } = input;

    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    await this.perksService.findOnePublic(perkId);
    await this.inventoryService.addPerksToInventory(userId, [
      { perkId, quantity },
    ]);

    this.logger.log(
      `Granted perk=${perkId} qty=${quantity} to user=${userId} source=${source} promotional=${promotional}`,
    );

    return {
      granted: true,
      userId,
      perkId,
      quantity,
      promotional,
      source,
    };
  }

  private guardPurchaseRateLimit(userId: number) {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    const timestamps = (this.purchaseWindows.get(userId) || []).filter(
      (ts) => ts >= oneMinuteAgo,
    );

    if (timestamps.length >= this.maxPurchasesPerMinute) {
      this.logger.warn(`Rate limit triggered for user=${userId}`);
      throw new BadRequestException(
        'Too many purchase attempts. Please retry shortly.',
      );
    }

    timestamps.push(now);
    this.purchaseWindows.set(userId, timestamps);
  }
}
