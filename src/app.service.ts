import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';
import { TimetableParser } from './timetable/parseTimetable';
import * as crypto from 'crypto';
import { MailingService } from './mailing/mailing.service';
import * as fs from 'fs';
import slots from './constants/slots';

function compareTimetables(oldData: any, newData: any): string {
  const changes: string[] = [];
  const oldClasses = new Map<string, any>();

  oldData.days.forEach((day: any, dayIndex: number) => {
    day.classes.forEach((cls: any) => {
      const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
      oldClasses.set(key, cls);
    });
  });

  newData.days.forEach((day: any, dayIndex: number) => {
    day.classes.forEach((cls: any) => {
      const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
      const oldCls = oldClasses.get(key);

      if (oldCls) {
        const modifications: string[] = [];
        if (oldCls.teacher !== cls.teacher) {
          modifications.push(`profesor iz <strong>${oldCls.teacher || 'N/A'}</strong> v <strong>${cls.teacher || 'N/A'}</strong>`);
        }
        if (oldCls.classroom !== cls.classroom) {
          modifications.push(`učilnica iz <strong>${oldCls.classroom || 'N/A'}</strong> v <strong>${cls.classroom || 'N/A'}</strong>`);
        }
        if (oldCls.group !== cls.group) {
          modifications.push(`skupina iz <strong>${oldCls.group || 'vse'}</strong> v <strong>${cls.group || 'vse'}</strong>`);
        }

        if (modifications.length > 0) {
          const dayName = day.day.split(' ')[0];
          const startTime = slots[cls.slot]?.split(' ')[0] || '';
          changes.push(`<p><strong>${dayName} ob ${startTime} (${cls.subject}):</strong> sprememba za ${modifications.join(', ')}.</p>`);
        }
        oldClasses.delete(key);
      } else {
        const dayName = day.day.split(' ')[0];
        const startTime = slots[cls.slot]?.split(' ')[0] || '';
        changes.push(`<p><strong>Dodan nov termin:</strong> ${cls.subject} v ${dayName} ob ${startTime} v učilnici ${cls.classroom}.</p>`);
      }
    });
  });

  oldClasses.forEach((cls) => {
    const dayName = cls.dayName.split(' ')[0];
    const startTime = slots[cls.slot]?.split(' ')[0] || '';
    changes.push(`<p><strong>Odstranjen termin:</strong> ${cls.subject} v ${dayName} ob ${startTime}.</p>`);
  });

  return changes.join('');
}

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);
  private parser = new TimetableParser();

  constructor(
    private prisma: PrismaService,
    private mailingService: MailingService,
  ) {}

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

    const fetchedClasses = this.parser.getClasses(htm);

    const classesInDb = await this.prisma.class.findMany();

    for (const classItem of fetchedClasses) {
      const classExists = classesInDb.find((c) => c.id === classItem.id);
      if (!classExists) {
        await this.prisma.class.create({
          data: {
            id: classItem.id,
            name: classItem.name,
          },
        });
      } else if (classExists.name !== classItem.name) {
        await this.prisma.class.update({
          where: {
            id: classItem.id,
          },
          data: {
            name: classItem.name,
          },
        });
      }
    }

    this.logger.log('Checking for timetable updates...');

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
                const newTimetableData = this.parser.parse(html, week.label);
                const newTimetableString = JSON.stringify(newTimetableData);

                await this.prisma.timetable.update({
                  where: {
                    id: timetableExists.id,
                  },
                  data: {
                    data: newTimetableString,
                    hash: hash,
                  },
                });

                const oldTimetableData = JSON.parse(
                  timetableExists.data as string,
                );

                const changeDetailsHtml = compareTimetables(
                  oldTimetableData,
                  newTimetableData
                );

                if (changeDetailsHtml) {
                  const emails = await this.mailingService.getEmailsByClass(
                    classItem.id,
                  );

                  if (emails.length > 0) {
                    const emailTemplate = fs.readFileSync(
                      'src/mailing/mails/change.html',
                      'utf-8',
                    );
                    const subject = `Posodobljen urnik za ${classItem.name} - ${week.label}`;

                    for (const mail of emails) {
                      const userGroups = JSON.parse(JSON.stringify(mail.groups)) || {};
                      const userSubjects = JSON.parse(JSON.stringify(mail.subjects)) || [];

                      let hasRelevantChange = false;

                      if (userSubjects.length === 0 || Object.keys(userGroups).length === 0) {
                        hasRelevantChange = true;
                      }

                      if (!hasRelevantChange) {
                        for (const day of newTimetableData.days) {
                          for (const cls of day.classes) {
                            const subjectCode = cls.subject.split(" ")[0];
                            
                            if (
                              (userSubjects.length === 0 || userSubjects.includes(subjectCode)) &&
                              (Object.keys(userGroups).length === 0 || userGroups[subjectCode] === cls.group || userGroups[subjectCode] === 0)
                            ) {
                              hasRelevantChange = true;
                              break;
                            }
                          }
                          if (hasRelevantChange) break;
                        }
                      }

                      if (!hasRelevantChange) {
                        continue;
                      }

                      let finalHtml = emailTemplate.replace(
                        '{{change_details}}',
                        changeDetailsHtml,
                      ).replace(
                        '{{remove_mail}}',
                        `${process.env.API_DOMAIN}/mailing/remove?email=${encodeURIComponent(mail.hash)}&classId=${classItem.id}`
                      );

                      await this.mailingService.sendEmail(
                        mail.email,
                        subject,
                        finalHtml,
                      );
                    }
                  }
                }

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
