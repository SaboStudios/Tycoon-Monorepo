/**
 * Generates openapi.json from the NestJS Swagger setup.
 * Run: npx ts-node -r tsconfig-paths/register scripts/generate-openapi.ts
 * Output: openapi.json (committed to repo; CI checks for drift)
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Tycoon API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outPath = resolve(__dirname, '../openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI spec written to ${outPath}`);
  await app.close();
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
