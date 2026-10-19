import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * Locks in the shop-api error contract documented in
 * docs/API_ERROR_RESPONSE_STANDARDS.md. The shop-api is the purchase source of
 * truth (ADR-001), so its error shape must match the backend's.
 */
describe('shop-api error contract (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror shop-api/src/main.ts exactly.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the documented shape for a validation failure (unknown field)', async () => {
    const response = await request(app.getHttpServer())
      .post('/health/validate')
      .send({ unknownField: 'nope' })
      .expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
        error: expect.any(String),
        message: expect.anything(),
        timestamp: expect.any(String),
        path: expect.any(String),
      }),
    );
  });

  it('returns the documented shape for a thrown HTTP exception', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/not-found')
      .expect(404);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        error: expect.any(String),
        message: expect.anything(),
        timestamp: expect.any(String),
        path: expect.any(String),
      }),
    );
  });
});
