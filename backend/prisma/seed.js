/**
 * Prisma database seed script for initial data setup.
 * Updates the existing admin user to have SUPERADMIN role for full system access.
 * This ensures the default admin account has all permissions including debug mode.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Update existing admin user to SUPERADMIN role
    // This gives the default admin account full system permissions
    const updatedAdmin = await prisma.user.update({
      where: {
        email: 'admin@example.com'
      },
      data: {
        role: 'SUPERADMIN'
      }
    });
    
    console.log(`✅ Updated admin user to SUPERADMIN role: ${updatedAdmin.email}`);
    
    // Verify the update was successful
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@example.com' },
      select: { email: true, role: true }
    });
    
    console.log(`🔍 Verified admin user role: ${adminUser?.role}`);
    
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