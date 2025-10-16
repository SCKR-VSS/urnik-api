/*import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

function getMondayOfWeek(year: number, week: number): Date {
  const firstDayOfYear = new Date(year, 0, 4);
  const dayOfWeek = firstDayOfYear.getDay();
  const daysToFirstMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;

  const firstMondayOfYear = new Date(year, 0, 4 + daysToFirstMonday);

  const targetMonday = new Date(firstMondayOfYear.getTime());
  targetMonday.setDate(targetMonday.getDate() + (week - 1) * 7);

  return targetMonday;
}

async function main() {
    console.log(`Start seeding ...`);
  
    const year = new Date().getFullYear();
    console.log(`Seeding weeks for ${year}...`);
  
    const firstWeekOfYear = await prisma.week.findFirst({
      where: {
        label: {
          contains: `1. 1.`,
        },
      },
    });
  
    if (!firstWeekOfYear || !firstWeekOfYear.label.endsWith(`- 5. 1.`)) {
      console.log(`Database is out of date. Re-seeding weeks for ${year}.`);
      await prisma.week.deleteMany({});
  
      const weeksToSeed: { value: string, label: string }[] = [];
  
      for (let i = 1; i <= 53; i++) {
        const monday = getMondayOfWeek(year, i);
  
        if (monday.getFullYear() > year) {
          break;
        }
  
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
  
        const startDay = monday.getDate();
        const startMonth = monday.getMonth() + 1;
        const endDay = friday.getDate();
        const endMonth = friday.getMonth() + 1;
  
        const label = `${startDay}. ${startMonth}. - ${endDay}. ${endMonth}.`;
  
        weeksToSeed.push({
          value: i.toString(),
          label: label,
        });
      }
  
      await prisma.week.createMany({
        data: weeksToSeed,
      });
  
      console.log(`Seeding finished. ${weeksToSeed.length} weeks created for ${year}.`);
    } else {
      console.log(`Weeks for ${year} already exist. Skipping.`);
    }
  }

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
*/