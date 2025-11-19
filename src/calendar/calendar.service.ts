import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomBytes } from 'crypto';
import slots from 'src/constants/slots';
import * as ics from 'ics';

const formatIcsDate = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0];
};

const escapeIcsText = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
};

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) { }

  async createCalendar(
    week: number,
    classId: string,
    options?: { groups: { [key: string]: number }[]; subjects?: string[] },
  ): Promise<string | { error: string }> {
    const classNum = parseInt(classId);

    if (
      isNaN(week) ||
      isNaN(classNum) ||
      week < 1 ||
      week > 53 ||
      classNum < 1
    ) {
      return { error: 'Invalid week or classId parameter' };
    }

    const timeTable = await this.prisma.timetable.findFirst({
      where: {
        week: { id: week },
        class: { id: classNum },
      },
    });

    if (timeTable) {
      const timetableData = JSON.parse(timeTable.data as string);

      const year = new Date(
        timetableData.weekLabel.split('.').reverse().join('-'),
      ).getFullYear();

      if (!options || (!options.groups && !options.subjects)) {
        const icsEvents: any[] = [];

        for (const day of timetableData) {
          for (const cls of day.classes) {
            const dateParts = day.day.match(/(\d{1,2})\.(\d{1,2})\.?/);
            if (!dateParts) continue;

            const dayOfMonth = parseInt(dateParts[1], 10);
            const month = parseInt(dateParts[2], 10);

            const startSlotTime = slots[cls.slot]?.split(' ')[0];
            const endSlotTime = slots[cls.slot + cls.duration - 1]?.split(' ')[1];
            if (!startSlotTime || !endSlotTime) continue;

            const formatTime = (time: string) => time.padStart(5, '0');
            const startDateTime = new Date(
              `${year}-${month}-${dayOfMonth}T${formatTime(startSlotTime)}`,
            );
            const endDateTime = new Date(
              `${year}-${month}-${dayOfMonth}T${formatTime(endSlotTime)}`,
            );

            if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
              continue;
            }

            const uid = randomBytes(16).toString('hex');
            const description = `Profesor: ${cls.teacher}${cls.group ? `\\nSkupina ${cls.group}` : ''}`;

            const event: ics.EventAttributes = {
              start: [
                startDateTime.getFullYear(),
                startDateTime.getMonth() + 1,
                startDateTime.getDate(),
                startDateTime.getHours(),
                startDateTime.getMinutes(),
              ],
              duration: {
                hours: Math.floor(
                  (endDateTime.getTime() - startDateTime.getTime()) / 3600000,
                ),
                minutes:
                  ((endDateTime.getTime() - startDateTime.getTime()) % 3600000) /
                  60000,
              },
              title: cls.subject,
              description: description,
              location: `Uč. ${cls.classroom}`,
              uid: uid,
            };

            icsEvents.push(event);
          }
        }

        const { error, value } = ics.createEvents(icsEvents);
        if (error) {
          return { error: 'Error generating ICS file' };
        } else {
          return value as string;
        }
      }

      const userGroups = options.groups;
      const userSubjects = options.subjects;

      const filteredDays = timetableData.days.map((day: any) => {
        const filteredClasses = day.classes.filter((cls: any) => {
          const subjectMatch =
            !userSubjects ||
            userSubjects.length === 0 ||
            userSubjects.some((userSub) => cls.subject.startsWith(userSub));

          let groupMatch = true;
          if (userGroups) {
            if (cls.group === null) {
              groupMatch = true;
            } else if (userGroups[cls.subject] === undefined) {
              groupMatch = true;
            } else {
              groupMatch = userGroups[cls.subject] === cls.group;
            }
          }

          return subjectMatch && groupMatch;
        });

        return { ...day, classes: filteredClasses };
      });

      const icsEvents: any[] = [];

      for (const day of filteredDays) {
        for (const cls of day.classes) {
          const dateParts = day.day.match(/(\d{1,2})\.(\d{1,2})\.?/);
          if (!dateParts) continue;

          const dayOfMonth = parseInt(dateParts[1], 10);
          const month = parseInt(dateParts[2], 10);

          const startSlotTime = slots[cls.slot]?.split(' ')[0];
          const endSlotTime = slots[cls.slot + cls.duration - 1]?.split(' ')[1];
          if (!startSlotTime || !endSlotTime) continue;

          const formatTime = (time: string) => time.padStart(5, '0');
          const startDateTime = new Date(
            `${year}-${month}-${dayOfMonth}T${formatTime(startSlotTime)}`,
          );
          const endDateTime = new Date(
            `${year}-${month}-${dayOfMonth}T${formatTime(endSlotTime)}`,
          );

          if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            continue;
          }

          const uid = randomBytes(16).toString('hex');
          const description = `Profesor: ${cls.teacher}${cls.group ? ` Skupina ${cls.group}` : ''}`;

          const event: ics.EventAttributes = {
            start: [
              startDateTime.getFullYear(),
              startDateTime.getMonth() + 1,
              startDateTime.getDate(),
              startDateTime.getHours(),
              startDateTime.getMinutes(),
            ],
            duration: {
              hours: Math.floor(
                (endDateTime.getTime() - startDateTime.getTime()) / 3600000,
              ),
              minutes:
                ((endDateTime.getTime() - startDateTime.getTime()) % 3600000) /
                60000,
            },
            title: cls.subject,
            description: description,
            location: `Uč. ${cls.classroom}`,
            uid: uid,
            startOutputType: 'local',
          };

          icsEvents.push(event);
        }
      }

      const { error, value } = ics.createEvents(icsEvents);
      if (error) {
        return { error: 'Error generating ICS file' };
      } else {
        return value as string;
      }
    } else {
      return {
        error: 'Timetable not found for the specified week and classId',
      };
    }
  }
}
