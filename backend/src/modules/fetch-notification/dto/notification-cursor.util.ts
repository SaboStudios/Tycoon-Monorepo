/**
 * Opaque keyset-pagination cursor for notifications (issue #1312).
 *
 * Encodes the (createdAt, id) of the last row on a page. Keyset pagination
 * with a stable tie-break on `id` avoids the duplicate/skipped-row drift that
 * offset (`page`/`limit` skip) pagination suffers from when rows share the
 * same `createdAt` timestamp or when new rows are inserted between page
 * fetches.
 */
export interface NotificationCursor {
  createdAt: Date;
  id: string;
}

export function encodeNotificationCursor(
  createdAt: Date,
  id: string,
): string {
  const payload = `${createdAt.toISOString()}|${id}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeNotificationCursor(
  cursor: string,
): NotificationCursor | null {
  try {
    const payload = Buffer.from(cursor, 'base64url').toString('utf8');
    const [createdAtRaw, id] = payload.split('|');
    if (!createdAtRaw || !id) return null;

    const createdAt = new Date(createdAtRaw);
    if (Number.isNaN(createdAt.getTime())) return null;

    return { createdAt, id };
  } catch {
    return null;
  }
}
