import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { repositoryMockFactory, MockType } from '../../../test/mocks/database.mock';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
    let service: UsersService;
    let repositoryMock: MockType<Repository<User>>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: getRepositoryToken(User),
                    useFactory: repositoryMockFactory,
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        repositoryMock = module.get(getRepositoryToken(User));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a new user', async () => {
            const createUserDto = { email: 'test@example.com', password: 'password' };
            const user = { id: '1', ...createUserDto };
            repositoryMock.create!.mockReturnValue(user);
            repositoryMock.save!.mockReturnValue(user);

            const result = await service.create(createUserDto as any);
            expect(result).toEqual(user);
            expect(repositoryMock.save).toHaveBeenCalledWith(user);
        });
    });

    describe('findAll', () => {
        it('should return an array of users', async () => {
            const users = [{ id: '1', email: 'test@example.com' }];
            repositoryMock.find!.mockReturnValue(users);

            const result = await service.findAll();
            expect(result).toEqual(users);
        });
    });

    describe('findOne', () => {
        it('should return a user if found', async () => {
            const user = { id: '1', email: 'test@example.com' };
            repositoryMock.findOne!.mockReturnValue(user);

            const result = await service.findOne('1');
            expect(result).toEqual(user);
        });

        it('should throw NotFoundException if user not found', async () => {
            repositoryMock.findOne!.mockReturnValue(null);

            await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
        });
    });

    describe('remove', () => {
        it('should remove a user', async () => {
            const user = { id: '1', email: 'test@example.com' };
            repositoryMock.findOne!.mockReturnValue(user);
            repositoryMock.remove!.mockReturnValue(user);

            await service.remove('1');
            expect(repositoryMock.remove).toHaveBeenCalledWith(user);
        });
    });
});
