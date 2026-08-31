/**
 * SW-BE-010: Shop & purchases — DTO validation and error mapping
 *
 * Validates that shop DTOs enforce their constraints correctly.
 * All tests are pure unit tests — no HTTP server, no DB.
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateShopItemDto } from './create-shop-item.dto';
import {
  CreatePurchaseDto,
  MAX_PURCHASE_QUANTITY,
} from './create-purchase.dto';
import { FilterShopItemsDto } from './filter-shop-items.dto';
import { PurchaseAndGiftDto } from './purchase-and-gift.dto';
import { UpdateShopPriceDto } from './update-shop-price.dto';
import {
  BulkUpdateShopItemsDto,
  MAX_BULK_UPDATE_ITEMS,
} from './bulk-update-shop-items.dto';
import { ShopItemType, ShopItemRarity } from '../enums/shop-item-type.enum';

async function getErrors(DtoClass: new () => object, plain: object) {
  const instance = plainToInstance(DtoClass as new () => object, plain);
  const errors = await validate(instance);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

// ---------------------------------------------------------------------------
// CreateShopItemDto
// ---------------------------------------------------------------------------

describe('CreateShopItemDto validation (SW-BE-010)', () => {
  const valid = { name: 'Golden Dice', type: ShopItemType.DICE, price: 9.99 };

  it('passes with minimal valid payload', async () => {
    expect(await getErrors(CreateShopItemDto, valid)).toHaveLength(0);
  });

  it('rejects missing name', async () => {
    const errors = await getErrors(CreateShopItemDto, { ...valid, name: '' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid type', async () => {
    const errors = await getErrors(CreateShopItemDto, {
      ...valid,
      type: 'weapon',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects zero price', async () => {
    const errors = await getErrors(CreateShopItemDto, { ...valid, price: 0 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects negative price', async () => {
    const errors = await getErrors(CreateShopItemDto, { ...valid, price: -1 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects price with more than 2 decimal places', async () => {
    const errors = await getErrors(CreateShopItemDto, {
      ...valid,
      price: 9.999,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects non-ISO-4217 currency', async () => {
    const errors = await getErrors(CreateShopItemDto, {
      ...valid,
      currency: 'dollars',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects lowercase currency', async () => {
    const errors = await getErrors(CreateShopItemDto, {
      ...valid,
      currency: 'usd',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid ISO 4217 currency', async () => {
    expect(
      await getErrors(CreateShopItemDto, { ...valid, currency: 'EUR' }),
    ).toHaveLength(0);
  });

  it('rejects invalid rarity', async () => {
    const errors = await getErrors(CreateShopItemDto, {
      ...valid,
      rarity: 'mythic',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts all valid rarity values', async () => {
    for (const rarity of Object.values(ShopItemRarity)) {
      expect(
        await getErrors(CreateShopItemDto, { ...valid, rarity }),
      ).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// CreatePurchaseDto
// ---------------------------------------------------------------------------

describe('CreatePurchaseDto validation (SW-BE-010)', () => {
  const valid = { shop_item_id: 1 };

  it('passes with minimal valid payload', async () => {
    expect(await getErrors(CreatePurchaseDto, valid)).toHaveLength(0);
  });

  it('rejects non-positive shop_item_id', async () => {
    const errors = await getErrors(CreatePurchaseDto, { shop_item_id: 0 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects quantity of 0', async () => {
    const errors = await getErrors(CreatePurchaseDto, {
      ...valid,
      quantity: 0,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it(`rejects quantity above MAX_PURCHASE_QUANTITY (${MAX_PURCHASE_QUANTITY})`, async () => {
    const errors = await getErrors(CreatePurchaseDto, {
      ...valid,
      quantity: MAX_PURCHASE_QUANTITY + 1,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it(`accepts quantity equal to MAX_PURCHASE_QUANTITY`, async () => {
    expect(
      await getErrors(CreatePurchaseDto, {
        ...valid,
        quantity: MAX_PURCHASE_QUANTITY,
      }),
    ).toHaveLength(0);
  });

  it('rejects coupon_code exceeding 50 chars', async () => {
    const errors = await getErrors(CreatePurchaseDto, {
      ...valid,
      coupon_code: 'A'.repeat(51),
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects idempotency_key exceeding 100 chars', async () => {
    const errors = await getErrors(CreatePurchaseDto, {
      ...valid,
      idempotency_key: 'x'.repeat(101),
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// FilterShopItemsDto
// ---------------------------------------------------------------------------

describe('FilterShopItemsDto validation (SW-BE-010)', () => {
  it('passes with empty payload', async () => {
    expect(await getErrors(FilterShopItemsDto, {})).toHaveLength(0);
  });

  it('accepts all valid ShopItemType values', async () => {
    for (const type of Object.values(ShopItemType)) {
      expect(await getErrors(FilterShopItemsDto, { type })).toHaveLength(0);
    }
  });

  it('rejects invalid type', async () => {
    const errors = await getErrors(FilterShopItemsDto, { type: 'weapon' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts all valid ShopItemRarity values', async () => {
    for (const rarity of Object.values(ShopItemRarity)) {
      expect(await getErrors(FilterShopItemsDto, { rarity })).toHaveLength(0);
    }
  });

  it('rejects invalid rarity', async () => {
    const errors = await getErrors(FilterShopItemsDto, { rarity: 'mythic' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// PurchaseAndGiftDto
// ---------------------------------------------------------------------------

describe('PurchaseAndGiftDto validation (SW-BE-010)', () => {
  const valid = { shop_item_id: 1, receiver_id: 2 };

  it('passes with minimal valid payload', async () => {
    expect(await getErrors(PurchaseAndGiftDto, valid)).toHaveLength(0);
  });

  it('rejects non-positive receiver_id', async () => {
    const errors = await getErrors(PurchaseAndGiftDto, {
      ...valid,
      receiver_id: 0,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it(`rejects quantity above MAX_PURCHASE_QUANTITY`, async () => {
    const errors = await getErrors(PurchaseAndGiftDto, {
      ...valid,
      quantity: MAX_PURCHASE_QUANTITY + 1,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects message exceeding 500 chars', async () => {
    const errors = await getErrors(PurchaseAndGiftDto, {
      ...valid,
      message: 'x'.repeat(501),
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts message at exactly 500 chars', async () => {
    expect(
      await getErrors(PurchaseAndGiftDto, {
        ...valid,
        message: 'x'.repeat(500),
      }),
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// UpdateShopPriceDto (#1282)
// ---------------------------------------------------------------------------

describe('UpdateShopPriceDto validation (#1282)', () => {
  const valid = { price: 19.99 };

  it('passes with minimal valid payload', async () => {
    expect(await getErrors(UpdateShopPriceDto, valid)).toHaveLength(0);
  });

  it('rejects zero price', async () => {
    const errors = await getErrors(UpdateShopPriceDto, { price: 0 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects negative price', async () => {
    const errors = await getErrors(UpdateShopPriceDto, { price: -5 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects price with more than 2 decimal places', async () => {
    const errors = await getErrors(UpdateShopPriceDto, { price: 19.999 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid 3-letter uppercase ISO 4217 currency', async () => {
    expect(
      await getErrors(UpdateShopPriceDto, { ...valid, currency: 'EUR' }),
    ).toHaveLength(0);
  });

  it('rejects a 2-letter currency code', async () => {
    const errors = await getErrors(UpdateShopPriceDto, {
      ...valid,
      currency: 'US',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a 4-letter currency code', async () => {
    const errors = await getErrors(UpdateShopPriceDto, {
      ...valid,
      currency: 'USDD',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a lowercase currency code', async () => {
    const errors = await getErrors(UpdateShopPriceDto, {
      ...valid,
      currency: 'usd',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a numeric/non-alphabetic currency code', async () => {
    const errors = await getErrors(UpdateShopPriceDto, {
      ...valid,
      currency: '123',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('omitting currency is valid (falls back to item default)', async () => {
    expect(await getErrors(UpdateShopPriceDto, valid)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// BulkUpdateShopItemsDto (#1281)
// ---------------------------------------------------------------------------

describe('BulkUpdateShopItemsDto validation (#1281)', () => {
  it('passes with a single valid item', async () => {
    expect(
      await getErrors(BulkUpdateShopItemsDto, {
        items: [{ id: 1, price: 9.99 }],
      }),
    ).toHaveLength(0);
  });

  it('rejects an empty items array', async () => {
    const errors = await getErrors(BulkUpdateShopItemsDto, { items: [] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it(`rejects a batch exceeding MAX_BULK_UPDATE_ITEMS (${MAX_BULK_UPDATE_ITEMS})`, async () => {
    const items = Array.from({ length: MAX_BULK_UPDATE_ITEMS + 1 }, (_, i) => ({
      id: i + 1,
      active: true,
    }));
    const errors = await getErrors(BulkUpdateShopItemsDto, { items });
    expect(errors.length).toBeGreaterThan(0);
  });

  it(`accepts a batch at exactly MAX_BULK_UPDATE_ITEMS (${MAX_BULK_UPDATE_ITEMS})`, async () => {
    const items = Array.from({ length: MAX_BULK_UPDATE_ITEMS }, (_, i) => ({
      id: i + 1,
      active: true,
    }));
    expect(await getErrors(BulkUpdateShopItemsDto, { items })).toHaveLength(0);
  });
});
