import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';
import { TimetableParser } from './timetable/parseTimetable';
import * as crypto from 'crypto';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);
  private parser = new TimetableParser();

  constructor(private prisma: PrismaService) {}

  onApplicationBootstrap() {
    this.logger.log('Application has started. Initializing timetable check...');
    this.checkTimetable();
  }

  @Cron('*/30 * * * *')
  async checkTimetable() {
    if (process.env.NODE_ENV === 'development') return;

    const htm = await fetch(
      'https://sckr.si/vss/urniki/frames/navbar.htm',
    ).then((res) => res.text());

    const availableWeeks = this.parser.getWeeks(htm);

    const weeksInDb = await this.prisma.week.findMany();

    for (const week of availableWeeks) {
      const weekExists = weeksInDb.find((w) => w.id === week.id);
      if (!weekExists) {
        await this.prisma.week.create({
          data: {
            id: week.id,
            label: week.label,
          },
        });
      } else if (weekExists.label !== week.label) {
        await this.prisma.week.update({
          where: {
            id: week.id,
          },
          data: {
            label: week.label,
          },
        });
      }
    }

    const professors = this.parser.getTeachers(htm);

    for (const professor of professors) {
      const teacherExists = await this.prisma.professor.findFirst({
        where: {
          name: professor,
        },
      });

      if (!teacherExists) {
        await this.prisma.professor.create({
          data: {
            name: professor,
          },
        });

        this.logger.log(`Added new professor to database: ${professor}`);
      }
    }

    this.logger.log('Checking for timetable updates...');

    const currentDate = new Date();
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (currentDate.valueOf() - startOfYear.valueOf()) / 86400000;
    const currentWeekNumber = Math.ceil(
      (pastDaysOfYear + startOfYear.getDay() + 1) / 7,
    );

    const weeks = await this.prisma.week.findMany();

    const classes = await this.prisma.class.findMany();

    for (const classItem of classes) {
      for (const week of weeks) {
        const timetableExists = await this.prisma.timetable.findFirst({
          where: {
            classId: classItem.id,
            weekId: week.id,
          },
        });

        if (!timetableExists) {
          this.logger.log(
            `Timetable missing for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}. Fetching...`,
          );

          try {
            const paddedNum = classItem.id.toString().padStart(5, '0');
            const url = `https://sckr.si/vss/urniki/c/${week.id}/c${paddedNum}.htm`;
            const response = await fetch(url);

            if (response.ok) {
              const html = await response.text();

              const parsedTimetable = JSON.stringify(
                this.parser.parse(html, week.label),
              );

              const hash = crypto.createHash('md5').update(html).digest('hex');

              await this.prisma.timetable.create({
                data: {
                  classId: classItem.id,
                  weekId: week.id,
                  data: parsedTimetable.toString(),
                  hash: hash,
                },
              });

              this.logger.log(
                `Timetable stored for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}. With hash ${hash}`,
              );
            }
          } catch (error) {
            this.logger.error(
              `Failed to fetch/store timetable for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}: ${error.message}`,
            );
          }
        } else {
          this.logger.log(
            `Timetable already exists for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}. Checking hash...`,
          );

          try {
            const paddedNum = classItem.id.toString().padStart(5, '0');
            const url = `https://sckr.si/vss/urniki/c/${week.id}/c${paddedNum}.htm`;

            const response = await fetch(url);

            if (response.ok) {
              const html = await response.text();

              const hash = crypto.createHash('md5').update(html).digest('hex');

              if (hash !== timetableExists.hash) {
                const parsedTimetable = JSON.stringify(
                  this.parser.parse(html, week.label),
                );

                await this.prisma.timetable.update({
                  where: {
                    id: timetableExists.id,
                  },
                  data: {
                    data: parsedTimetable.toString(),
                    hash: hash,
                  },
                });

                this.logger.log(
                  `Timetable updated for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}. New hash ${hash}`,
                );
              } else {
                this.logger.log(
                  `No changes detected for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}.`,
                );
              }
            }
          } catch (error) {
            this.logger.error(
              `Failed to check/update timetable for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}: ${error.message}`,
            );
          }
        }
      }
    }
  }
}
