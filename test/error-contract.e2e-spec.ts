import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import * as request from "supertest";
import { UsersModule } from "../src/users/users.module";
import { AuthModule } from "../src/auth/auth.module";
import { LoggerModule } from "../src/logger/logger.module";
import { User, UserRole, UserStatus } from "../src/users/entities/user.entity";
import { AuditLog } from "../src/users/entities/audit-log.entity";
import { IdempotencyRecord } from "../src/idempotency/idempotency-record.entity";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";

describe("Error Contract (e2e)", () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "postgres",
          host: process.env.DB_HOST || "localhost",
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || "postgres",
          password: process.env.DB_PASSWORD || "postgres",
          database: process.env.DB_NAME || "test_db",
          entities: [User, AuditLog, IdempotencyRecord],
          synchronize: true,
          dropSchema: true,
        }),
        LoggerModule,
        UsersModule,
        AuthModule,
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: HttpExceptionFilter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    const admin = await userRepository.save(
      userRepository.create({
        email: "admin@test.com",
        password: await bcrypt.hash("admin123", 10),
        firstName: "Admin",
        lastName: "Test",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      }),
    );
    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role });
  });

  afterAll(async () => {
    await userRepository.delete({});
    await app.close();
  });

  /** Asserts the shared error envelope shape */
  function expectErrorShape(body: Record<string, unknown>, statusCode: number) {
    expect(body).toMatchObject({
      statusCode,
      code: expect.any(String),
      message: expect.any(String),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      path: expect.any(String),
    });
    // stack must never appear in test env when NODE_ENV is not set to production
    // but must never contain secrets
    if (body.stack) {
      expect(body.stack).not.toMatch(/password|token|secret/i);
    }
  }

  it("401 — missing JWT has correct error envelope", async () => {
    const { body } = await request(app.getHttpServer())
      .get("/admin/users")
      .expect(401);

    expectErrorShape(body, 401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(body).toMatchSnapshot();
  });

  it("404 — unknown user returns correct error envelope", async () => {
    const { body } = await request(app.getHttpServer())
      .get("/admin/users/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);

    expectErrorShape(body, 404);
    expect(body.code).toBe("NOT_FOUND");
    expect(body).toMatchSnapshot();
  });

  it("400 — validation error returns details array", async () => {
    const { body } = await request(app.getHttpServer())
      .patch(`/admin/users/00000000-0000-0000-0000-000000000000/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "INVALID_ROLE" })
      .expect(400);

    expectErrorShape(body, 400);
    expect(body.message).toBe("Validation failed");
    expect(Array.isArray(body.details)).toBe(true);
    expect(body).toMatchSnapshot();
  });

  it("400 — extra fields rejected with correct envelope", async () => {
    const { body } = await request(app.getHttpServer())
      .patch(`/admin/users/00000000-0000-0000-0000-000000000000/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: UserRole.USER, unknownField: "x" })
      .expect(400);

    expectErrorShape(body, 400);
    expect(body).toMatchSnapshot();
  });

  it("never leaks password/token in error payload", async () => {
    const { body } = await request(app.getHttpServer())
      .post(`/admin/users/00000000-0000-0000-0000-000000000000/reset-password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newPassword: "short" })
      .expect(400);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/short/); // actual password value not echoed
    expect(serialized).not.toMatch(/\[REDACTED\]/); // no accidental redaction marker in normal flow
    expectErrorShape(body, 400);
  });
});
