import * as gifts from './index';

describe('gifts module barrel', () => {
  it('exports the module, service and controller', () => {
    expect(gifts.GiftsModule).toBeDefined();
    expect(gifts.GiftsService).toBeDefined();
    expect(gifts.GiftsController).toBeDefined();
  });

  it('exports the entity and status enum', () => {
    expect(gifts.Gift).toBeDefined();
    expect(gifts.GiftStatus).toBeDefined();
  });

  it('exports the DTOs', () => {
    expect(gifts.CreateGiftDto).toBeDefined();
    expect(gifts.FilterGiftsDto).toBeDefined();
    expect(gifts.RespondGiftDto).toBeDefined();
  });
});
