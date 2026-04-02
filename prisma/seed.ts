import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordAdmin = await bcrypt.hash('admin123', 10);
  const passwordStaff = await bcrypt.hash('staff123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: passwordAdmin,
      role: 'ADMIN',
    },
    create: {
      username: 'admin',
      password: passwordAdmin,
      role: 'ADMIN',
    },
  });

  const staff = await prisma.user.upsert({
    where: { username: 'staff' },
    update: {
      password: passwordStaff,
      role: 'PROJECT_STAFF',
    },
    create: {
      username: 'staff',
      password: passwordStaff,
      role: 'PROJECT_STAFF',
    },
  });

  console.log({ admin, staff });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
