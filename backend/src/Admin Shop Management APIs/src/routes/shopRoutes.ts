import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { shopService } from '../services/shopService';

const router = Router();

// Create item
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const { name, description, price, isActive = true } = req.body;

      if (!name || !description || price === undefined) {
        return res
          .status(400)
          .json({ error: 'Name, description, and price are required' });
      }

      const item = shopService.createItem({
        name,
        description,
        price: Number(price),
        isActive,
        images: [],
      });

      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create item' });
    }
  },
);

// Get all items
router.get('/', (req: Request, res: Response) => {
  const activeOnly = req.query.active === 'true';
  const items = shopService.getItems(activeOnly);
  res.json(items);
});

// Get item by ID
router.get('/:id', (req: Request, res: Response) => {
  const item = shopService.getItemById(req.params.id as string);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

// Update item
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const { name, description, price, isActive } = req.body;
      const updates: any = {};

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (price !== undefined) updates.price = Number(price);
      if (isActive !== undefined) updates.isActive = isActive;

      const item = shopService.updateItem(req.params.id as string, updates);

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json(item);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update item' });
    }
  },
);

// Update price
router.patch(
  '/:id/price',
  authenticateToken,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const { price } = req.body;

      if (price === undefined) {
        return res.status(400).json({ error: 'Price is required' });
      }

      const item = shopService.updatePrice(
        req.params.id as string,
        Number(price),
      );

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json(item);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update price' });
    }
  },
);

// Activate/Deactivate item
router.patch(
  '/:id/status',
  authenticateToken,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const { isActive } = req.body;

      if (isActive === undefined) {
        return res.status(400).json({ error: 'isActive is required' });
      }

      const item = shopService.toggleActive(req.params.id as string, isActive);

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json(item);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update status' });
    }
  },
);

// Upload images
router.post(
  '/:id/images',
  authenticateToken,
  requireAdmin,
  upload.array('images', 5),
  (req: Request, res: Response) => {
    try {
      const item = shopService.getItemById(req.params.id as string);

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const files = req.files as Express.Multer.File[];
      const imagePaths = files.map((file) => file.path);

      const updatedItem = shopService.updateItem(req.params.id as string, {
        images: [...item.images, ...imagePaths],
      });

      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ error: 'Failed to upload images' });
    }
  },
);

// Bulk update
router.post(
  '/bulk/update',
  authenticateToken,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: 'Updates must be an array' });
      }

      const updatedItems = shopService.bulkUpdate(updates);
      res.json({ updated: updatedItems.length, items: updatedItems });
    } catch (error) {
      res.status(500).json({ error: 'Failed to bulk update' });
    }
  },
);

// Delete item
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const success = shopService.deleteItem(req.params.id as string);

      if (!success) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete item' });
    }
  },
);

export default router;
