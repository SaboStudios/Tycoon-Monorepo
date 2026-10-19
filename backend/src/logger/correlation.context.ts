import { AsyncLocalStorage } from "async_hooks";

const NS_NAME = "request";
const REQUEST_ID_KEY = "requestId";

interface RequestContextStore {
  [key: string]: unknown;
}

// AsyncLocalStorage gives each call to `run()` its own isolated store that
// follows that specific async execution chain. A shared cls-hooked namespace
// (or any single mutable object) does not provide that isolation: concurrent
// requests can read/write the same backing storage and clobber each other's
// requestId between the time it is set and the time it is read later in the
// same logical request. Using one AsyncLocalStorage instance keyed per-run
// fixes the leak.
const storage = new AsyncLocalStorage<RequestContextStore>();

export const clsNamespace = {
  name: NS_NAME,
  run<T>(callback: () => T): T {
    return storage.run({}, callback);
  },
};

export function setRequestId(id: string): void {
  const store = storage.getStore();
  if (store) {
    store[REQUEST_ID_KEY] = id;
  }
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.[REQUEST_ID_KEY] as string | undefined;
}
