/**
 * Idempotency test for board tile seeding (#1437).
 * Verifies that running the seed script multiple times doesn't create duplicates.
 *
 * Run with: npm run typeorm:seed -- seed-board-tiles
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../../.env') });

async function runSeed(client: Client) {
  // Seed properties, chances, and community chests
  const propertiesSql = `
    INSERT INTO properties (
      id, type, name, group_id, position, grid_row, grid_col,
      price, rent_site_only, rent_one_house, rent_two_houses,
      rent_three_houses, rent_four_houses, rent_hotel,
      cost_of_house, is_mortgaged, color, icon, updated_at
    )
    VALUES
      (1, 'corner', 'Go', 0, '0', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, '#FFFFFF', 'go', NOW()),
      (2, 'property', 'Mediterranean Avenue', 1, '1', 0, 1, 60, 2, 10, 30, 90, 160, 250, 50, false, '#8B4513', 'property', NOW())
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

  const chancesSql = `
    INSERT INTO chances (instruction, type, amount, position, extra, "createdAt", "updatedAt")
    VALUES
      ('Advance to GO (Collect $200)', 'MOVE', NULL, 0, NULL, NOW(), NOW()),
      ('Go to Jail. Do not pass GO.', 'PENALTY', NULL, 1, NULL, NOW(), NOW())
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

  const communitySql = `
    INSERT INTO community_chests (instruction, type, amount, position, extra, "createdAt", "updatedAt")
    VALUES
      ('Advance to GO', 'MOVE', NULL, 0, NULL, NOW(), NOW()),
      ('Bank error in your favor. Collect $200', 'REWARD', 200, NULL, NULL, NOW(), NOW())
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
}

async function testIdempotency() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'tycoon_db',
  });

  try {
    await client.connect();
    console.log('Testing board tile seed idempotency...\n');

    // First run: seed and count
    console.log('Run 1: Seeding board tiles...');
    await runSeed(client);

    const countAfterRun1 = await client.query(
      'SELECT COUNT(*) as count FROM properties UNION ALL SELECT COUNT(*) FROM chances UNION ALL SELECT COUNT(*) FROM community_chests',
    );
    const propertiesCount1 = countAfterRun1.rows[0].count;
    const chancesCount1 = countAfterRun1.rows[1].count;
    const communityCount1 = countAfterRun1.rows[2].count;

    console.log(`After run 1:`);
    console.log(`  Properties: ${propertiesCount1}`);
    console.log(`  Chances: ${chancesCount1}`);
    console.log(`  Community Chests: ${communityCount1}\n`);

    // Second run: seed again and count
    console.log('Run 2: Seeding board tiles again (should be idempotent)...');
    await runSeed(client);

    const countAfterRun2 = await client.query(
      'SELECT COUNT(*) as count FROM properties UNION ALL SELECT COUNT(*) FROM chances UNION ALL SELECT COUNT(*) FROM community_chests',
    );
    const propertiesCount2 = countAfterRun2.rows[0].count;
    const chancesCount2 = countAfterRun2.rows[1].count;
    const communityCount2 = countAfterRun2.rows[2].count;

    console.log(`After run 2:`);
    console.log(`  Properties: ${propertiesCount2}`);
    console.log(`  Chances: ${chancesCount2}`);
    console.log(`  Community Chests: ${communityCount2}\n`);

    // Verify idempotency
    let success = true;
    if (propertiesCount1 !== propertiesCount2) {
      console.error(
        `❌ Properties count changed! Run 1: ${propertiesCount1}, Run 2: ${propertiesCount2}`,
      );
      success = false;
    } else {
      console.log(`✓ Properties count stable: ${propertiesCount1}`);
    }

    if (chancesCount1 !== chancesCount2) {
      console.error(
        `❌ Chances count changed! Run 1: ${chancesCount1}, Run 2: ${chancesCount2}`,
      );
      success = false;
    } else {
      console.log(`✓ Chances count stable: ${chancesCount1}`);
    }

    if (communityCount1 !== communityCount2) {
      console.error(
        `❌ Community Chests count changed! Run 1: ${communityCount1}, Run 2: ${communityCount2}`,
      );
      success = false;
    } else {
      console.log(`✓ Community Chests count stable: ${communityCount1}`);
    }

    if (success) {
      console.log(
        '\n✓ Board tile seed is idempotent! Multiple runs do not create duplicates.',
      );
      process.exit(0);
    } else {
      console.error(
        '\n❌ Board tile seed is NOT idempotent! Duplicates were created.',
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('Error during idempotency test:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testIdempotency();
