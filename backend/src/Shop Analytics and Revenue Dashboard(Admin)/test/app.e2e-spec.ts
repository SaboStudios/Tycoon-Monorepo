import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { Repository } from "typeorm";
import { Transaction } from "../src/entities/transaction.entity";
import { PlayerActivity } from "../src/entities/player-activity.entity";
import { getRepositoryToken } from "@nestjs/typeorm";

describe("Analytics E2E", () => {
  let app: INestApplication;
  let transactionRepo: Repository<Transaction>;
  let activityRepo: Repository<PlayerActivity>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    transactionRepo = moduleFixture.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    activityRepo = moduleFixture.get<Repository<PlayerActivity>>(
      getRepositoryToken(PlayerActivity),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  describe("/admin/analytics/shop (GET)", () => {
    it("should return analytics with empty data", async () => {
      const response = await request(app.getHttpServer())
        .get("/admin/analytics/shop")
        .expect(200);

      expect(response.body).toHaveProperty("totalRevenue");
      expect(response.body).toHaveProperty("popularItems");
      expect(response.body).toHaveProperty("conversionRate");
      expect(response.body).toHaveProperty("retentionMetrics");
      expect(response.body.totalRevenue).toBe(0);
      expect(response.body.popularItems).toEqual([]);
      expect(response.body.conversionRate).toBe(0);
    });

    it("should return analytics with transaction data", async () => {
      await transactionRepo.save([
        { playerId: "p1", itemId: "i1", itemName: "Sword", amount: 100 },
        { playerId: "p2", itemId: "i1", itemName: "Sword", amount: 100 },
        { playerId: "p3", itemId: "i2", itemName: "Shield", amount: 50 },
      ]);

      await activityRepo.save([
        { playerId: "p1", action: "login" },
        { playerId: "p2", action: "login" },
        { playerId: "p3", action: "login" },
        { playerId: "p4", action: "login" },
      ]);

      const response = await request(app.getHttpServer())
        .get("/admin/analytics/shop")
        .expect(200);

      expect(response.body.totalRevenue).toBe(250);
      expect(response.body.popularItems).toHaveLength(2);
      expect(response.body.popularItems[0].itemName).toBe("Sword");
      expect(response.body.popularItems[0].purchaseCount).toBe(2);
      expect(response.body.conversionRate).toBe(75);
    });

    it("should calculate popular items correctly", async () => {
      await transactionRepo.save([
        { playerId: "p1", itemId: "i1", itemName: "Sword", amount: 100 },
        { playerId: "p2", itemId: "i1", itemName: "Sword", amount: 100 },
        { playerId: "p3", itemId: "i1", itemName: "Sword", amount: 100 },
        { playerId: "p4", itemId: "i2", itemName: "Potion", amount: 10 },
        { playerId: "p5", itemId: "i2", itemName: "Potion", amount: 10 },
      ]);

      const response = await request(app.getHttpServer())
        .get("/admin/analytics/shop")
        .expect(200);

      expect(response.body.popularItems[0].itemName).toBe("Sword");
      expect(response.body.popularItems[0].purchaseCount).toBe(3);
      expect(response.body.popularItems[0].totalRevenue).toBe(300);
      expect(response.body.popularItems[1].itemName).toBe("Potion");
      expect(response.body.popularItems[1].purchaseCount).toBe(2);
    });

    it("should handle retention metrics", async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      await activityRepo.save([
        { playerId: "p1", action: "login", createdAt: twoDaysAgo },
        { playerId: "p1", action: "login", createdAt: now },
      ]);

      const response = await request(app.getHttpServer())
        .get("/admin/analytics/shop")
        .expect(200);

      expect(response.body.retentionMetrics).toHaveProperty("day1");
      expect(response.body.retentionMetrics).toHaveProperty("day7");
      expect(response.body.retentionMetrics).toHaveProperty("day30");
    });
  });
});
