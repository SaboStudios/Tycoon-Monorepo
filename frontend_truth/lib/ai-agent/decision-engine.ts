// lib/ai-agent/decision-engine.ts
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

interface GameContext {
  myBalance: number;
  myPosition: number;
  myProperties: any[];
  opponents: any[];
  landedProperty?: any;
  gameState: any;
}

export class MonopolyAIDecisionEngine {
  
  async makePropertyDecision(context: GameContext): Promise<{
    action: 'buy' | 'skip';
    reasoning: string;
    confidence: number;
  }> {
    const prompt = this.buildPropertyPrompt(context);
    
    const response = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: [{
        role: 'user',
        content: prompt,
      }],
      maxOutputTokens: 1024,
    });

    return this.parseJsonResponse(response.text, { action: 'skip', reasoning: 'Invalid response', confidence: 0 });
  }

  async evaluateTrade(tradeOffer: any, context: GameContext): Promise<{
    action: 'accept' | 'decline' | 'counter';
    reasoning: string;
    counterOffer?: any;
  }> {
    const prompt = this.buildTradePrompt(tradeOffer, context);
    
    const response = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: [{
        role: 'user',
        content: prompt,
      }],
      maxOutputTokens: 1024,
    });

    return this.parseJsonResponse(response.text, { action: 'decline', reasoning: 'Invalid response' });
  }

  async decideBuildingStrategy(context: GameContext): Promise<{
    action: 'build' | 'wait';
    propertyId?: number;
    reasoning: string;
  }> {
    const prompt = `You're playing Monopoly. Analyze whether to build houses/hotels now.

YOUR STATUS:
- Balance: $${context.myBalance}
- Properties: ${context.myProperties.map((p: any) => `${p.name ?? p.id} (${p.development ?? 0} houses)`).join(', ')}
- Monopolies: ${this.getMonopolies(context.myProperties)}

OPPONENTS:
${context.opponents.map((opp: any) => `- ${opp.username ?? 'Opponent'}: $${opp.balance ?? 0}`).join('\n')}

STRATEGY:
- Build on monopolies with high traffic (orange, red, yellow)
- Keep $500+ cash reserve for safety
- Build evenly (3 houses per property is optimal)
- Hotels only when cash flow is secure

Respond ONLY with JSON:
{
  "action": "build" | "wait",
  "propertyId": 16, // if building
  "reasoning": "brief explanation"
}`;

    const response = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 512,
    });

    return this.parseJsonResponse(response.text, { action: 'wait', reasoning: 'Invalid response' });
  }

  /** Strip markdown code fences and parse JSON; return fallback on parse failure. */
  private parseJsonResponse<T>(text: string, fallback: T): T {
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(stripped) as T;
    } catch {
      return fallback;
    }
  }

  private buildPropertyPrompt(context: GameContext): string {
    const { landedProperty, myBalance, myProperties, opponents } = context;

    return `You're an expert Monopoly AI player. Decide whether to buy this property.

LANDED ON: ${landedProperty?.name}
- Price: $${landedProperty?.price}
- Color: ${landedProperty?.color}
- Landing frequency rank: #${landedProperty?.landingRank} (lower = better, top 10 is excellent)
- Would complete monopoly: ${landedProperty?.completesMonopoly ? 'YES ⭐⭐⭐' : 'No'}

YOUR STATUS:
- Current balance: $${myBalance}
- After purchase: $${myBalance - (landedProperty?.price || 0)}
- Properties owned: ${myProperties.length}
- Complete monopolies: ${this.getMonopolies(myProperties).length}

OPPONENTS:
${opponents.map((opp: any) => `- ${opp.username ?? 'Opponent'}: $${opp.balance ?? 0}`).join('\n')}

MONOPOLY STRATEGY RULES:
1. Orange/Red/Yellow groups = highest ROI (most landed on)
2. Completing monopolies is CRITICAL - worth overpaying
3. Keep $500+ cash reserve minimum
4. Properties with landing rank <10 are excellent investments
5. Railroads are consistent income but low priority
6. Dark blue is expensive but low traffic

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "action": "buy" | "skip",
  "reasoning": "tactical explanation in max 60 words",
  "confidence": 85
}`;
  }

  private buildTradePrompt(trade: any, context: GameContext): string {
    return `Evaluate this Monopoly trade offer.

RECEIVING:
- Cash: $${trade.offer_amount}
- Properties: ${trade.offer_properties?.map((p: any) => p.name).join(', ') || 'None'}

GIVING:
- Cash: $${trade.requested_amount}
- Properties: ${trade.requested_properties?.map((p: any) => p.name).join(', ') || 'None'}

FROM: ${trade.fromPlayer}

YOUR STATUS:
- Balance: $${context.myBalance}
- Properties: ${context.myProperties.map(p => p.name).join(', ')}
- Monopolies: ${this.getMonopolies(context.myProperties)}

ANALYSIS:
✓ Does this complete a monopoly for me? (HUGE value)
✓ Does this complete a monopoly for them? (Risky - they'll dominate)
✓ Is the cash fair?
✓ Am I weakening my position?

Respond ONLY with JSON:
{
  "action": "accept" | "decline" | "counter",
  "reasoning": "max 60 words",
  "counterOffer": { "cashAdjustment": 200 } // only if countering
}`;
  }

  private getMonopolies(properties: any[]): string[] {
    // Implementation from your existing code
    return [];
  }
}