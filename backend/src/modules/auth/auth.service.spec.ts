import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
    let service: AuthService;
    let usersService: Partial<UsersService>;

    beforeEach(async () => {
        usersService = {
            findByEmail: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UsersService,
                    useValue: usersService,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('validateUser', () => {
        it('should return user without password if validation succeeds', async () => {
            const user = { id: '1', email: 'test@example.com', password: 'password' };
            (usersService.findByEmail as jest.Mock).mockResolvedValue(user);

            const result = await service.validateUser('test@example.com', 'password');
            expect(result).toEqual({ id: '1', email: 'test@example.com' });
        });

        it('should return null if password does not match', async () => {
            const user = { id: '1', email: 'test@example.com', password: 'password' };
            (usersService.findByEmail as jest.Mock).mockResolvedValue(user);

            const result = await service.validateUser('test@example.com', 'wrongpassword');
            expect(result).toBeNull();
        });

        it('should return null if user not found', async () => {
            (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

            const result = await service.validateUser('notfound@example.com', 'password');
            expect(result).toBeNull();
        });
    });
});
