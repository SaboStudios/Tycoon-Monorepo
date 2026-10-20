/**
 * SW-BE-010: Shop & purchases — DTO validation and error mapping
 *
 * Validates that shop DTOs enforce their constraints correctly.
 * All tests are pure unit tests — no HTTP server, no DB.
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateShopItemDto } from './create-shop-item.dto';
import { CreatePurchaseDto, MAX_PURCHASE_QUANTITY } from './create-purchase.dto';
import { FilterShopItemsDto } from './filter-shop-items.dto';
import { PurchaseAndGiftDto } from './purchase-and-gift.dto';
import { ShopItemType, ShopItemRarity } from '../enums/shop-item-type.enum';

async function getErrors(DtoClass: new () => object, plain: object) {
  const instance = plainToInstance(DtoClass as new () => object, plain);
  const errors = await validate(instance as object);
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
    const errors = await getErrors(CreateShopItemDto, { ...valid, type: 'weapon' });
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
    const errors = await getErrors(CreateShopItemDto, { ...valid, price: 9.999 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects non-ISO-4217 currency', async () => {
    const errors = await getErrors(CreateShopItemDto, { ...valid, currency: 'dollars' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects lowercase currency', async () => {
    const errors = await getErrors(CreateShopItemDto, { ...valid, currency: 'usd' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid ISO 4217 currency', async () => {
    expect(await getErrors(CreateShopItemDto, { ...valid, currency: 'EUR' })).toHaveLength(0);
  });

  it('rejects invalid rarity', async () => {
    const errors = await getErrors(CreateShopItemDto, { ...valid, rarity: 'mythic' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts all valid rarity values', async () => {
    for (const rarity of Object.values(ShopItemRarity)) {
      expect(await getErrors(CreateShopItemDto, { ...valid, rarity })).toHaveLength(0);
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
    const errors = await getErrors(CreatePurchaseDto, { ...valid, quantity: 0 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it(`rejects quantity above MAX_PURCHASE_QUANTITY (${MAX_PURCHASE_QUANTITY})`, async () => {
    const errors = await getErrors(CreatePurchaseDto, { ...valid, quantity: MAX_PURCHASE_QUANTITY + 1 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it(`accepts quantity equal to MAX_PURCHASE_QUANTITY`, async () => {
    expect(await getErrors(CreatePurchaseDto, { ...valid, quantity: MAX_PURCHASE_QUANTITY })).toHaveLength(0);
  });

  it('rejects coupon_code exceeding 50 chars', async () => {
    const errors = await getErrors(CreatePurchaseDto, { ...valid, coupon_code: 'A'.repeat(51) });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects idempotency_key exceeding 100 chars', async () => {
    const errors = await getErrors(CreatePurchaseDto, { ...valid, idempotency_key: 'x'.repeat(101) });
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
    const errors = await getErrors(PurchaseAndGiftDto, { ...valid, receiver_id: 0 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it(`rejects quantity above MAX_PURCHASE_QUANTITY`, async () => {
    const errors = await getErrors(PurchaseAndGiftDto, { ...valid, quantity: MAX_PURCHASE_QUANTITY + 1 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects message exceeding 500 chars', async () => {
    const errors = await getErrors(PurchaseAndGiftDto, { ...valid, message: 'x'.repeat(501) });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts message at exactly 500 chars', async () => {
    expect(await getErrors(PurchaseAndGiftDto, { ...valid, message: 'x'.repeat(500) })).toHaveLength(0);
  });
});
