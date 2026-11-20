import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { TimetableParser } from './timetable/parseTimetable';
import * as crypto from 'crypto';
import { MailingService } from './mailing/mailing.service';
import { PushService } from './push/push.service';
import { changesBox, renderMail, unsubscribeLink } from './mailing/layout';
import {
  compareTimetables,
  compareTimetablesForProfessor,
  compareTimetablesForPush,
  compareTimetablesForProfessorPush,
} from './functions/timetableCompare';
import { Week } from './database/entities/week.entity';
import { Professor } from './database/entities/professor.entity';
import { SchoolClass } from './database/entities/school-class.entity';
import { Timetable } from './database/entities/timetable.entity';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);
  private parser = new TimetableParser();
  private isTimetableCheckRunning = false;

  constructor(
    private readonly orm: MikroORM,
    private mailingService: MailingService,
    private pushService: PushService,
  ) { }

  onApplicationBootstrap() {
    this.logger.log('Application has started. Initializing timetable check...');
    this.checkTimetable();
  }

  @Cron('*/30 * * * *')
  async checkTimetable() {
    this.logger.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    //if (process.env.NODE_ENV === 'development') return;

    if (this.isTimetableCheckRunning) {
      this.logger.warn('Timetable check already in progress, skipping this run.');
      return;
    }
    this.isTimetableCheckRunning = true;
    try {
      await RequestContext.create(this.orm.em, () => this.runTimetableCheck());
    } catch (error) {
      // @ts-ignore
      this.logger.error(`Timetable check failed: ${error.message}`);
    } finally {
      this.isTimetableCheckRunning = false;
    }
  }

  private async runTimetableCheck() {
    const em = this.orm.em.fork();

    const htm = await fetch(
      'https://sckr.si/vss/urniki/frames/navbar.htm',
    ).then((res) => res.text());

    const { weeks: availableWeeks, teachers: professors, classes: fetchedClasses } = this.parser.parseNavbar(htm);

    const weeksInDb = await em.find(Week, {});

    for (const week of availableWeeks) {
      const weekExists = weeksInDb.find((w) => w.id === week.id);
      if (!weekExists) {
        const newWeek = em.create(Week, { id: week.id, label: week.label });
        await em.persist(newWeek).flush();
      } else if (weekExists.label !== week.label) {
        weekExists.label = week.label;
        await em.flush();
      }
    }

    for (const professor of professors) {
      const teacherExists = await em.findOne(Professor, { name: professor });

      if (!teacherExists) {
        const newProfessor = em.create(Professor, { name: professor });
        await em.persist(newProfessor).flush();
        this.logger.log(`Added new professor to database: ${professor}`);
      }
    }

    const classesInDb = await em.find(SchoolClass, {});

    for (const classItem of fetchedClasses) {
      const classExists = classesInDb.find((c) => c.id === classItem.id);
      if (!classExists) {
        const newClass = em.create(SchoolClass, { id: classItem.id, name: classItem.name });
        await em.persist(newClass).flush();
      } else if (classExists.name !== classItem.name) {
        classExists.name = classItem.name;
        await em.flush();
      }
    }

    this.logger.log('Checking for timetable updates...');

    const weeks = await em.find(Week, {});

    const classes = await em.find(SchoolClass, {});

    for (const classItem of classes) {
      for (const week of weeks) {
        const timetableExists = await em.findOne(Timetable, {
          schoolClass: classItem.id,
          week: week.id,
        });

        if (!timetableExists) {
          this.logger.log(
            `Timetable missing for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}. Fetching...`,
          );

          try {
            const paddedNum = classItem.id.toString().padStart(5, '0');
            let urlWeek = week.id.toString();
            if (week.id < 10) {
              urlWeek = '0' + week.id;
            }
            const url = `https://sckr.si/vss/urniki/c/${urlWeek}/c${paddedNum}.htm`;
            const response = await fetch(url);

            if (response.ok) {
              const html = await response.text();

              const timetableData = this.parser.parse(html, week.label);

              const hash = crypto.createHash('md5').update(html).digest('hex');

              const professorDb = await em.find(Professor, {});

              let professorIds: number[] = [];

              for (const prof of professorDb) {
                if (
                  timetableData.days.some((day: any) =>
                    day.classes.some((cls: any) => cls.teacher === prof.name),
                  )
                ) {
                  professorIds.push(prof.id);
                }
              }

              const newTimetable = em.create(Timetable, {
                schoolClass: classItem.id,
                week: week.id,
                data: timetableData,
                hash: hash,
              });
              await em.persist(newTimetable).flush();

              this.logger.log(
                `Timetable stored for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}. With hash ${hash}`,
              );
            }
          } catch (error) {
            this.logger.error(
              // @ts-ignore
              `Failed to fetch/store timetable for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}: ${error.message}`,
            );
          }
        } else {
          this.logger.log(
            `Timetable already exists for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}. Checking hash...`,
          );

          try {
            const paddedNum = classItem.id.toString().padStart(5, '0');
            let urlWeek = week.id.toString();
            if (week.id < 10) {
              urlWeek = '0' + week.id;
            }
            const url = `https://sckr.si/vss/urniki/c/${urlWeek}/c${paddedNum}.htm`;

            const response = await fetch(url);

            if (response.ok) {
              const html = await response.text();

              const hash = crypto.createHash('md5').update(html).digest('hex');

              if (hash !== timetableExists.hash) {
                const oldTimetableData = timetableExists.data;
                const newTimetableData = this.parser.parse(html, week.label);

                timetableExists.data = newTimetableData;
                timetableExists.hash = hash;
                await em.flush();

                const changeDetailsHtml = compareTimetables(
                  oldTimetableData,
                  newTimetableData,
                );

                if (changeDetailsHtml) {
                  const emails = await this.mailingService.getEmailsByClass(
                    classItem.id,
                  );

                  const subject = `Sprememba urnika: ${classItem.name} (teden ${week.label})`;
                  const classMail = (link: string | null, extra = '') =>
                    renderMail({
                      title: `Sprememba urnika za ${classItem.name}`,
                      content: `<p style="margin:0 0 16px 0;">Urnik za teden <strong>${week.label}</strong> se je spremenil:</p>${changesBox(changeDetailsHtml)}${extra}`,
                      unsubscribeLink: link,
                    });

                  const sent = { class: 0, prof: 0, failed: 0 };

                  {
                    for (const mail of emails) {
                      const userGroups =
                        JSON.parse(JSON.stringify(mail.groups)) || {};
                      const userSubjects =
                        JSON.parse(JSON.stringify(mail.subjects)) || [];

                      let hasRelevantChange = false;

                      if (
                        userSubjects.length === 0 ||
                        Object.keys(userGroups).length === 0
                      ) {
                        hasRelevantChange = true;
                      }

                      if (!hasRelevantChange) {
                        for (const day of newTimetableData.days) {
                          for (const cls of day.classes) {
                            const subjectCode = cls.subject.split(' ')[0];

                            if (
                              (userSubjects.length === 0 ||
                                userSubjects.includes(subjectCode)) &&
                              (Object.keys(userGroups).length === 0 ||
                                userGroups[subjectCode] === cls.group ||
                                userGroups[subjectCode] === 0)
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

                      await this.mailingService.sendEmail(
                        mail.email,
                        subject,
                        classMail(unsubscribeLink(mail.hash)),
                      ).then(
                        () => sent.class++,
                        (e) => {
                          sent.failed++;
                          this.logger.error(`Mail to ${mail.email} failed: ${e.message}`);
                        },
                      );
                    }
                  }

                  const pushChangeLines = compareTimetablesForPush(oldTimetableData, newTimetableData);
                  await this.pushService.notifyClass(
                    classItem.id,
                    classItem.name,
                    pushChangeLines,
                  );

                  const involvedProfessors = new Set<string>();
                  const oldClassesMap = new Map<string, any>();

                  oldTimetableData.days.forEach(
                    (day: any, dayIndex: number) => {
                      day.classes.forEach((cls: any) => {
                        const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
                        oldClassesMap.set(key, cls);
                      });
                    },
                  );

                  newTimetableData.days.forEach(
                    (day: any, dayIndex: number) => {
                      day.classes.forEach((cls: any) => {
                        const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
                        const oldCls = oldClassesMap.get(key);

                        if (oldCls) {
                          const hasChanged =
                            oldCls.teacher !== cls.teacher ||
                            oldCls.classroom !== cls.classroom ||
                            oldCls.group !== cls.group;

                          if (hasChanged) {
                            if (oldCls.teacher)
                              involvedProfessors.add(oldCls.teacher);
                            if (cls.teacher)
                              involvedProfessors.add(cls.teacher);
                          }
                          oldClassesMap.delete(key);
                        } else {
                          if (cls.teacher) involvedProfessors.add(cls.teacher);
                        }
                      });
                    },
                  );

                  oldClassesMap.forEach((oldCls) => {
                    if (oldCls.teacher) involvedProfessors.add(oldCls.teacher);
                  });

                  for (const profName of involvedProfessors) {
                    const profChangeDetailsHtml = compareTimetablesForProfessor(
                      oldTimetableData,
                      newTimetableData,
                      profName,
                    );

                    if (!profChangeDetailsHtml) {
                      continue;
                    }

                    const profRecord = await em.findOne(Professor, {
                      name: { $like: `%${profName}%` },
                    });

                    if (profRecord) {
                      const profEmails =
                        await this.mailingService.getEmailsByProfessor(
                          profRecord.id,
                        );
                      const profSubject = `Sprememba urnika: ${profName} (teden ${week.label})`;

                      for (const profMail of profEmails) {
                        await this.mailingService.sendEmail(
                          profMail.email,
                          profSubject,
                          renderMail({
                            title: `Sprememba urnika za ${profName}`,
                            content: `<p style="margin:0 0 16px 0;">Urnik razreda <strong>${classItem.name}</strong> za teden <strong>${week.label}</strong> se je spremenil:</p>${changesBox(profChangeDetailsHtml)}`,
                            unsubscribeLink: unsubscribeLink(profMail.hash),
                          }),
                        ).then(
                          () => sent.prof++,
                          (e) => {
                            sent.failed++;
                            this.logger.error(`Mail to ${profMail.email} failed: ${e.message}`);
                          },
                        );
                      }

                      const profPushChangeLines = compareTimetablesForProfessorPush(
                        oldTimetableData,
                        newTimetableData,
                        profName,
                      );
                      await this.pushService.notifyProfessor(
                        profRecord.id,
                        profName,
                        profPushChangeLines,
                      );
                    }
                  }

                  if (process.env.ADMIN_MAIL) {
                    const summary = `<p style="margin:16px 0 0 0;font-size:14px;color:#BBBBBB;">Poslanih obvestil: <strong>${sent.class + sent.prof}</strong> (naročniki razreda: ${sent.class}, naročniki predavateljev: ${sent.prof})${sent.failed ? `, neuspešnih: <strong>${sent.failed}</strong>` : ''}.</p>`;
                    await this.mailingService
                      .sendEmail(process.env.ADMIN_MAIL, subject, classMail(null, summary))
                      .catch((e) => this.logger.error(`Admin mail failed: ${e.message}`));
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
              // @ts-ignore
              `Failed to check/update timetable for class ${classItem.name} (ID: ${classItem.id}) for week ${week.id}: ${error.message}`,
            );
          }
        }
      }
    }
  }
}
