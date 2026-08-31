/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { setupWorker } from 'msw/browser';
import { userHandlers, shopHandlers, authHandlers, heroHandlers, joinRoomHandlers, gamesHandlers } from './handlers';

export const worker = setupWorker(
  ...userHandlers,
  ...shopHandlers,
  ...authHandlers,
  ...heroHandlers,
  ...joinRoomHandlers,
  ...gamesHandlers,
);
