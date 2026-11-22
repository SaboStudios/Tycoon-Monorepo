import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret, JWT_ALGORITHM } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    [key: string]: unknown;
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
    });

    req.user = decoded as AuthRequest['user'];
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Loads the authenticated user from the database by id.
 * Returns null when the user no longer exists.
 */
export type AdminUserLookup = (
  userId: string
) => Promise<{ id: string; role: string } | null>;

let adminUserLookup: AdminUserLookup | null = null;

/**
 * Registers the database-backed user lookup used by `requireAdmin`.
 * Call this once at startup (see `src/index.ts`).
 */
export function setAdminUserLookup(lookup: AdminUserLookup): void {
  adminUserLookup = lookup;
}

/**
 * Authorizes the request against the *stored* role, not the JWT claim.
 * A stale `role: 'admin'` claim is rejected when the database says otherwise.
 */
export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  if (!adminUserLookup) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  let storedUser: { id: string; role: string } | null;
  try {
    storedUser = await adminUserLookup(userId);
  } catch {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  if (!storedUser || storedUser.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  // Replace the untrusted claim with the authoritative stored role.
  req.user = { ...req.user, id: storedUser.id, role: storedUser.role };
  next();
}
