export const repositoryMockFactory = jest.fn(() => ({
  findOne: jest.fn((entity: unknown) => entity),
  find: jest.fn((entity: unknown) => entity),
  save: jest.fn((entity: unknown) => entity),
  create: jest.fn((entity: unknown) => entity),
  remove: jest.fn((entity: unknown) => entity),
  update: jest.fn((id: unknown, entity: unknown) => entity),
  delete: jest.fn((id: unknown) => id),
}));

export type MockType<T> = {
  [P in keyof T]?: jest.Mock;
};
