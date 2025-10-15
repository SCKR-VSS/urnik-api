import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log(`🌱 Start seeding 🌱`);

  await prisma.$connect();

  const classes = [
    { id: 1, name: 'RAI 1.l' },
    { id: 2, name: 'RAI 2.l' },
    { id: 3, name: 'INF 2.l' },
    { id: 4, name: 'RAI 1.c' },
    { id: 5, name: 'RAI 2.c' },
    { id: 6, name: 'INF 3.c' },
    { id: 7, name: 'MEH 1.l' },
    { id: 8, name: 'MEH 2.l' },
    { id: 9, name: 'MEH 1.c' },
    { id: 10, name: 'MEH 2.c' },
    { id: 11, name: 'MEH 3.c' },
    { id: 12, name: 'ENE 1.l' },
    { id: 13, name: 'ENE 2.l' },
    { id: 14, name: 'ENE 1.c' },
    { id: 15, name: 'ENE 2.c' },
    { id: 16, name: 'ENE 3.c' },
    { id: 17, name: 'VAR 1.c' },
    { id: 18, name: 'VAR 2.c' },
    { id: 19, name: 'VAR 3.c' },
    { id: 20, name: 'EKN 1.l' },
    { id: 21, name: 'EKN 2.l Kom' },
    { id: 22, name: 'EKN 2.l Rač' },
    { id: 23, name: 'EKN 1.c Rač' },
    { id: 24, name: 'EKN 2.c Rač' },
    { id: 25, name: 'EKN 2.c Kom' },
    { id: 26, name: 'EKN 3.c Kom' },
    { id: 27, name: 'OSM 1.c' },
    { id: 28, name: 'OSM 2.c' },
  ];

  await prisma.class.createMany({
    data: classes,
  });
}

main()
  .catch((e) => {
    console.log('❌ Error seeding ❌');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    console.log('🍀 Finished seeding 🍀');
    await prisma.$disconnect();
  });
