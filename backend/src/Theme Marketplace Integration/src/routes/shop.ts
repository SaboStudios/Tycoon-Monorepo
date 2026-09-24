import { Router, Request, Response } from 'express';
import { shopService } from '../services/shopService';
import { validatePurchase, validateThemeQuery } from '../middleware/validation';
import { PurchaseRequest } from '../types';

const router = Router();

// POST /shop/purchase - Purchase themes
router.post(
  '/purchase',
  validatePurchase,
  async (req: Request, res: Response) => {
    try {
      const purchaseRequest: PurchaseRequest = req.body;
      const result = await shopService.purchase(purchaseRequest);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(200).json({
        success: true,
        transaction: result.transaction,
        unlockedThemes: result.unlockedThemes,
      });
    } catch (error) {
      console.error('Purchase error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// GET /shop/themes - Get available themes
router.get(
  '/themes',
  validateThemeQuery,
  async (req: Request, res: Response) => {
    try {
      const type = req.query.type as 'skin' | 'board' | undefined;
      const themes = shopService.getThemes(type);

      res.status(200).json({
        success: true,
        themes,
        count: themes.length,
      });
    } catch (error) {
      console.error('Get themes error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// GET /shop/transactions/:userId - Get user transactions
router.get('/transactions/:userId', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.params.userId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const transactions = shopService.getUserTransactions(userId);

    res.status(200).json({
      success: true,
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
