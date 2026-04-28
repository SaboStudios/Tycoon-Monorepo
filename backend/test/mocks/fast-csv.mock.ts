/** Minimal fast-csv stub for unit tests. */
export const write = jest.fn();
export const format = jest.fn(() => ({ pipe: jest.fn(), write: jest.fn(), end: jest.fn() }));
export const parseString = jest.fn();
export const parseFile = jest.fn();
