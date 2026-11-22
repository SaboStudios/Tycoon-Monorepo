import {
  AuctionManager,
  AUCTION_DURATION_MS,
  MIN_BID_INCREMENT,
  STARTING_BID,
  isAuctionExpired,
} from './auction-flow';

describe('AuctionManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createAuction', () => {
    it('seeds currentBid with the starting bid and no bidder', () => {
      const manager = new AuctionManager();
      const auction = manager.createAuction('a1', 'seller', 'item');

      expect(auction.currentBid).toBe(STARTING_BID);
      expect(auction.currentBidder).toBeNull();
      expect(auction.status).toBe('active');
      expect(auction.bids).toEqual([]);
      expect(auction.expiresAt).toBe(Date.now() + AUCTION_DURATION_MS);
    });
  });

  describe('placeBid', () => {
    it('throws when the auction does not exist', () => {
      const manager = new AuctionManager();
      expect(() => manager.placeBid('missing', 'p1', 100)).toThrow('Auction not found');
    });

    it('throws "Auction not found" for an unknown auction id and creates no auction', () => {
      const manager = new AuctionManager();

      expect(() => manager.placeBid('unknown-auction', 'p1', STARTING_BID + MIN_BID_INCREMENT)).toThrow(
        'Auction not found',
      );
      expect(manager.getAuction('unknown-auction')).toBeUndefined();
      expect(manager.cleanupExpiredAuctions()).toBe(0);
    });

    it('throws when the auction is not active', () => {
      const manager = new AuctionManager();
      const auction = manager.createAuction('a1', 'seller', 'item');
      auction.status = 'completed';

      expect(() => manager.placeBid('a1', 'p1', 100)).toThrow('Auction is not active');
    });

    it('rejects a bid below currentBid + minBidIncrement', () => {
      const manager = new AuctionManager();
      manager.createAuction('a1', 'seller', 'item');

      expect(() => manager.placeBid('a1', 'p1', STARTING_BID + MIN_BID_INCREMENT - 1)).toThrow();
    });

    it('rejects a NaN bid without changing currentBid', () => {
      const manager = new AuctionManager();
      manager.createAuction('a1', 'seller', 'item');

      expect(() => manager.placeBid('a1', 'p1', NaN)).toThrow('NaN');
      expect(manager.getAuction('a1')?.currentBid).toBe(STARTING_BID);
      expect(manager.getAuction('a1')?.currentBidder).toBeNull();
      expect(manager.getAuction('a1')?.bids).toEqual([]);
    });

    it('rejects an Infinity bid without changing currentBid', () => {
      const manager = new AuctionManager();
      manager.createAuction('a1', 'seller', 'item');

      expect(() => manager.placeBid('a1', 'p1', Infinity)).toThrow('Infinity');
      expect(manager.getAuction('a1')?.currentBid).toBe(STARTING_BID);
      expect(manager.getAuction('a1')?.currentBidder).toBeNull();
      expect(manager.getAuction('a1')?.bids).toEqual([]);
    });

    it('rejects a bid from the seller', () => {
      const manager = new AuctionManager();
      manager.createAuction('a1', 'seller', 'item');

      expect(() => manager.placeBid('a1', 'seller', STARTING_BID + MIN_BID_INCREMENT)).toThrow(
        'Seller cannot bid on their own auction',
      );
    });

    it('accepts a valid bid and updates currentBid, currentBidder and bids', () => {
      const manager = new AuctionManager();
      manager.createAuction('a1', 'seller', 'item');

      const result = manager.placeBid('a1', 'p1', STARTING_BID + MIN_BID_INCREMENT);
      const auction = manager.getAuction('a1');

      expect(result.success).toBe(true);
      expect(auction?.currentBid).toBe(STARTING_BID + MIN_BID_INCREMENT);
      expect(auction?.currentBidder).toBe('p1');
      expect(auction?.bids).toHaveLength(1);
      expect(auction?.bids[0]).toMatchObject({
        playerId: 'p1',
        amount: STARTING_BID + MIN_BID_INCREMENT,
      });
    });

    it('throws on an expired auction without mutating its status', () => {
      const manager = new AuctionManager();
      const auction = manager.createAuction('a1', 'seller', 'item');

      jest.setSystemTime(auction.expiresAt + 1);

      expect(() => manager.placeBid('a1', 'p1', STARTING_BID + MIN_BID_INCREMENT)).toThrow(
        'Auction has expired',
      );
      expect(manager.getAuction('a1')?.status).toBe('active');
    });

    it('accepts a bid at exactly expiresAt', () => {
      const manager = new AuctionManager();
      const auction = manager.createAuction('a1', 'seller', 'item');

      jest.setSystemTime(auction.expiresAt);

      const result = manager.placeBid('a1', 'p1', STARTING_BID + MIN_BID_INCREMENT);
      expect(result.success).toBe(true);
      expect(manager.getAuction('a1')?.currentBidder).toBe('p1');
    });

    it('rejects a bid at expiresAt + 1', () => {
      const manager = new AuctionManager();
      const auction = manager.createAuction('a1', 'seller', 'item');

      jest.setSystemTime(auction.expiresAt + 1);

      expect(() => manager.placeBid('a1', 'p1', STARTING_BID + MIN_BID_INCREMENT)).toThrow(
        'Auction has expired',
      );
    });
  });

  describe('completeAuction', () => {
    it('returns a failure result when no bids were received', () => {
      const manager = new AuctionManager();
      manager.createAuction('a1', 'seller', 'item');

      expect(manager.completeAuction('a1')).toEqual({
        success: false,
        events: [],
        error: 'No bids received',
      });
    });

    it('completes an active auction with a bidder once', () => {
      const manager = new AuctionManager();
      manager.createAuction('a1', 'seller', 'item');
      manager.placeBid('a1', 'p1', STARTING_BID + MIN_BID_INCREMENT);

      const result = manager.completeAuction('a1');
      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({ type: 'auction.completed', auctionId: 'a1' });
      expect(manager.getAuction('a1')?.status).toBe('completed');
    });

    it('returns the existing result without a second event when already completed', () => {
      const manager = new AuctionManager();
      manager.createAuction('a1', 'seller', 'item');
      manager.placeBid('a1', 'p1', STARTING_BID + MIN_BID_INCREMENT);

      const first = manager.completeAuction('a1');
      const second = manager.completeAuction('a1');

      expect(second.success).toBe(true);
      expect(second.events).toEqual([]);
      expect(second.result).toEqual(first.result);
      expect(manager.getAuction('a1')?.status).toBe('completed');
    });

    it('fails to complete a cancelled auction', () => {
      const manager = new AuctionManager();
      const auction = manager.createAuction('a1', 'seller', 'item');
      manager.placeBid('a1', 'p1', STARTING_BID + MIN_BID_INCREMENT);
      auction.status = 'cancelled';

      const result = manager.completeAuction('a1');
      expect(result.success).toBe(false);
      expect(result.events).toEqual([]);
      expect(result.error).toBe('Auction is cancelled');
      expect(manager.getAuction('a1')?.status).toBe('cancelled');
    });
  });

  describe('cleanupExpiredAuctions', () => {
    it('cancels an expired auction that received no bids', () => {
      const manager = new AuctionManager();
      const expired = manager.createAuction('a1', 'seller', 'item');

      jest.setSystemTime(expired.expiresAt + 1);

      expect(manager.cleanupExpiredAuctions()).toBe(1);
      expect(manager.getAuction('a1')?.status).toBe('cancelled');
    });

    it('completes an expired auction that received a bid', () => {
      const manager = new AuctionManager();
      const expired = manager.createAuction('a1', 'seller', 'item');
      manager.placeBid('a1', 'p1', STARTING_BID + MIN_BID_INCREMENT);

      jest.setSystemTime(expired.expiresAt + 1);

      expect(manager.cleanupExpiredAuctions()).toBe(1);
      expect(manager.getAuction('a1')?.status).toBe('completed');
    });

    it('only touches active auctions past expiresAt and returns the count', () => {
      const manager = new AuctionManager();
      const expired = manager.createAuction('a1', 'seller', 'item');
      manager.createAuction('a2', 'seller', 'item');

      jest.setSystemTime(expired.expiresAt + 1);

      expect(manager.cleanupExpiredAuctions()).toBe(1);
      expect(manager.getAuction('a1')?.status).toBe('cancelled');
      expect(manager.getAuction('a2')?.status).toBe('active');
    });

    it('does not complete an auction at exactly expiresAt', () => {
      const manager = new AuctionManager();
      const auction = manager.createAuction('a1', 'seller', 'item');

      jest.setSystemTime(auction.expiresAt);

      expect(manager.cleanupExpiredAuctions()).toBe(0);
      expect(manager.getAuction('a1')?.status).toBe('active');
    });
  });

  describe('isAuctionExpired', () => {
    it('uses a strict greater-than comparison against expiresAt', () => {
      const manager = new AuctionManager();
      const auction = manager.createAuction('a1', 'seller', 'item');

      expect(isAuctionExpired(auction, auction.expiresAt)).toBe(false);
      expect(isAuctionExpired(auction, auction.expiresAt + 1)).toBe(true);
    });
  });
});
