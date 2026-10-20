import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Boots the real AppModule (full module graph, not an isolated
 * AppController/AppService pair) and exercises GET / over HTTP.
 *
 * The existing app.e2e-spec.ts only wires AppController + AppService into a
 * bare testing module, so it can pass even when the real AppModule is
 * missing a provider, has a circular dependency, or otherwise fails to wire
 * up — none of that is exercised unless something actually boots the whole
 * app. This test closes that gap.
 */
describe('Root route (e2e, full AppModule bootstrap)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET / returns 200 with the health check body', async () => {
    const res = await request(app.getHttpServer()).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Hello World!');
  });
});
