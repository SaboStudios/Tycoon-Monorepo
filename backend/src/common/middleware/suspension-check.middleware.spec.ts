import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpStatus } from '@nestjs/common';
import { SuspensionCheckMiddleware } from './suspension-check.middleware';
import { User } from '../../modules/users/entities/user.entity';
import { MockType, repositoryMockFactory } from '../../../test/mocks/database.mock';

describe('SuspensionCheckMiddleware', () => {
  let middleware: SuspensionCheckMiddleware;
  let repositoryMock: MockType<import('typeorm').Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuspensionCheckMiddleware,
        {
          provide: getRepositoryToken(User),
          useFactory: repositoryMockFactory,
        },
      ],
    }).compile();

    middleware = module.get<SuspensionCheckMiddleware>(SuspensionCheckMiddleware);
    repositoryMock = module.get(getRepositoryToken(User));
  });

  const createResponse = () => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    return res;
  };

  it('short-circuits a suspended user and does not call next()', async () => {
    repositoryMock.findOne!.mockResolvedValue({ id: 1, isSuspended: true } as User);

    const req: any = { user: { id: 1 } };
    const res = createResponse();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(res.json).toHaveBeenCalled();
  });

  it('calls next() for an active user', async () => {
    repositoryMock.findOne!.mockResolvedValue({ id: 1, isSuspended: false } as User);

    const req: any = { user: { id: 1 } };
    const res = createResponse();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() when the user is missing', async () => {
    repositoryMock.findOne!.mockResolvedValue(null);

    const req: any = { user: { id: 1 } };
    const res = createResponse();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
