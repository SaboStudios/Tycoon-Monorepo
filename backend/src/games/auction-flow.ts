export const AUCTION_DURATION_MS = 24 * 60 * 60 * 1000;
export const STARTING_BID = 10;
export const MIN_BID_INCREMENT = 5;

export type AuctionStatus = 'active' | 'completed' | 'cancelled';

export interface Bid {
  playerId: string;
  amount: number;
  placedAt: number;
}

export interface Auction {
  id: string;
  sellerId: string;
  itemId: string;
  currentBid: number;
  currentBidder: string | null;
  status: AuctionStatus;
  bids: Bid[];
  expiresAt: number;
}

export interface AuctionEvent {
  type: string;
  auctionId: string;
  playerId?: string;
  amount?: number;
}

export interface AuctionResult {
  success: boolean;
  events: AuctionEvent[];
  error?: string;
}

export function isAuctionExpired(auction: Auction, now: number = Date.now()): boolean {
  return now > auction.expiresAt;
}

export class AuctionManager {
  private auctions = new Map<string, Auction>();

  createAuction(id: string, sellerId: string, itemId: string): Auction {
    const auction: Auction = {
      id,
      sellerId,
      itemId,
      currentBid: STARTING_BID,
      currentBidder: null,
      status: 'active',
      bids: [],
      expiresAt: Date.now() + AUCTION_DURATION_MS,
    };
    this.auctions.set(id, auction);
    return auction;
  }

  getAuction(id: string): Auction | undefined {
    return this.auctions.get(id);
  }

  placeBid(id: string, playerId: string, amount: number): AuctionResult {
    const auction = this.auctions.get(id);
    if (!auction) {
      throw new Error('Auction not found');
    }
    if (auction.status !== 'active') {
      throw new Error('Auction is not active');
    }
    if (isAuctionExpired(auction)) {
      throw new Error('Auction has expired');
    }
    if (playerId === auction.sellerId) {
      throw new Error('Seller cannot bid on their own auction');
    }
    if (amount < auction.currentBid + MIN_BID_INCREMENT) {
      throw new Error('Bid is below the minimum increment');
    }

    auction.currentBid = amount;
    auction.currentBidder = playerId;
    auction.bids.push({ playerId, amount, placedAt: Date.now() });

    return {
      success: true,
      events: [{ type: 'bid_placed', auctionId: id, playerId, amount }],
    };
  }

  completeAuction(id: string): AuctionResult {
    const auction = this.auctions.get(id);
    if (!auction) {
      return { success: false, events: [], error: 'Auction not found' };
    }
    if (!auction.currentBidder) {
      return { success: false, events: [], error: 'No bids received' };
    }

    auction.status = 'completed';

    return {
      success: true,
      events: [
        {
          type: 'auction_completed',
          auctionId: id,
          playerId: auction.currentBidder,
          amount: auction.currentBid,
        },
      ],
    };
  }

  cleanupExpiredAuctions(now: number = Date.now()): number {
    let count = 0;
    for (const auction of this.auctions.values()) {
      if (auction.status !== 'active' || !isAuctionExpired(auction, now)) {
        continue;
      }

      if (auction.currentBidder) {
        auction.status = 'completed';
      } else {
        auction.status = 'cancelled';
      }
      count += 1;
    }
    return count;
  }
}
