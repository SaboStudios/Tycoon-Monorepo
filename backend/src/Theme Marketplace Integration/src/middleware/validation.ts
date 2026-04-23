import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validatePurchase = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    userId: Joi.string().required(),
    themeIds: Joi.array().items(Joi.string()).min(1).required(),
    couponCode: Joi.string().optional(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  next();
};

export const validateThemeQuery = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const schema = Joi.object({
    type: Joi.string().valid('skin', 'board').optional(),
  });

  const { error } = schema.validate(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  next();
};
