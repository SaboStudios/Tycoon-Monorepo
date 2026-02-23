import { AppDataSource } from '../../config/database.config';
import { User } from '../../modules/users/entities/user.entity';
import { Role } from '../../modules/auth/enums/role.enum';
import * as bcrypt from 'bcrypt';

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log('Data Source has been initialized!');

    const userRepository = AppDataSource.getRepository(User);

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tycoon.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecretAdmin123!';

    const existingAdmin = await userRepository.findOne({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.log('Admin user already exists.');
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const admin = userRepository.create({
        email: adminEmail,
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Admin',
        role: Role.ADMIN,
        is_admin: true,
        username: 'admin',
      });

      await userRepository.save(admin);
      console.log('Super admin account created successfully!');
    }

    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

seed().catch((error) => {
  console.error('Unhandled error during seeding:', error);
  process.exit(1);
});
