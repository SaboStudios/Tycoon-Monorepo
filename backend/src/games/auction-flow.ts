export const AUCTION_DURATION_MS = 60000;
export const MIN_BID_INCREMENT = 10;
export const STARTING_BID = 10;

export interface Bid {
  playerId: string;
  amount: number;
  timestamp: number;
}

export interface AuctionState {
  id: string;
  sellerId: string;
  itemId: string;
  startingBid: number;
  minBidIncrement: number;
  currentBid: number;
  currentBidder: string | null;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: number;
  expiresAt: number;
  bids: Bid[];
}

/**
 * Pure expiry predicate shared by `placeBid` and `cleanupExpiredAuctions` so the
 * boundary is defined once. An auction is expired only once `now` is strictly
 * greater than `expiresAt`; a bid at exactly `expiresAt` is still accepted.
 */
export function isAuctionExpired(auction: AuctionState, now: number = Date.now()): boolean {
  return now > auction.expiresAt;
}

export class AuctionManager {
  private auctions: Map<string, AuctionState> = new Map();

  createAuction(
    sellerId: string,
    itemId: string,
    startingBid: number = STARTING_BID,
    minBidIncrement: number = MIN_BID_INCREMENT,
  ): AuctionState {
    const now = Date.now();
    const auction: AuctionState = {
      id: `auction-${now}-${Math.random().toString(36).slice(2, 8)}`,
      sellerId,
      itemId,
      startingBid,
      minBidIncrement,
      currentBid: startingBid,
      currentBidder: null,
      status: 'active',
      createdAt: now,
      expiresAt: now + AUCTION_DURATION_MS,
      bids: [],
    };
    this.auctions.set(auction.id, auction);
    return auction;
  }

  getAuction(auctionId: string): AuctionState | undefined {
    return this.auctions.get(auctionId);
  }

  getActiveAuctions(): AuctionState[] {
    return Array.from(this.auctions.values()).filter((a) => a.status === 'active');
  }

  placeBid(auctionId: string, playerId: string, amount: number): AuctionState {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }
    if (auction.status !== 'active') {
      throw new Error('Auction is not active');
    }
    if (isAuctionExpired(auction)) {
      // Rejected bids must not mutate the auction; the transition is owned by
      // `cleanupExpiredAuctions` / `completeAuction`.
      throw new Error('Auction has expired');
    }
    if (playerId === auction.sellerId) {
      throw new Error('Seller cannot bid on their own auction');
    }
    if (amount < auction.currentBid + auction.minBidIncrement) {
      throw new Error('Bid must be at least the current bid plus the minimum increment');
    }

    auction.currentBid = amount;
    auction.currentBidder = playerId;
    auction.bids.push({ playerId, amount, timestamp: Date.now() });
    return auction;
  }

  completeAuction(auctionId: string): { success: boolean; events: string[]; error?: string } {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      return { success: false, events: [], error: 'Auction not found' };
    }
    if (auction.currentBidder === null) {
      return { success: false, events: [], error: 'No bids received' };
    }

    auction.status = 'completed';
    return {
      success: true,
      events: ['auction.completed'],
    };
  }

  cleanupExpiredAuctions(now: number = Date.now()): number {
    let count = 0;
    for (const auction of this.auctions.values()) {
      if (auction.status === 'active' && isAuctionExpired(auction, now)) {
        auction.status = 'completed';
        count += 1;
      }
    }
    return count;
  }
}
