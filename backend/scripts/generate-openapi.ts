/**
 * Generates openapi.json from the NestJS Swagger setup.
 * Run: npx ts-node -r tsconfig-paths/register scripts/generate-openapi.ts
 * Output: openapi.json (committed to repo; CI checks for drift)
 *
 * Determinism: the document is serialized with sorted keys and a stable
 * 2-space indentation so that regeneration produces byte-identical output
 * and CI parity checks fail closed on real drift only.
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';

/**
 * Recursively sorts object keys so the serialized spec is stable across
 * runs and machines (SwaggerModule does not guarantee key ordering).
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, val]) => [key, sortKeys(val)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Tycoon API')
    .setDescription('Tycoon Monorepo Backend API - OpenAPI 3.0')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outPath = resolve(__dirname, '../openapi.json');
  const serialized = JSON.stringify(sortKeys(document), null, 2) + '\n';
  writeFileSync(outPath, serialized);
  console.log(`OpenAPI spec written to ${outPath}`);
  await app.close();
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
