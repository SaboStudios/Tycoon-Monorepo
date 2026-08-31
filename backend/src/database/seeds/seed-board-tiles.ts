import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../../.env') });

/**
 * Seed board tiles: properties, chances, and community chests.
 * Idempotent: safe to run multiple times without creating duplicates.
 * Uses ON CONFLICT for upsert-style behavior based on position.
 */
async function seed() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'tycoon_db',
  });

  try {
    await client.connect();
    console.log(`Connected to Postgres on port ${client.port}`);

    // Seed properties (40-tile board per frontend spec)
    console.log('Seeding properties (40 tiles)...');
    const propertiesSql = `
      INSERT INTO properties (
        id, type, name, group_id, position, grid_row, grid_col,
        price, rent_site_only, rent_one_house, rent_two_houses,
        rent_three_houses, rent_four_houses, rent_hotel,
        cost_of_house, is_mortgaged, color, icon, updated_at
      )
      VALUES
        (1, 'corner', 'Go', 0, '0', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'go', NOW()),
        (2, 'property', 'Mediterranean Avenue', 1, '1', 0, 1, 60, 2, 10, 30, 90, 160, 250, 50, false, '#8B4513', 'property', NOW()),
        (3, 'chance', 'Chance', 0, '2', 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'chance', NOW()),
        (4, 'property', 'Baltic Avenue', 1, '3', 0, 3, 60, 4, 12, 36, 110, 200, 300, 50, false, '#8B4513', 'property', NOW()),
        (5, 'tax', 'Income Tax', 0, '4', 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'tax', NOW()),
        (6, 'railroad', 'Reading Railroad', 5, '5', 0, 5, 200, 25, 50, 100, 200, 0, 0, 0, false, '#000000', 'railroad', NOW()),
        (7, 'property', 'Oriental Avenue', 2, '6', 0, 6, 100, 6, 18, 54, 150, 300, 450, 50, false, '#87CEEB', 'property', NOW()),
        (8, 'chance', 'Chance', 0, '7', 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'chance', NOW()),
        (9, 'property', 'Vermont Avenue', 2, '8', 0, 8, 100, 8, 20, 60, 180, 320, 450, 50, false, '#87CEEB', 'property', NOW()),
        (10, 'property', 'Connecticut Avenue', 2, '9', 0, 9, 120, 8, 24, 72, 210, 360, 500, 50, false, '#87CEEB', 'property', NOW()),
        (11, 'corner', 'Just Visiting', 0, '10', 1, 9, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'visiting', NOW()),
        (12, 'property', 'Saint Charles Place', 3, '11', 1, 8, 140, 10, 30, 90, 270, 400, 550, 100, false, '#FF1493', 'property', NOW()),
        (13, 'utility', 'Electric Company', 4, '12', 1, 7, 150, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'utility', NOW()),
        (14, 'property', 'States Avenue', 3, '13', 1, 6, 140, 10, 30, 90, 270, 400, 550, 100, false, '#FF1493', 'property', NOW()),
        (15, 'property', 'Virginia Avenue', 3, '14', 1, 5, 160, 12, 36, 108, 300, 450, 600, 100, false, '#FF1493', 'property', NOW()),
        (16, 'railroad', 'Pennsylvania Railroad', 5, '15', 1, 4, 200, 25, 50, 100, 200, 0, 0, 0, false, '#000000', 'railroad', NOW()),
        (17, 'property', 'St. James Place', 4, '16', 1, 3, 180, 14, 42, 126, 360, 500, 700, 100, false, '#FF8C00', 'property', NOW()),
        (18, 'community_chest', 'Community Chest', 0, '17', 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'chest', NOW()),
        (19, 'property', 'Tennessee Avenue', 4, '18', 1, 1, 180, 14, 42, 126, 360, 500, 700, 100, false, '#FF8C00', 'property', NOW()),
        (20, 'property', 'New York Avenue', 4, '19', 1, 0, 200, 16, 48, 144, 430, 625, 750, 100, false, '#FF8C00', 'property', NOW()),
        (21, 'corner', 'Free Parking', 0, '20', 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'parking', NOW()),
        (22, 'property', 'Kentucky Avenue', 6, '21', 2, 1, 220, 18, 54, 162, 450, 625, 750, 150, false, '#FF0000', 'property', NOW()),
        (23, 'chance', 'Chance', 0, '22', 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'chance', NOW()),
        (24, 'property', 'Indiana Avenue', 6, '23', 2, 3, 220, 18, 54, 162, 450, 625, 750, 150, false, '#FF0000', 'property', NOW()),
        (25, 'property', 'Illinois Avenue', 6, '24', 2, 4, 240, 20, 60, 180, 500, 700, 900, 150, false, '#FF0000', 'property', NOW()),
        (26, 'railroad', 'B&O Railroad', 5, '25', 2, 5, 200, 25, 50, 100, 200, 0, 0, 0, false, '#000000', 'railroad', NOW()),
        (27, 'property', 'Atlantic Avenue', 7, '26', 2, 6, 260, 22, 66, 198, 550, 750, 950, 150, false, '#FFFF00', 'property', NOW()),
        (28, 'property', 'Ventnor Avenue', 7, '27', 2, 7, 260, 22, 66, 198, 550, 750, 950, 150, false, '#FFFF00', 'property', NOW()),
        (29, 'utility', 'Water Works', 4, '28', 2, 8, 150, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'utility', NOW()),
        (30, 'property', 'Marvin Gardens', 7, '29', 2, 9, 280, 24, 72, 216, 600, 800, 1000, 150, false, '#FFFF00', 'property', NOW()),
        (31, 'corner', 'Go to Jail', 0, '30', 3, 9, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'jail', NOW()),
        (32, 'property', 'Pacific Avenue', 8, '31', 3, 8, 300, 26, 78, 234, 650, 850, 1050, 200, false, '#008000', 'property', NOW()),
        (33, 'property', 'North Carolina Avenue', 8, '32', 3, 7, 300, 26, 78, 234, 650, 850, 1050, 200, false, '#008000', 'property', NOW()),
        (34, 'community_chest', 'Community Chest', 0, '33', 3, 6, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'chest', NOW()),
        (35, 'property', 'Pennsylvania Avenue', 8, '34', 3, 5, 320, 28, 84, 252, 700, 875, 1050, 200, false, '#008000', 'property', NOW()),
        (36, 'railroad', 'Short Line', 5, '35', 3, 4, 200, 25, 50, 100, 200, 0, 0, 0, false, '#000000', 'railroad', NOW()),
        (37, 'chance', 'Chance', 0, '36', 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'chance', NOW()),
        (38, 'property', 'Park Place', 9, '37', 3, 2, 350, 35, 105, 300, 750, 900, 1100, 200, false, '#000080', 'property', NOW()),
        (39, 'tax', 'Luxury Tax', 0, '38', 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'tax', NOW()),
        (40, 'property', 'Boardwalk', 9, '39', 3, 0, 400, 50, 150, 450, 625, 750, 0, 200, false, '#000080', 'property', NOW())
      ON CONFLICT (position) DO UPDATE
      SET
        type = EXCLUDED.type,
        name = EXCLUDED.name,
        group_id = EXCLUDED.group_id,
        grid_row = EXCLUDED.grid_row,
        grid_col = EXCLUDED.grid_col,
        price = EXCLUDED.price,
        rent_site_only = EXCLUDED.rent_site_only,
        rent_one_house = EXCLUDED.rent_one_house,
        rent_two_houses = EXCLUDED.rent_two_houses,
        rent_three_houses = EXCLUDED.rent_three_houses,
        rent_four_houses = EXCLUDED.rent_four_houses,
        rent_hotel = EXCLUDED.rent_hotel,
        cost_of_house = EXCLUDED.cost_of_house,
        is_mortgaged = EXCLUDED.is_mortgaged,
        color = EXCLUDED.color,
        icon = EXCLUDED.icon,
        updated_at = NOW();
    `;
    await client.query(propertiesSql);
    console.log('Properties seeded successfully.');

    // Seed chances (20 cards as seed data)
    console.log('Seeding chances...');
    const chancesSql = `
      INSERT INTO chances (instruction, type, amount, position, extra, "createdAt", "updatedAt")
      VALUES
        ('Advance to GO (Collect $200)', 'MOVE', NULL, 0, NULL, NOW(), NOW()),
        ('Go to Jail. Do not pass GO.', 'PENALTY', NULL, 1, NULL, NOW(), NOW()),
        ('Pay School Tax of $150', 'PENALTY', 150, NULL, NULL, NOW(), NOW()),
        ('Your Building and Loan matures. Collect $150', 'REWARD', 150, NULL, NULL, NOW(), NOW()),
        ('Advance to the nearest Railroad', 'MOVE', NULL, 3, NULL, NOW(), NOW()),
        ('Take a trip to Reading Railroad', 'MOVE', NULL, 5, NULL, NOW(), NOW()),
        ('Advance token to nearest Utility', 'MOVE', NULL, 4, NULL, NOW(), NOW()),
        ('Go back 3 spaces', 'MOVE', NULL, NULL, NULL, NOW(), NOW()),
        ('You are assessed for street repairs. $40 per house. $115 per hotel', 'PENALTY', NULL, NULL, NULL, NOW(), NOW()),
        ('Speeding fine. Pay $15', 'PENALTY', 15, NULL, NULL, NOW(), NOW()),
        ('Bank pays you dividend of $50', 'REWARD', 50, NULL, NULL, NOW(), NOW()),
        ('Jail time', 'PENALTY', NULL, 10, NULL, NOW(), NOW()),
        ('Get out of Jail free', 'REWARD', NULL, NULL, NULL, NOW(), NOW()),
        ('Advance to Boardwalk', 'MOVE', NULL, 39, NULL, NOW(), NOW()),
        ('General repairs: $25 per house', 'PENALTY', 25, NULL, NULL, NOW(), NOW()),
        ('You won second prize in a beauty contest', 'REWARD', 10, NULL, NULL, NOW(), NOW()),
        ('Pay poor tax of $15', 'PENALTY', 15, NULL, NULL, NOW(), NOW()),
        ('Advance to Illinois Avenue', 'MOVE', NULL, 24, NULL, NOW(), NOW()),
        ('Make general repairs on your properties', 'PENALTY', NULL, NULL, NULL, NOW(), NOW()),
        ('You have won a crossword competition. Collect $100', 'REWARD', 100, NULL, NULL, NOW(), NOW())
      ON CONFLICT (position) DO UPDATE
      SET
        instruction = EXCLUDED.instruction,
        type = EXCLUDED.type,
        amount = EXCLUDED.amount,
        extra = EXCLUDED.extra,
        "updatedAt" = NOW()
      WHERE position IS NOT NULL;
    `;
    await client.query(chancesSql);
    console.log('Chances seeded successfully.');

    // Seed community chests (16 cards as seed data)
    console.log('Seeding community chests...');
    const communitySql = `
      INSERT INTO community_chests (instruction, type, amount, position, extra, "createdAt", "updatedAt")
      VALUES
        ('Advance to GO', 'MOVE', NULL, 0, NULL, NOW(), NOW()),
        ('Bank error in your favor. Collect $200', 'REWARD', 200, NULL, NULL, NOW(), NOW()),
        ('Doctor''s fees. Pay $50', 'PENALTY', 50, NULL, NULL, NOW(), NOW()),
        ('From sale of stock you get $45', 'REWARD', 45, NULL, NULL, NOW(), NOW()),
        ('Get Out of Jail Free', 'REWARD', NULL, NULL, NULL, NOW(), NOW()),
        ('Go to Jail', 'PENALTY', NULL, 10, NULL, NOW(), NOW()),
        ('Grand Opera Night. Collect $50', 'REWARD', 50, NULL, NULL, NOW(), NOW()),
        ('Holiday Fund matures. Receive $100', 'REWARD', 100, NULL, NULL, NOW(), NOW()),
        ('Income tax refund. Collect $20', 'REWARD', 20, NULL, NULL, NOW(), NOW()),
        ('It is your birthday. Collect $10 from each player', 'REWARD', 10, NULL, NULL, NOW(), NOW()),
        ('Life insurance matures. Collect $100', 'REWARD', 100, NULL, NULL, NOW(), NOW()),
        ('Pay hospital fees of $100', 'PENALTY', 100, NULL, NULL, NOW(), NOW()),
        ('Pay school fees of $150', 'PENALTY', 150, NULL, NULL, NOW(), NOW()),
        ('Receive for services $25', 'REWARD', 25, NULL, NULL, NOW(), NOW()),
        ('You are assessed for street repairs', 'PENALTY', NULL, NULL, NULL, NOW(), NOW()),
        ('You have won second prize. Collect $10', 'REWARD', 10, NULL, NULL, NOW(), NOW())
      ON CONFLICT (position) DO UPDATE
      SET
        instruction = EXCLUDED.instruction,
        type = EXCLUDED.type,
        amount = EXCLUDED.amount,
        extra = EXCLUDED.extra,
        "updatedAt" = NOW()
      WHERE position IS NOT NULL;
    `;
    await client.query(communitySql);
    console.log('Community chests seeded successfully.');

    console.log('Board tile seeding completed successfully!');
    await client.end();
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

seed();
