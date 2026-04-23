export class Counter { inc = jest.fn(); }
export class Gauge { set = jest.fn(); inc = jest.fn(); dec = jest.fn(); }
export class Histogram { observe = jest.fn(); startTimer = jest.fn(() => jest.fn()); }
export class Registry {}
export const register = new Registry();
