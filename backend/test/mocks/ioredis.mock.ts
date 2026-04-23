export default class Redis {
  get = jest.fn();
  set = jest.fn();
  del = jest.fn();
  exists = jest.fn();
  expire = jest.fn();
  on = jest.fn();
  quit = jest.fn();
}
