# Project Structure

```
shop-backend/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI/CD pipeline
├── src/
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces (Theme, User, Coupon, Transaction)
│   ├── database/
│   │   └── index.ts              # In-memory database with seed data
│   ├── services/
│   │   ├── shopService.ts        # Business logic for purchases
│   │   └── shopService.test.ts   # Service layer tests (20 tests)
│   ├── routes/
│   │   ├── shop.ts               # API endpoints
│   │   └── shop.test.ts          # API integration tests (15 tests)
│   ├── middleware/
│   │   └── validation.ts         # Request validation with Joi
│   ├── app.ts                    # Express app configuration
│   └── index.ts                  # Server entry point
├── dist/                         # Compiled JavaScript (after build)
├── coverage/                     # Test coverage reports
├── node_modules/                 # Dependencies
├── .env.example                  # Environment variables template
├── .gitignore                    # Git ignore rules
├── jest.config.js                # Jest test configuration
├── package.json                  # Project dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── README.md                     # Project documentation
├── IMPLEMENTATION.md             # Implementation details
├── TESTING_REPORT.md             # Test results and coverage
└── test-api.sh                   # API testing script
```

## Key Files

### Source Code

- **src/types/index.ts**: All TypeScript interfaces
- **src/database/index.ts**: Data layer with CRUD operations
- **src/services/shopService.ts**: Core purchase logic
- **src/routes/shop.ts**: REST API endpoints
- **src/middleware/validation.ts**: Input validation
- **src/app.ts**: Express app setup

### Tests

- **src/services/shopService.test.ts**: 20 unit tests
- **src/routes/shop.test.ts**: 15 integration tests
- **Total**: 35 tests with 92.61% coverage

### Configuration

- **package.json**: Dependencies and npm scripts
- **tsconfig.json**: TypeScript compiler options
- **jest.config.js**: Test configuration with coverage thresholds
- **.github/workflows/ci.yml**: CI/CD pipeline

### Documentation

- **README.md**: Getting started guide
- **IMPLEMENTATION.md**: Feature implementation details
- **TESTING_REPORT.md**: Test results and acceptance criteria
- **PROJECT_STRUCTURE.md**: This file

## NPM Scripts

```bash
npm run dev        # Start development server
npm run build      # Compile TypeScript to JavaScript
npm start          # Run production server
npm test           # Run tests with coverage
npm run test:ci    # Run tests in CI mode
```

## API Endpoints

- `POST /shop/purchase` - Purchase themes
- `GET /shop/themes` - Get available themes
- `GET /shop/transactions/:userId` - Get transaction history
- `GET /health` - Health check

## Test Files Location

All test files are co-located with their source files:

- Service tests: `src/services/*.test.ts`
- Route tests: `src/routes/*.test.ts`
