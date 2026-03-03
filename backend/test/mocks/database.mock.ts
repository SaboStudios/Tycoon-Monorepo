export const repositoryMockFactory = jest.fn(() => ({
  findOne: jest.fn((entity: unknown) => entity),
  find: jest.fn((entity: unknown) => entity),
  save: jest.fn((entity: unknown) => entity),
  create: jest.fn((entity: unknown) => entity),
  remove: jest.fn((entity: unknown) => entity),
  update: jest.fn((id: unknown, entity: unknown) => entity),
  delete: jest.fn((id: unknown) => id),
  count: jest.fn(() => 0),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn(() => 0),
    getMany: jest.fn(() => []),
  })),
}));

export type MockType<T> = {
  [P in keyof T]?: jest.Mock;
};
