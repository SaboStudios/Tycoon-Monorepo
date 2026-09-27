import { GameState, PlayerState, GameEvent } from './board-tile-model';

export interface AuctionState {
  id: string;
  propertyIndex: number;
  sellerId: string;
  currentBid: number;
  currentBidder: string | null;
  bids: Bid[];
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  expiresAt: number;
  minBidIncrement: number;
}

export interface Bid {
  playerId: string;
  amount: number;
  timestamp: number;
}

export interface AuctionResult {
  success: boolean;
  winner?: string;
  finalBid?: number;
  events: GameEvent[];
  error?: string;
}

export const AUCTION_DURATION_MS = 60000;
export const MIN_BID_INCREMENT = 10;
export const STARTING_BID = 10;

export class AuctionManager {
  private auctions: Map<string, AuctionState> = new Map();

  createAuction(
    propertyIndex: number,
    sellerId: string,
    startingBid: number = STARTING_BID
  ): AuctionState {
    const auctionId = `auction_${propertyIndex}_${Date.now()}`;

    const auction: AuctionState = {
      id: auctionId,
      propertyIndex,
      sellerId,
      currentBid: startingBid,
      currentBidder: null,
      bids: [],
      status: 'active',
      expiresAt: Date.now() + AUCTION_DURATION_MS,
      minBidIncrement: MIN_BID_INCREMENT,
    };

    this.auctions.set(auctionId, auction);
    return auction;
  }

  placeBid(auctionId: string, playerId: string, amount: number): AuctionState {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }

    if (auction.status !== 'active') {
      throw new Error('Auction is not active');
    }

    if (Date.now() > auction.expiresAt) {
      auction.status = 'completed';
      throw new Error('Auction has expired');
    }

    if (playerId === auction.sellerId) {
      throw new Error('Seller cannot bid on their own property');
    }

    if (amount < auction.currentBid + auction.minBidIncrement) {
      throw new Error(`Bid must be at least ${auction.currentBid + auction.minBidIncrement}`);
    }

    const bid: Bid = {
      playerId,
      amount,
      timestamp: Date.now(),
    };

    auction.bids.push(bid);
    auction.currentBid = amount;
    auction.currentBidder = playerId;

    return auction;
  }

  completeAuction(auctionId: string): AuctionResult {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      return {
        success: false,
        events: [],
        error: 'Auction not found',
      };
    }

    if (auction.status !== 'active') {
      return {
        success: false,
        events: [],
        error: 'Auction is not active',
      };
    }

    auction.status = 'completed';

    if (!auction.currentBidder) {
      return {
        success: false,
        events: [],
        error: 'No bids received',
      };
    }

    const events: GameEvent[] = [
      {
        type: 'property_transferred',
        tileIndex: auction.propertyIndex,
        fromPlayerId: auction.sellerId,
        toPlayerId: auction.currentBidder,
      },
      {
        type: 'cash_changed',
        playerId: auction.currentBidder,
        delta: -auction.currentBid,
        reason: 'auction_purchase',
      },
      {
        type: 'cash_changed',
        playerId: auction.sellerId,
        delta: auction.currentBid,
        reason: 'auction_sale',
      },
    ];

    return {
      success: true,
      winner: auction.currentBidder,
      finalBid: auction.currentBid,
      events,
    };
  }

  cancelAuction(auctionId: string): AuctionState {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }

    auction.status = 'cancelled';
    return auction;
  }

  getAuction(auctionId: string): AuctionState | undefined {
    return this.auctions.get(auctionId);
  }

  getActiveAuctions(): AuctionState[] {
    return Array.from(this.auctions.values()).filter(
      (a) => a.status === 'active'
    );
  }

  getAuctionsByProperty(propertyIndex: number): AuctionState[] {
    return Array.from(this.auctions.values()).filter(
      (a) => a.propertyIndex === propertyIndex
    );
  }

  cleanupExpiredAuctions(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [id, auction] of this.auctions) {
      if (auction.status === 'active' && now > auction.expiresAt) {
        auction.status = 'completed';
        cleaned++;
      }
    }

    return cleaned;
  }
}
