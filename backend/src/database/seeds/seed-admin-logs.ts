import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { randomInt } from 'crypto';

dotenv.config({ path: join(__dirname, '../../../../.env') });

const BATCH_SIZE = 5000;
const TOTAL_LOGS = 100000;

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

    // Create required tables
    console.log('Creating required tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE,
        role VARCHAR(20) DEFAULT 'USER',
        is_admin BOOLEAN DEFAULT false,
        address VARCHAR(100) UNIQUE,
        chain VARCHAR(50) DEFAULT 'BASE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        "adminId" INTEGER,
        action VARCHAR(100) NOT NULL,
        "targetId" INTEGER,
        details JSONB,
        "ipAddress" VARCHAR(45),
        "userAgent" TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "IDX_admin_logs_adminId" ON admin_logs ("adminId");
      CREATE INDEX IF NOT EXISTS "IDX_admin_logs_action" ON admin_logs (action);
      CREATE INDEX IF NOT EXISTS "IDX_admin_logs_targetId" ON admin_logs ("targetId");
      CREATE INDEX IF NOT EXISTS "IDX_admin_logs_createdAt" ON admin_logs (created_at);
    `);
    console.log('Tables created successfully.');

    // Create a dummy admin user
    const adminRes = await client.query(`
      INSERT INTO users (email, username, role, is_admin, address, chain)
      VALUES ('seed-admin@example.com', 'seedadmin', 'ADMIN', true, '0x1234567890123456789012345678901234567890', 'BASE')
      ON CONFLICT (email) DO UPDATE SET is_admin = true
      RETURNING id;
    `);
    const adminId = adminRes.rows[0].id;
    console.log(`Using admin ID: ${adminId}`);

    console.log(`Seeding ${TOTAL_LOGS} logs...`);
    const actions = ['user:update', 'user:delete', 'shop:item_add', 'shop:item_remove', 'settings:update', 'waitlist:export'];

    for (let i = 0; i < TOTAL_LOGS; i += BATCH_SIZE) {
      const placeholders: string[] = [];
      const correctValues: any[] = [];
      
      for (let j = 0; j < BATCH_SIZE; j++) {
        const offset = j * 7;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
        
        const date = new Date();
        date.setMinutes(date.getMinutes() - (i + j));
        
        const action = actions[randomInt(0, actions.length)];
        const targetId = randomInt(0, 1000);
        const details = JSON.stringify({ foo: 'bar', index: i + j });
        const ipAddress = `192.168.1.${randomInt(0, 255)}`;
        const userAgent = 'Mozilla/5.0';
        
        correctValues.push(adminId, action, targetId, details, ipAddress, userAgent, date);
      }
      
      const correctQuery = `
        INSERT INTO admin_logs ("adminId", action, "targetId", details, "ipAddress", "userAgent", "created_at")
        VALUES ${placeholders.join(', ')}
      `;

      await client.query(correctQuery, correctValues);
      
      console.log(`Inserted ${i + BATCH_SIZE} logs...`);
    }

    console.log('Seeding completed successfully!');
    await client.end();
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

seed();
