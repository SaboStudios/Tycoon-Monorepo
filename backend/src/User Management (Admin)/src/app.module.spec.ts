import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import { User } from './users/entities/user.entity';
import { AuditLog } from './users/entities/audit-log.entity';

/**
 * Boot smoke test for the User Management (Admin) app module.
 *
 * Nothing previously compiled the full module graph (UsersModule + AuthModule
 * wired through AppModule), so a bad/missing import only surfaced when the
 * app actually booted at runtime. This test compiles AppModule end to end,
 * stubbing out the real Postgres connection so it runs without external
 * infrastructure.
 */
describe('AppModule (boot smoke test)', () => {
  it('compiles the full module graph without a real database connection', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue({})
      .overrideProvider(getRepositoryToken(User))
      .useValue({})
      .overrideProvider(getRepositoryToken(AuditLog))
      .useValue({})
      .compile();

    expect(moduleRef).toBeDefined();
    expect(moduleRef.get(AppModule)).toBeDefined();
  });
});
