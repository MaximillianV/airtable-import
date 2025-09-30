/**
 * Prisma database seed script for initial data setup.
 * Creates the admin user with proper bcryptjs hash for authentication.
 * This ensures the default admin account works with the authentication system.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Generate proper bcryptjs hash for admin123 password
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    console.log(`🔐 Generated password hash for: ${adminPassword}`);
    
    const adminUser = await prisma.user.upsert({
      where: {
        email: 'admin@example.com'
      },
      update: {
        role: 'SUPERADMIN',
        password: hashedPassword  // Always update password with fresh hash
      },
      create: {
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'SUPERADMIN'
      }
    });
    
    console.log(`✅ Created/Updated admin user to SUPERADMIN role: ${adminUser.email}`);
    
    // Verify the admin user exists
    const verifyAdmin = await prisma.user.findUnique({
      where: { email: 'admin@example.com' },
      select: { email: true, role: true }
    });
    
    console.log(`🔍 Verified admin user role: ${verifyAdmin?.role}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Execute seeding and handle cleanup
main()
  .then(async () => {
    console.log('🎉 Database seeding completed successfully');
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('💥 Database seeding failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });