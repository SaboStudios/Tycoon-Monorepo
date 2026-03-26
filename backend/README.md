# Tycoon Backend - NestJS TypeScript Boilerplate

A production-ready NestJS backend boilerplate with TypeScript, TypeORM, and PostgreSQL integration. This project provides a solid foundation for building scalable and maintainable REST APIs.

## 🚀 Features

- **NestJS Framework** - Progressive Node.js framework for building efficient and scalable server-side applications
- **TypeScript** - Strongly typed programming language that builds on JavaScript
- **TypeORM** - Advanced ORM for TypeScript and JavaScript
- **PostgreSQL** - Powerful, open-source relational database
- **Docker Support** - Docker Compose configuration for easy database setup
- **Validation** - Built-in request validation using class-validator
- **Configuration Management** - Environment-based configuration using @nestjs/config
- **CORS Support** - Cross-Origin Resource Sharing enabled
- **Modular Architecture** - Well-organized, scalable folder structure

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (v9 or higher) - Comes with Node.js
- **Docker** (optional, for running PostgreSQL) - [Download](https://www.docker.com/)
- **PostgreSQL** (if not using Docker) - [Download](https://www.postgresql.org/)

## 🛠️ Installation

### 1. Clone the repository

```bash
cd backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and update the values:

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
# Application Configuration
NODE_ENV=development
PORT=3000
API_PREFIX=api
API_DEFAULT_VERSION=1
API_ENABLE_LEGACY_UNVERSIONED=true
API_LEGACY_UNVERSIONED_SUNSET=

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=tycoon_db
DB_SYNCHRONIZE=true
DB_LOGGING=true

# JWT Configuration (for future authentication)
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRATION=1d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### 4. Start the database

#### Option A: Using Docker (Recommended)

```bash
docker-compose up -d
```

This will start:

- PostgreSQL database on port 5432
- pgAdmin on port 5050 (access at http://localhost:5050)
  - Email: admin@tycoon.com
  - Password: admin

#### Option B: Using local PostgreSQL

Ensure PostgreSQL is running and create a database:

```sql
CREATE DATABASE tycoon_db;
```

## 🚀 Running the Application

### Development mode

```bash
npm run start:dev
```

The application will start on `http://localhost:3000`

API endpoints are available at: `http://localhost:3000/api/v1`

## 🔀 API Versioning & Deprecation Strategy

- **Current stable version path**: `/api/v1/*`
- **Unversioned compatibility path**: `/api/*` is supported temporarily and internally routed to `/api/v1/*`
- **Deprecation signaling**: compatibility responses include `Deprecation: true`
- **Optional sunset policy**: set `API_LEGACY_UNVERSIONED_SUNSET` (ISO date) to emit an RFC-compliant `Sunset` header

### Breaking Changes Policy

- Breaking API changes require a **new major API version** (for example: `v2`)
- `v1` behavior remains stable until announced deprecation window ends
- Unversioned compatibility (`/api/*`) is considered transitional and should not be used for new clients

### Client Migration Plan

- New and existing clients should call versioned paths (`/api/v1/*`) explicitly
- Monitor `Deprecation`/`Sunset` headers on `/api/*` responses and migrate before the sunset date

### Production mode

```bash
npm run build
npm run start:prod
```

### Debug mode

```bash
npm run start:debug
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/                 # Configuration files
│   │   ├── app.config.ts      # Application configuration
│   │   └── database.config.ts # Database configuration
│   ├── modules/               # Feature modules
│   │   └── users/            # Users module
│   │       ├── dto/          # Data Transfer Objects
│   │       │   ├── create-user.dto.ts
│   │       │   └── update-user.dto.ts
│   │       ├── entities/     # Database entities
│   │       │   └── user.entity.ts
│   │       ├── users.controller.ts
│   │       ├── users.service.ts
│   │       └── users.module.ts
│   ├── app.controller.ts      # Root controller
│   ├── app.service.ts         # Root service
│   ├── app.module.ts          # Root module
│   └── main.ts                # Application entry point
├── test/                      # Test files
├── .env                       # Environment variables
├── .env.example              # Environment variables example
├── docker-compose.yml        # Docker configuration
├── package.json              # Dependencies and scripts
└── tsconfig.json            # TypeScript configuration
```

## 🔌 API Endpoints

### Users Module

| Method | Endpoint            | Description       |
| ------ | ------------------- | ----------------- |
| POST   | `/api/v1/users`     | Create a new user |
| GET    | `/api/v1/users`     | Get all users     |
| GET    | `/api/v1/users/:id` | Get user by ID    |
| PATCH  | `/api/v1/users/:id` | Update user       |
| DELETE | `/api/v1/users/:id` | Delete user       |

### Example Requests

#### Create User

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "password": "securePassword123"
  }'
```

#### Get All Users

```bash
curl http://localhost:3000/api/v1/users
```

#### Get User by ID

```bash
curl http://localhost:3000/api/v1/users/{user-id}
```

#### Update User

```bash
curl -X PATCH http://localhost:3000/api/v1/users/{user-id} \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane"
  }'
```

#### Delete User

```bash
curl -X DELETE http://localhost:3000/api/v1/users/{user-id}
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📦 Game Defaults & Idempotency (#400)

**Default Game Settings** (from game.config.ts):
- auction: true
- rentInPrison: false
- mortgage: true
- evenBuild: true
- randomizePlayOrder: true
- startingCash: 1500

**Init Hardened:**
- Seeds (admin-seed.ts, game-seed.ts) idempotent: safe double-run.
- View helpers: GamesService.getSafeGameView(id) returns defaults on empty/missing.

**Migration Notes:** No schema changes. Rerun seeds safe.

**Upgrade Policy:** Use /api/v1, monitor Deprecation headers.

## 📦 Building for Production

```bash
npm run build
```

The compiled output will be in the `dist/` directory.


## 🔧 Available Scripts

| Script                | Description                               |
| --------------------- | ----------------------------------------- |
| `npm run start`       | Start the application                     |
| `npm run start:dev`   | Start in development mode with hot-reload |
| `npm run start:debug` | Start in debug mode                       |
| `npm run start:prod`  | Start in production mode                  |
| `npm run build`       | Build the application                     |
| `npm run format`      | Format code using Prettier                |
| `npm run lint`        | Lint code using ESLint                    |
| `npm run test`        | Run unit tests                            |
| `npm run test:e2e`    | Run end-to-end tests                      |
| `npm run test:cov`    | Run tests with coverage                   |

## 🗄️ Database Management

### TypeORM Synchronization

In development, `DB_SYNCHRONIZE=true` automatically syncs your entities with the database schema. **Never use this in production!**

### Migrations (Recommended for Production)

```bash
# Generate a migration
npm run typeorm migration:generate -- -n MigrationName

# Run migrations
npm run typeorm migration:run

# Revert migration
npm run typeorm migration:revert
```

### pgAdmin Access

If using Docker, access pgAdmin at http://localhost:5050

1. Login with:
   - Email: admin@tycoon.com
   - Password: admin

2. Add a new server:
   - Host: postgres (or localhost if accessing from host machine)
   - Port: 5432
   - Username: postgres
   - Password: postgres

## 🏗️ Creating New Modules

To create a new module, use the NestJS CLI:

```bash
# Generate a complete CRUD module
nest g resource modules/products

# Generate individual components
nest g module modules/products
nest g controller modules/products
nest g service modules/products
```

## 🔐 Environment Variables

| Variable         | Description                          | Default                 |
| ---------------- | ------------------------------------ | ----------------------- |
| `NODE_ENV`       | Environment (development/production) | `development`           |
| `PORT`           | Application port                     | `3000`                  |
| `API_PREFIX`     | Base API prefix (version excluded)   | `api`                   |
| `API_DEFAULT_VERSION` | Default URI API version         | `1`                     |
| `API_ENABLE_LEGACY_UNVERSIONED` | Enable `/api/*` compatibility route | `true` |
| `API_LEGACY_UNVERSIONED_SUNSET` | Optional sunset ISO date for unversioned route | - |
| `DB_HOST`        | Database host                        | `localhost`             |
| `DB_PORT`        | Database port                        | `5432`                  |
| `DB_USERNAME`    | Database username                    | `postgres`              |
| `DB_PASSWORD`    | Database password                    | `postgres`              |
| `DB_DATABASE`    | Database name                        | `tycoon_db`             |
| `DB_SYNCHRONIZE` | Auto-sync entities (dev only)        | `true`                  |
| `DB_LOGGING`     | Enable SQL logging                   | `true`                  |
| `JWT_SECRET`     | JWT secret key                       | -                       |
| `JWT_EXPIRATION` | JWT expiration time                  | `1d`                    |
| `CORS_ORIGIN`    | Allowed CORS origin                  | `http://localhost:3000` |

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👥 Support

For support, email support@tycoon.com or open an issue in the repository.

---

**Happy Coding! 🎉**
