import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/modules/users/entities/user.entity';
import { repositoryMockFactory } from './mocks/database.mock';

describe('AuthController (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(getRepositoryToken(User))
            .useFactory({ factory: repositoryMockFactory })
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('/users (GET) - Unauthorized without token', () => {
        return request(app.getHttpServer())
            .get('/users')
            .expect(401)
            .expect({
                statusCode: 401,
                message: 'No authorization header found',
                error: 'Unauthorized',
            });
    });

    it('/users (GET) - Authorized with valid token', () => {
        return request(app.getHttpServer())
            .get('/users')
            .set('Authorization', 'Bearer secret-token')
            .expect(200);
    });

    afterAll(async () => {
        await app.close();
    });
});
