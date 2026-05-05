import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomBytes, createHash } from 'crypto';
import slots from 'src/constants/slots';
import * as ics from 'ics';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const generateIcs: (title: string, events: ics.EventAttributes[], feedUrl?: string) => string = require('ics-service/generate-ics');

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private filterDayClasses(
    days: any[],
    subjects?: string[],
    groups?: { [subject: string]: number },
  ) {
    if ((!subjects || subjects.length === 0) && !groups) {
      return days;
    }

    return days.map((day: any) => ({
      ...day,
      classes: day.classes.filter((cls: any) => {
        const subjectMatch =
          !subjects ||
          subjects.length === 0 ||
          subjects.some((subject) => cls.subject.startsWith(subject));

        let groupMatch = true;
        if (groups && cls.group !== null && groups[cls.subject] !== undefined) {
          groupMatch = groups[cls.subject] === cls.group;
        }

        return subjectMatch && groupMatch;
      }),
    }));
  }

  private createEventUid(
    classId: string,
    year: number,
    month: number,
    dayOfMonth: number,
    cls: any,
  ) {
    return createHash('md5')
      .update(
        [
          classId,
          year,
          month,
          dayOfMonth,
          cls.slot,
          cls.duration,
          cls.subject,
          cls.classroom ?? '',
          cls.teacher ?? '',
          cls.group ?? '',
        ].join('|'),
      )
      .digest('hex');
  }

  private buildFeedEvents(
    weeks: Array<{ timetableData: any; year: number }>,
    classId: string,
    subjects?: string[],
    groups?: { [subject: string]: number },
  ): ics.EventAttributes[] {
    const events: ics.EventAttributes[] = [];

    for (const { timetableData, year } of weeks) {
      const daysToProcess = this.filterDayClasses(
        timetableData.days,
        subjects,
        groups,
      );

      for (const day of daysToProcess) {
        for (const cls of day.classes) {
          const dateParts = day.day.match(/(\d{1,2})\.(\d{1,2})\.?/);
          if (!dateParts) continue;

          const dayOfMonth = parseInt(dateParts[1], 10);
          const month = parseInt(dateParts[2], 10);

          const startSlotTime = slots[cls.slot]?.split(' ')[0];
          const endSlotTime = slots[cls.slot + cls.duration - 1]?.split(' ')[1];
          if (!startSlotTime || !endSlotTime) continue;

          const [startHour, startMinute] = startSlotTime.split(':').map(Number);
          const [endHour, endMinute] = endSlotTime.split(':').map(Number);
          const durationMinutes =
            endHour * 60 + endMinute - (startHour * 60 + startMinute);

          events.push({
            uid: this.createEventUid(classId, year, month, dayOfMonth, cls),
            start: [year, month, dayOfMonth, startHour, startMinute],
            duration: {
              hours: Math.floor(durationMinutes / 60),
              minutes: durationMinutes % 60,
            },
            title: cls.subject,
            description: `Profesor: ${cls.teacher}${cls.group ? `\nSkupina ${cls.group}` : ''}`,
            location: cls.classroom ? `Uč. ${cls.classroom}` : undefined,
            startOutputType: 'local',
          });
        }
      }
    }

    return events;
  }

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

  async createFeed(
    classId: string,
    feedUrl: string,
    subjects?: string[],
    groups?: { [subject: string]: number },
  ): Promise<string | { error: string }> {
    const classNum = parseInt(classId);

    if (isNaN(classNum) || classNum < 1) {
      return { error: 'Invalid classId parameter' };
    }

    const classRecord = await this.prisma.class.findUnique({
      where: { id: classNum },
    });

    if (!classRecord) {
      return { error: 'Class not found' };
    }

    const timetables = await this.prisma.timetable.findMany({
      where: { class: { id: classNum } },
      include: { week: true },
    });

    if (!timetables.length) {
      return { error: 'No timetables found for this class' };
    }

    // Prefer current and upcoming weeks. If that window is empty, or filters
    // remove every class from it, fall back to the latest older weeks that
    // still contain matching classes so subscribed calendars never go blank.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    cutoff.setHours(0, 0, 0, 0);

    interface ParsedTimetable {
      timetableData: any;
      weekStart: Date;
      year: number;
    }

    const parsed: ParsedTimetable[] = [];
    for (const timetable of timetables) {
      const timetableData = JSON.parse(timetable.data as string);
      const weekLabel: string = timetableData.weekLabel;
      const wParts = weekLabel.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (!wParts) continue;
      const weekStart = new Date(
        parseInt(wParts[3]),
        parseInt(wParts[2]) - 1,
        parseInt(wParts[1]),
      );
      parsed.push({ timetableData, weekStart, year: parseInt(wParts[3]) });
    }

    if (parsed.length === 0) {
      return { error: 'No valid timetables found for this class' };
    }

    const sorted = [...parsed].sort(
      (a, b) => b.weekStart.getTime() - a.weekStart.getTime(),
    );
    const currentAndUpcoming = sorted.filter((entry) => entry.weekStart >= cutoff);
    const primaryWeeks =
      currentAndUpcoming.length > 0 ? currentAndUpcoming : sorted.slice(0, 4);

    let icsEvents = this.buildFeedEvents(primaryWeeks, classId, subjects, groups);

    if (icsEvents.length === 0) {
      const fallbackEvents: ics.EventAttributes[] = [];
      let includedWeeks = 0;

      for (const entry of sorted) {
        const weekEvents = this.buildFeedEvents(
          [entry],
          classId,
          subjects,
          groups,
        );

        if (weekEvents.length === 0) {
          continue;
        }

        fallbackEvents.push(...weekEvents);
        includedWeeks += 1;

        if (includedWeeks === 4) {
          break;
        }
      }

      icsEvents = fallbackEvents;
    }

    try {
      return generateIcs(`Urnik - ${classRecord.name}`, icsEvents, feedUrl);
    } catch {
      return { error: 'Error generating ICS feed' };
    }
  }
}
