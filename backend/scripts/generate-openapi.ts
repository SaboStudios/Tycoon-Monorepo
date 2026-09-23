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

/**
 * Security scheme names emitted into the OpenAPI document.
 * - JWT-auth: user routes (bearer JWT only).
 * - Admin-auth: admin routes (bearer JWT + admin role), per ADMIN_ROUTES_MATRIX.
 */
const USER_SECURITY_SCHEME = 'JWT-auth';
const ADMIN_SECURITY_SCHEME = 'Admin-auth';

/**
 * Path prefixes that are admin-only. Any operation under these prefixes is
 * documented with the admin security scheme (bearer + admin role) so that
 * generated clients and reviewers can distinguish admin from user routes.
 * Keep in sync with ADMIN_ROUTES_MATRIX.md.
 */
const ADMIN_PATH_PREFIXES = ['/api/v1/admin'];

function isAdminPath(path: string): boolean {
  return ADMIN_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Applies the correct security requirement to every operation:
 * admin routes require the admin scheme, all other routes require the user
 * scheme. Operations that already declare an explicit security requirement
 * (e.g. public endpoints marked with @ApiSecurity([])) are left untouched.
 */
function applySecuritySchemes(document: Record<string, any>): void {
  const paths = document.paths ?? {};
  const httpMethods = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace',
  ];

  for (const [path, pathItem] of Object.entries<any>(paths)) {
    const scheme = isAdminPath(path)
      ? ADMIN_SECURITY_SCHEME
      : USER_SECURITY_SCHEME;

    for (const method of httpMethods) {
      const operation = pathItem?.[method];
      if (!operation || typeof operation !== 'object') {
        continue;
      }
      if (Array.isArray(operation.security)) {
        // Respect explicit per-operation security (e.g. public routes).
        continue;
      }
      operation.security = [{ [scheme]: [] }];
    }
  }
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
      USER_SECURITY_SCHEME,
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Admin bearer token. Requires the admin role; non-admin tokens receive 403.',
      },
      ADMIN_SECURITY_SCHEME,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  applySecuritySchemes(document as unknown as Record<string, any>);
  const outPath = resolve(__dirname, '../openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI spec written to ${outPath}`);
  await app.close();
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
