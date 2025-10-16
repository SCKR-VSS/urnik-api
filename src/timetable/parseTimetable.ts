import * as cheerio from 'cheerio';

function extractClassName($: cheerio.CheerioAPI): string {
  const bigFont = $('font[size="7"][color="#0000FF"]');
  return bigFont ? bigFont.text().trim() : '';
}

function isDayCell(cell: any, $: cheerio.CheerioAPI): boolean {
  const boldFont = $(cell).find('font[size="4"] b');
  if (!boldFont.length) return false;
  const text = boldFont.text();
  return /Ponedeljek|Torek|Sreda|Četrtek|Petek/.test(text);
}

function extractClassInfo(
  cell: any,
  $: cheerio.CheerioAPI,
  day: string,
  columnPosition: number,
) {
  const $cell = $(cell);
  const bgcolor = $cell.attr('bgcolor');
  const innerTable = $cell.find('table');

  if (!bgcolor || !innerTable.length || !day) {
    return null;
  }

  const slotNum = Math.floor((columnPosition - 1) / 2) + 1;
  const colspan = parseInt($cell.attr('colspan') || '1', 10);

  const classInfo = {
    slot: slotNum,
    subject: '',
    teacher: '',
    classroom: '',
    note: '',
    specialNote: '',
    group: null as number | null,
    duration: colspan / 2,
    color: bgcolor,
    day,
  };

  const innerRows = innerTable.find('tr').toArray();

  if (innerRows[0]) {
    $(innerRows[0])
      .find('td')
      .each((_, td) => {
        const font = $(td).find('font[size="2"]');
        if (font.length) {
          const text = font.text().trim();
          if (text.includes('Skupina')) {
            classInfo.note = text;
            const match = text.match(/Skupina\s+(\d+)/i);
            if (match) classInfo.group = parseInt(match[1], 10);
          } else if (!classInfo.teacher) {
            classInfo.teacher = text;
          }
        }
      });
  }

  if (innerRows[1]) {
    $(innerRows[1])
      .find('td')
      .each((_, td) => {
        const boldSubject = $(td).find('font[size="3"] b');
        if (boldSubject.length) {
          classInfo.subject = boldSubject.text().trim();
        }

        $(td)
          .find('font[size="2"]')
          .each((_, font) => {
            const text = $(font).text().trim();
            if (text.match(/^\d+$/)) {
              classInfo.classroom = text;
            } else if (text && !text.includes('Skupina')) {
              if (!classInfo.specialNote) {
                classInfo.specialNote = text;
              } else {
                classInfo.specialNote += ', ' + text;
              }
            }
          });
      });
  }

  return classInfo.subject ? classInfo : null;
}

interface TimetableResult {
  className: string;
  weekLabel: string;
  days: { day: string; classes: any[]; note: string | null }[];
}

export function parseTimetable(
  html: string,
  week: string,
): TimetableResult {
  const $ = cheerio.load(html);

  const result: TimetableResult = {
    className: extractClassName($),
    weekLabel: week,
    days: [],
  };

  const table = $('table[border="3"]');
  if (!table.length) return result;

  const rows = table.find('tr').toArray();
  const grid: any[][] = [];
  const MAX_COLS = 34;
  const dayData = new Map<
    string,
    { day: string; classes: any[]; note: string | null }
  >();
  let currentDay: string | null = null;

  rows.forEach((row, rowIdx) => {
    const cells = $(row).children('td').toArray();
    if (cells.length === 0) return;

    if (!grid[rowIdx]) grid[rowIdx] = [];

    const dayCell = cells.find((cell) => isDayCell(cell, $));
    if (dayCell) {
      const dayName = $(dayCell).find('font[size="4"] b').text().trim();
      currentDay = dayName;
      if (!dayData.has(dayName)) {
        dayData.set(dayName, { day: dayName, classes: [], note: null });
      }

      const noteCell = cells.find((c) => {
        const font = $(c).find('font[size="3"]');
        return (
          font &&
          (font.text().includes('Pred začet') ||
            font.text().includes('šol.leta') ||
            font.text().includes('Pouk po urniku'))
        );
      });
      if (noteCell) {
        const dayInfo = dayData.get(dayName);
        if (dayInfo) {
          dayInfo.note = $(noteCell).find('font[size="3"]').text().trim();
        }
      }
    }

    let columnPosition = 0;
    cells.forEach((cell) => {
      while (
        grid[rowIdx][columnPosition] !== undefined &&
        columnPosition < MAX_COLS
      ) {
        columnPosition++;
      }

      const $cell = $(cell);
      const colspan = parseInt($cell.attr('colspan') || '1', 10);
      const rowspan = parseInt($cell.attr('rowspan') || '1', 10);

      for (let r = 0; r < rowspan; r++) {
        if (!grid[rowIdx + r]) grid[rowIdx + r] = [];
        for (let c = 0; c < colspan; c++) {
          if (columnPosition + c < MAX_COLS) {
            grid[rowIdx + r][columnPosition + c] = { cell };
          }
        }
      }

      if (currentDay) {
        const classInfo = extractClassInfo(cell, $, currentDay, columnPosition);
        if (classInfo) {
          const dayInfo = dayData.get(currentDay);
          if (dayInfo && !dayInfo.note) {
            dayInfo.classes.push(classInfo);
          }
        }
      }

      columnPosition += colspan;
    });
  });

  dayData.forEach((dayInfo) => {
    dayInfo.classes.sort((a, b) => a.slot - b.slot);
    result.days.push(dayInfo);
  });

  return result;
}
