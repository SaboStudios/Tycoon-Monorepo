import {
  decodeNotificationCursor,
  encodeNotificationCursor,
} from './notification-cursor.util';

describe('notification cursor util', () => {
  it('round-trips createdAt and id through encode/decode', () => {
    const createdAt = new Date('2024-03-15T12:34:56.789Z');
    const cursor = encodeNotificationCursor(createdAt, 'notif-uuid-42');

    const decoded = decodeNotificationCursor(cursor);

    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe('notif-uuid-42');
    expect(decoded?.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it('returns null for garbage input', () => {
    expect(decodeNotificationCursor('not-base64-at-all!!')).toBeNull();
  });

  it('returns null for a well-formed but incomplete payload', () => {
    const bogus = Buffer.from('missing-separator', 'utf8').toString(
      'base64url',
    );
    expect(decodeNotificationCursor(bogus)).toBeNull();
  });

  it('returns null when the encoded date is invalid', () => {
    const bogus = Buffer.from('not-a-date|notif-1', 'utf8').toString(
      'base64url',
    );
    expect(decodeNotificationCursor(bogus)).toBeNull();
  });
});
