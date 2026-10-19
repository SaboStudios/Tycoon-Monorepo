import { Request, Response, NextFunction } from 'express';
import { ShopItem } from '../types';

/**
 * Validation error shape used across the package.
 */
export interface ValidationError {
  error: string;
  details?: string[];
}

/**
 * Validate that a price is a finite number greater than zero.
 * Rejects negative, zero, NaN and non-finite values.
 */
export function isValidPrice(price: unknown): price is number {
  return typeof price === 'number' && Number.isFinite(price) && price > 0;
}

/**
 * Validate the body of a shop item create/update request.
 * Ensures `price` is a finite number greater than zero before it can
 * reach `shopService`.
 */
export function validateShopItem(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as Partial<ShopItem>;
  const details: string[] = [];

  if (body.price === undefined || body.price === null) {
    details.push('price is required');
  } else if (!isValidPrice(body.price)) {
    details.push('price must be a finite number greater than 0');
  }

  if (details.length > 0) {
    const error: ValidationError = {
      error: 'Validation failed',
      details,
    };
    res.status(400).json(error);
    return;
  }

  next();
}

export default validateShopItem;
