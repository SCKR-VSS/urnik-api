/// <reference types="jest" />

jest.mock('ics-service/generate-ics', () =>
  jest.fn((title: string, events: unknown[], feedUrl?: string) =>
    JSON.stringify({ title, feedUrl, events }),
  ),
);

import { CalendarService } from './calendar.service';

const generateIcs = require('ics-service/generate-ics') as jest.Mock;

function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
}

function createTimetable(date: Date, classes: any[]) {
  const weekLabel = formatDate(date);
  const dayLabel = `Ponedeljek ${String(date.getDate()).padStart(2, '0')}.${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}.`;

  return {
    data: JSON.stringify({
      weekLabel,
      days: [
        {
          day: dayLabel,
          classes,
        },
      ],
    }),
  };
}

function createTimetableWithWeekLabel(weekLabel: string, date: Date, classes: any[]) {
  const dayLabel = `Ponedeljek ${String(date.getDate()).padStart(2, '0')}.${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}.`;

  return {
    data: JSON.stringify({
      weekLabel,
      days: [
        {
          day: dayLabel,
          classes,
        },
      ],
    }),
  };
}

describe('CalendarService.createFeed', () => {
  let prisma: {
    class: { findUnique: jest.Mock };
    timetable: { findMany: jest.Mock };
  };
  let service: CalendarService;

  beforeEach(() => {
    prisma = {
      class: { findUnique: jest.fn().mockResolvedValue({ id: 2, name: 'RAI 2.l' }) },
      timetable: { findMany: jest.fn() },
    };
    service = new CalendarService(prisma as any);
    generateIcs.mockClear();
  });

  it('falls back to older weeks when no week passes the recent cutoff', async () => {
    prisma.timetable.findMany.mockResolvedValue([
      createTimetable(new Date('2025-01-06T00:00:00.000Z'), [
        {
          subject: 'MAT',
          teacher: 'Test Teacher',
          group: 1,
          slot: 1,
          duration: 1,
          classroom: '12',
        },
      ]),
    ]);

    const result = await service.createFeed('2', 'http://example.com/calendar/feed/2');

    expect(typeof result).toBe('string');
    expect(generateIcs).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(result as string);
    expect(payload.events).toHaveLength(1);
    expect(payload.events[0].title).toBe('MAT');
  });

  it('parses week labels even when they contain extra text', async () => {
    prisma.timetable.findMany.mockResolvedValue([
      createTimetableWithWeekLabel('Teden 06.01.2025 - redni', new Date('2025-01-06T00:00:00.000Z'), [
        {
          subject: 'RPT',
          teacher: 'Test Teacher',
          group: 1,
          slot: 1,
          duration: 1,
          classroom: '12',
        },
      ]),
    ]);

    const result = await service.createFeed('2', 'https://example.com/calendar/feed/2');
    const payload = JSON.parse(result as string);

    expect(payload.events).toHaveLength(1);
    expect(payload.events[0].title).toBe('RPT');
  });

  it('falls back to the latest older weeks that still match filters', async () => {
    const currentWeek = new Date();
    const oldMatchingWeek = new Date('2025-02-03T00:00:00.000Z');

    prisma.timetable.findMany.mockResolvedValue([
      createTimetable(currentWeek, [
        {
          subject: 'BIO',
          teacher: 'Other Teacher',
          group: 2,
          slot: 1,
          duration: 1,
          classroom: '15',
        },
      ]),
      createTimetable(oldMatchingWeek, [
        {
          subject: 'MAT',
          teacher: 'Match Teacher',
          group: 1,
          slot: 1,
          duration: 1,
          classroom: '15',
        },
      ]),
    ]);

    const result = await service.createFeed(
      '2',
      'http://example.com/calendar/feed/2',
      ['MAT'],
      { MAT: 1 },
    );

    const payload = JSON.parse(result as string);
    expect(payload.events).toHaveLength(1);
    expect(payload.events[0].title).toBe('MAT');
  });

  it('creates distinct stable uids for parallel lessons with different groups', async () => {
    prisma.timetable.findMany.mockResolvedValue([
      createTimetable(new Date(), [
        {
          subject: 'MAT',
          teacher: 'Teacher A',
          group: 1,
          slot: 1,
          duration: 1,
          classroom: '12',
        },
        {
          subject: 'MAT',
          teacher: 'Teacher B',
          group: 2,
          slot: 1,
          duration: 1,
          classroom: '12',
        },
      ]),
    ]);

    const result = await service.createFeed('2', 'http://example.com/calendar/feed/2');
    const payload = JSON.parse(result as string);

    expect(payload.events).toHaveLength(2);
    expect(payload.events[0].uid).not.toBe(payload.events[1].uid);

    const repeatedResult = await service.createFeed(
      '2',
      'http://example.com/calendar/feed/2',
    );
    const repeatedPayload = JSON.parse(repeatedResult as string);

    expect(repeatedPayload.events[0].uid).toBe(payload.events[0].uid);
    expect(repeatedPayload.events[1].uid).toBe(payload.events[1].uid);
  });
});