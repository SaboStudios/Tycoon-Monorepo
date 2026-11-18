import { createAuction, createAuctionStore } from './auction-flow';

describe('createAuction', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores the created auction in the map', () => {
    const store = createAuctionStore();
    const auction = createAuction(store, 'Vintage Lamp', 100);

    expect(store.auctions.get(auction.id)).toBe(auction);
    expect(auction.item).toBe('Vintage Lamp');
    expect(auction.startingBid).toBe(100);
    expect(auction.currentBid).toBe(100);
    expect(auction.highestBidder).toBeNull();
    expect(auction.status).toBe('open');
  });

  it('produces different ids for auctions created with a stubbed clock', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const store = createAuctionStore();

    const first = createAuction(store, 'Item A', 10);
    const second = createAuction(store, 'Item B', 20);

    expect(first.id).not.toBe(second.id);
    expect(store.auctions.size).toBe(2);
    expect(store.auctions.get(first.id)).toBe(first);
    expect(store.auctions.get(second.id)).toBe(second);
  });

  it('does not derive ids from Math.random', () => {
    const randomSpy = jest.spyOn(Math, 'random');
    const store = createAuctionStore();

    createAuction(store, 'Item', 5);

    expect(randomSpy).not.toHaveBeenCalled();
  });
});
