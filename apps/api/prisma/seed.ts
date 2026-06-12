import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@perazim.com',
      username: 'admin',
      password: hashedPassword,
      isActive: true,
      permissions: {
        create: {
          vehicleList: true,
          vehicleView: true,
          vehicleEdit: true,
          vehicleAdd: true,
          vehicleGroup: true,
          vehicleGroupAdd: true,
          vehicleGroupAction: true,
          driverList: true,
          driverEdit: true,
          driverAdd: true,
          tripList: true,
          tripEdit: true,
          tripAdd: true,
          customerList: true,
          customerEdit: true,
          customerAdd: true,
          fuelList: true,
          fuelEdit: true,
          fuelAdd: true,
          reminderList: true,
          reminderDelete: true,
          reminderAdd: true,
          incomeExpenseList: true,
          incomeExpenseEdit: true,
        },
      },
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // Default settings
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      companyName: 'Perazim Transport',
      vat: 15,
      currency: 'ZAR',
    },
  });
  console.log('Created default settings');

  // Default inspection categories
  const categories = [
    { name: 'Engine & Fluids', items: ['Oil Level', 'Coolant Level', 'Brake Fluid', 'Power Steering Fluid'] },
    { name: 'Tyres & Wheels', items: ['Front Left Tyre', 'Front Right Tyre', 'Rear Left Tyre', 'Rear Right Tyre', 'Spare Tyre'] },
    { name: 'Lights', items: ['Headlights', 'Tail Lights', 'Indicators', 'Hazard Lights', 'Reverse Lights'] },
    { name: 'Body & Exterior', items: ['Windshield', 'Mirrors', 'Doors', 'Body Damage'] },
    { name: 'Safety Equipment', items: ['Fire Extinguisher', 'First Aid Kit', 'Safety Triangle', 'Seat Belts'] },
  ];

  for (const [i, cat] of categories.entries()) {
    const category = await prisma.inspectionCategory.upsert({
      where: { id: i + 1 },
      update: {},
      create: {
        name: cat.name,
        isActive: true,
        order: i + 1,
        items: {
          create: cat.items.map((item, j) => ({
            name: item,
            isActive: true,
            order: j + 1,
          })),
        },
      },
    });
    console.log(`Created inspection category: ${category.name}`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
