import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { TypeOrmModule, getDataSourceToken } from "@nestjs/typeorm";
import * as request from "supertest";
import { DataSource } from "typeorm";
import { HealthModule } from "../src/health/health.module";
import { User } from "../src/users/entities/user.entity";
import { AuditLog } from "../src/users/entities/audit-log.entity";

describe("Health (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

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
          entities: [User, AuditLog],
          synchronize: false,
        }),
        HealthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /health", () => {
    it("returns 200 with status ok (liveness)", () => {
      return request(app.getHttpServer())
        .get("/health")
        .expect(200)
        .expect({ status: "ok" });
    });

    it("does not expose sensitive info", async () => {
      const res = await request(app.getHttpServer()).get("/health");
      expect(res.body).not.toHaveProperty("db");
      expect(res.body).not.toHaveProperty("host");
      expect(res.body).not.toHaveProperty("password");
    });
  });

  describe("GET /ready", () => {
    it("returns 200 with db ok when DB is reachable (readiness)", () => {
      return request(app.getHttpServer())
        .get("/ready")
        .expect(200)
        .expect({ status: "ok", db: "ok" });
    });

    it("returns 503 when DB is unreachable (pod marked not ready)", async () => {
      // Simulate DB down by destroying the connection
      const originalQuery = dataSource.query.bind(dataSource);
      jest
        .spyOn(dataSource, "query")
        .mockRejectedValueOnce(new Error("Connection refused"));

      const res = await request(app.getHttpServer()).get("/ready");

      expect(res.status).toBe(503);
      expect(res.body.message.status).toBe("degraded");
      expect(res.body.message.db).toBe("error");

      // Restore
      jest.spyOn(dataSource, "query").mockImplementation(originalQuery);
    });

    it("returns 503 on DB ping timeout", async () => {
      jest.spyOn(dataSource, "query").mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );

      const res = await request(app.getHttpServer()).get("/ready");

      expect(res.status).toBe(503);
      expect(res.body.message.db).toBe("error");
    }, 10000);

    it("does not expose sensitive info in error response", async () => {
      jest
        .spyOn(dataSource, "query")
        .mockRejectedValueOnce(new Error("Connection refused"));

      const res = await request(app.getHttpServer()).get("/ready");

      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
      expect(JSON.stringify(res.body)).not.toMatch(/host/i);
      expect(JSON.stringify(res.body)).not.toMatch(/Connection refused/i);
    });
  });
});
