# Monopoly Properties NestJS API

This project implements a Monopoly board properties entity with full ORM mapping using NestJS and TypeORM.

## Features

✅ **All rent tiers mapped** - Site only, 1-4 houses, and hotel rent levels
✅ **Mortgage flag defaults to false** - `is_mortgaged` boolean with proper default
✅ **Position & grid coordinates validated** - BeforeInsert/BeforeUpdate hooks ensure data integrity
✅ **Complete CRUD operations** - Full REST API for properties management
✅ **Advanced queries** - Filter by type, group ID, and position

## Database Schema

Properties table with the following structure:

- **id** (int): Primary key
- **type** (varchar): Property type (street, railroad, utility, special)
- **name** (varchar): Property name
- **group_id** (int): Color group identifier
- **position** (varchar): Board position
- **grid_row** (int): Row coordinate (0-9)
- **grid_col** (int): Column coordinate (0-9)
- **price** (int): Purchase price
- **rent_site_only** (int): Base rent without houses
- **rent_one_house** (int): Rent with 1 house
- **rent_two_houses** (int): Rent with 2 houses
- **rent_three_houses** (int): Rent with 3 houses
- **rent_four_houses** (int): Rent with 4 houses
- **rent_hotel** (int): Rent with hotel
- **cost_of_house** (int): House purchase cost
- **is_mortgaged** (tinyint): Mortgage status (default: 0/false)
- **color** (varchar): Group color code
- **icon** (varchar): Property icon path

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file:

```
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_NAME=monopoly
NODE_ENV=development
PORT=3000
```

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Endpoints

### Get All Properties

```
GET /properties
```

Query parameters:

- `type` - Filter by property type
- `groupId` - Filter by group ID
- `position` - Filter by position

### Get Property by ID

```
GET /properties/:id
```

### Create Property

```
POST /properties
Body: CreatePropertyDto
```

### Update Property

```
PATCH /properties/:id
Body: UpdatePropertyDto
```

### Toggle Mortgage Status

```
POST /properties/:id/toggle-mortgage
```

### Delete Property

```
DELETE /properties/:id
```

### Get Statistics

```
GET /properties/stats
```

## Validation

- **Grid coordinates**: Must be between 0-9
- **Position**: Required and cannot be empty
- **Color**: Must be valid hex color format
- **Numeric fields**: Proper number validation

## Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module with TypeORM config
└── properties/
    ├── dto/
    │   ├── create-property.dto.ts
    │   └── update-property.dto.ts
    ├── entities/
    │   └── property.entity.ts
    ├── properties.controller.ts
    ├── properties.service.ts
    └── properties.module.ts
```

## Example Usage

```typescript
// Create a property
POST /properties
{
  "id": 1,
  "type": "street",
  "name": "Mediterranean Avenue",
  "group_id": 1,
  "position": "A1",
  "grid_row": 0,
  "grid_col": 0,
  "price": 60,
  "rent_site_only": 2,
  "rent_one_house": 10,
  "rent_two_houses": 30,
  "rent_three_houses": 90,
  "rent_four_houses": 160,
  "rent_hotel": 250,
  "cost_of_house": 50,
  "is_mortgaged": false,
  "color": "#8B4513"
}
```

## Acceptance Criteria Met

- ✅ All rent tiers mapped (rent_site_only through rent_hotel)
- ✅ Mortgage flag defaults to false with boolean type
- ✅ Position and grid coordinates validated with BeforeInsert/BeforeUpdate hooks
