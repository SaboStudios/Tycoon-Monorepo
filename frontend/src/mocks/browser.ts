/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { setupWorker } from 'msw/browser';
import { userHandlers, shopHandlers } from './handlers';

export const worker = setupWorker(
  ...userHandlers,
  ...shopHandlers,
);
