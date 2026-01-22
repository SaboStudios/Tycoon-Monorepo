export const repositoryMockFactory = jest.fn(() => ({
    findOne: jest.fn((entity) => entity),
    find: jest.fn((entity) => entity),
    save: jest.fn((entity) => entity),
    create: jest.fn((entity) => entity),
    remove: jest.fn((entity) => entity),
    update: jest.fn((id, entity) => entity),
    delete: jest.fn((id) => id),
}));

export type MockType<T> = {
    [P in keyof T]?: jest.Mock;
};
