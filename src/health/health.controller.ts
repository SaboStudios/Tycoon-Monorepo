import { Controller, Get, HttpCode, ServiceUnavailableException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

const DB_PING_TIMEOUT_MS = 3000;

@Controller()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get("health")
  @HttpCode(200)
  health() {
    return { status: "ok" };
  }

  @Get("ready")
  @HttpCode(200)
  async ready() {
    const db = await this.pingDb();
    const status = db === "ok" ? "ok" : "degraded";

    if (db !== "ok") {
      throw new ServiceUnavailableException({ status, db });
    }

    return { status, db };
  }

  private async pingDb(): Promise<"ok" | "error"> {
    try {
      await Promise.race([
        this.dataSource.query("SELECT 1"),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), DB_PING_TIMEOUT_MS),
        ),
      ]);
      return "ok";
    } catch {
      return "error";
    }
  }
}
