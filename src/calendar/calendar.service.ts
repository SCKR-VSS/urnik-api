import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomBytes } from 'crypto';
import slots from 'src/constants/slots';
import * as ics from 'ics';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (!timeTable) {
      return {
        error: 'Timetable not found for the specified week and classId',
      };
    }

    const timetableData = JSON.parse(timeTable.data as string);

    // Extract year from weekLabel (format: "dd.mm.yyyy")
    const year = new Date(
      timetableData.weekLabel.split('.').reverse().join('-'),
    ).getFullYear();

    // Get days to process - apply filtering if options provided
    let daysToProcess = timetableData.days;

    if (options?.groups || options?.subjects) {
      const userGroups = options.groups;
      const userSubjects = options.subjects;

      daysToProcess = timetableData.days.map((day: any) => {
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
    }

    const icsEvents: ics.EventAttributes[] = [];

    for (const day of daysToProcess) {
      for (const cls of day.classes) {
        const dateParts = day.day.match(/(\d{1,2})\.(\d{1,2})\.?/);
        if (!dateParts) continue;

        const dayOfMonth = parseInt(dateParts[1], 10);
        const month = parseInt(dateParts[2], 10);

        const startSlotTime = slots[cls.slot]?.split(' ')[0];
        const endSlotTime = slots[cls.slot + cls.duration - 1]?.split(' ')[1];
        if (!startSlotTime || !endSlotTime) continue;

        // Parse time strings (format: "H:MM" or "HH:MM")
        const [startHour, startMinute] = startSlotTime.split(':').map(Number);
        const [endHour, endMinute] = endSlotTime.split(':').map(Number);

        // Calculate duration in minutes
        const durationMinutes =
          (endHour * 60 + endMinute) - (startHour * 60 + startMinute);

        const uid = randomBytes(16).toString('hex');
        const description = `Profesor: ${cls.teacher}${cls.group ? `\nSkupina ${cls.group}` : ''}`;

        const event: ics.EventAttributes = {
          start: [year, month, dayOfMonth, startHour, startMinute],
          duration: {
            hours: Math.floor(durationMinutes / 60),
            minutes: durationMinutes % 60,
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
    }

    return value as string;
  }
}
