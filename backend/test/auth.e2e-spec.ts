import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../src/modules/users/entities/user.entity';
import { RefreshToken } from '../src/modules/auth/entities/refresh-token.entity';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../src/modules/users/users.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { CommonModule } from '../src/common/common.module';
import { RedisModule } from '../src/modules/redis/redis.module';

describe('AuthController (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    ignoreEnvFile: true,
                    load: [
                        () => ({
                            jwt: {
                                secret: 'test-secret',
                                expiresIn: 900,
                                refreshExpiresIn: 604800,
                            },
                            redis: {
                                host: 'localhost',
                                port: 6379,
                            },
                        }),
                    ],
                }),
                TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [User, RefreshToken],
                    synchronize: true,
                    dropSchema: true,
                    logging: false,
                }),
                TypeOrmModule.forFeature([User, RefreshToken]),
                CommonModule,
                RedisModule,
                UsersModule,
                AuthModule,
            ],
        })
            .compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api/v1');
        await app.init();
    });

    it('/auth/login (POST) - Login endpoint exists', () => {
        return request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({ email: 'test@test.com', password: 'password' })
            .expect(401); // Expect 401 for invalid credentials
    });

    it('/users (GET) - Returns paginated users list', () => {
        return request(app.getHttpServer())
            .get('/api/v1/users')
            .expect(200)
            .expect((res) => {
                expect(res.body).toHaveProperty('data');
                expect(res.body).toHaveProperty('meta');
                expect(res.body.meta).toHaveProperty('page');
                expect(res.body.meta).toHaveProperty('limit');
                expect(res.body.meta).toHaveProperty('totalItems');
                expect(Array.isArray(res.body.data)).toBe(true);
            });
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });
});
