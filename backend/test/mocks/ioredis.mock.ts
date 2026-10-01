export default class Redis {
  get = jest.fn();
  set = jest.fn();
  setex = jest.fn();
  del = jest.fn();
  exists = jest.fn();
  expire = jest.fn();
  incr = jest.fn();
  keys = jest.fn();
  eval = jest.fn();
  on = jest.fn();
  quit = jest.fn();
}
