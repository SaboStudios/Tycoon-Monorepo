# Tycoon Monorepo

A comprehensive gaming platform built with microservices architecture, featuring blockchain integration and modern web technologies.

## Services

| Service | Status | Owner | Description |
|---------|--------|-------|-------------|
| [backend/](backend/) | Active | Platform Team | Main API backend (NestJS) - game logic, users, analytics |
| [frontend/](frontend/) | Active | Frontend Team | Web application (Next.js) - user interface and wallet integration |
| [contract/](contract/) | Active | Blockchain Team | Smart contracts (Rust) - NEAR blockchain assets and transactions |
| [src/](src/) | Deprecated | Platform Team | Admin user management sample (NestJS) - legacy implementation |

## Quick Start

```bash
# Install all dependencies
npm run install:all

# Start all services for development
npm run dev:all
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed service boundaries, diagrams, and development setup.

## Prerequisites

- Node.js 18+
- Rust 1.70+ (for contracts)
- PostgreSQL 12+
- Redis
- Docker

## Development

### Individual Services

```bash
# Backend API
cd backend && npm run start:dev  # http://localhost:3001

# Frontend
cd frontend && npm run dev       # http://localhost:3000

# Admin Sample (deprecated)
npm run start:dev                # http://localhost:3002
```

### Testing

```bash
# Run all tests
npm run test:all

# Run backend tests
cd backend && npm run test

# Run frontend tests
cd frontend && npm run test
```

## Deployment

Each service is independently deployable:

- **Backend**: Docker container with Kubernetes orchestration
- **Frontend**: Vercel/Netlify static deployment
- **Contracts**: NEAR blockchain deployment

## Contributing

1. Choose the appropriate service directory for your changes
2. Follow the service-specific contribution guidelines
3. Ensure tests pass and builds succeed
4. Update documentation as needed

## License

See individual service directories for licensing information.

- `user` - Regular user
- `moderator` - Moderator with elevated permissions
- `admin` - Full administrative access

## User Status

- `active` - User can access the system
- `suspended` - User is blocked from accessing the system

## Audit Logging

All admin actions are automatically logged with:

- Action type (role_changed, user_suspended, etc.)
- Target user
- Admin who performed the action
- Metadata (old/new values)
- Timestamp

## Architecture

- **Entities**: User, AuditLog
- **DTOs**: Query validation and transformation
- **Guards**: JWT authentication and role-based authorization
- **Service**: Business logic and database operations
- **Controller**: REST API endpoints

## Testing

The module includes comprehensive tests:

- Unit tests for service and controller
- E2E tests for all endpoints
- Test coverage for all features

All tests pass including CI/CD pipeline requirements.
