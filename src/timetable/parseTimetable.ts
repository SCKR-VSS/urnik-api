import { JSDOM } from 'jsdom';

export interface ClassInfo {
  slot: number;
  subject: string;
  teacher: string;
  classroom: string;
  note: string;
  specialNote: string;
  group: number | null;
  duration: number;
  color: string;
  dayName: string;
}

export interface DaySchedule {
  day: string;
  classes: ClassInfo[];
  note: string | null;
}

export interface TimetableResult {
  className: string;
  weekLabel: string;
  days: DaySchedule[];
}

type CommonClassData = Pick<
  ClassInfo,
  'slot' | 'duration' | 'color' | 'dayName'
>;

interface GridCellRef {
  cell: Element;
  rowIdx: number;
  columnPosition: number;
  colspan: number;
  rowspan: number;
}

export class TimetableParser {
  public getTeachers(html: string): string[] {
    const dom = new JSDOM(html);
    const { document } = dom.window;

    const scripts = Array.from(document.querySelectorAll('script')) as any[];
    const teachers: string[] = [];

    const teacherRegex = /var teachers = (\[.*?\]);/s;

    for (const script of scripts) {
      const scriptContent = script.textContent;
      if (scriptContent) {
        const match = scriptContent.match(teacherRegex);

        if (match && match[1]) {
          try {
            const teacherArray = JSON.parse(match[1]);
            if (Array.isArray(teacherArray)) {
              teachers.push(...teacherArray);
              break;
            }
          } catch (e) {
            console.error('Failed to parse teachers array:', e);
          }
        }
      }
    }

    return teachers;
  }

  public getClasses(html: string): { id: number; name: string }[] {
    const dom = new JSDOM(html);
    const { document } = dom.window;

    const scripts = Array.from(document.querySelectorAll('script')) as any[];
    const classes: { id: number; name: string }[] = [];

    const classRegex = /var classes = (\[.*?\]);/s;

    for (const script of scripts) {
      const scriptContent = script.textContent;
      if (scriptContent) {
        const match = scriptContent.match(classRegex);

        if (match && match[1]) {
          try {
            const classArray = JSON.parse(match[1]);
            if (Array.isArray(classArray)) {
              classArray.forEach((className: string, index: number) => {
                classes.push({ id: index + 1, name: className });
              });
              break;
            }
          } catch (e) {
            console.error('Failed to parse classes array:', e);
          }
        }
      }
    }

    return classes;
  }

  public getWeeks(html: string): { id: number; label: string }[] {
    const dom = new JSDOM(html);
    const { document } = dom.window;

    const weekSelect = document.querySelector<HTMLSelectElement>(
      'select[name="week"]',
    );
    const weeks: { id: number; label: string }[] = [];

    if (weekSelect) {
      const options = Array.from(
        weekSelect.querySelectorAll('option'),
      ) as HTMLOptionElement[];
      for (const option of options) {
        const id = parseInt(option.value, 10);
        const label = option.textContent?.trim() || '';
        if (!isNaN(id)) {
          weeks.push({ id, label });
        }
      }
    }

    return weeks;
  }

  public parse(html: string, weekLabel: string): TimetableResult {
    const dom = new JSDOM(html);
    const { document } = dom.window;

    const result: TimetableResult = {
      className: this.extractClassName(document) || '',
      weekLabel: weekLabel,
      days: [],
    };

    const table = document.querySelector<HTMLTableElement>('table[border="3"]');
    if (!table) return result;

    const rows = Array.from(table.rows);

    const grid: (GridCellRef | undefined)[][] = [];
    const MAX_COLS = 34;

    const dayClassCellsByColspan = new Map<string, Map<number, number[]>>();

    const resolveStartColumn = (
      dayName: string,
      span: number,
      desiredPosition: number,
      dayStartRow: number,
      rowIndex: number,
    ): number | null => {
      const candidates: number[] = [];

      const dayColspanMap = dayClassCellsByColspan.get(dayName);
      if (dayColspanMap) {
        const stored = dayColspanMap.get(span);
        if (stored?.length) {
          candidates.push(...stored);
        }
      }

      for (let prev = rowIndex - 1; prev >= dayStartRow && prev >= 0; prev--) {
        const prevRow = grid[prev];
        if (!prevRow) continue;
        for (let col = 1; col < MAX_COLS; col++) {
          const ref = prevRow[col];
          if (ref && ref.colspan === span) {
            candidates.push(ref.columnPosition);
          }
        }
      }

      if (!candidates.length) return null;

      const uniqueSorted = Array.from(new Set(candidates)).sort(
        (a, b) => a - b,
      );

      const currentRow = grid[rowIndex] || [];
      const availableCandidates = uniqueSorted.filter((pos) => {
        for (let c = 0; c < span; c++) {
          if (currentRow[pos + c] !== undefined) {
            return false;
          }
        }
        return true;
      });

      if (!availableCandidates.length) return null;

      const target = availableCandidates.find((pos) => pos >= desiredPosition);
      return target !== undefined
        ? target
        : availableCandidates[availableCandidates.length - 1];
    };

    let currentDay: string | null = null;
    let currentDayStartRow = -1;
    const dayData = new Map<string, DaySchedule>();

    rows.forEach((row: any, rowIdx) => {
      const cells = Array.from(row.children).filter(
        (el: any): el is HTMLTableCellElement => el.tagName === 'TD',
      );
      if (cells.length === 0) return;

      if (!grid[rowIdx]) grid[rowIdx] = [];

      const dayCell = cells.find((cell) => this.isDayCell(cell));
      if (dayCell) {
        const boldFont = dayCell.querySelector('font[size="4"] b');
        const dayName = boldFont?.textContent?.trim() ?? '';

        const noteCell = cells.find((c) => {
          const font = c.querySelector('font[size="3"]');
          return font?.textContent?.match(/Pred začet|šol\.leta/);
        });

        if (!dayData.has(dayName) && dayName) {
          if (noteCell) {
            const font = noteCell.querySelector('font[size="3"]');
            dayData.set(dayName, {
              day: dayName,
              classes: [],
              note: font?.textContent?.trim() ?? null,
            });
            currentDay = null;
          } else {
            currentDay = dayName;
            currentDayStartRow = rowIdx;
            dayClassCellsByColspan.set(dayName, new Map());
            dayData.set(dayName, { day: dayName, classes: [], note: null });
          }
        }
      }

      if (!currentDay) return;

      let columnPosition = 0;
      for (const cell of cells) {
        if (!grid[rowIdx]) {
          grid[rowIdx] = [];
        }

        while (
          grid[rowIdx][columnPosition] !== undefined &&
          columnPosition < MAX_COLS
        ) {
          columnPosition++;
        }

        const colspan = parseInt(cell.getAttribute('colspan') || '1');
        const rowspan = parseInt(cell.getAttribute('rowspan') || '1');

        let cellStartColumn = columnPosition;

        const isClassCell =
          cell.getAttribute('bgcolor') && cell.querySelector('table');

        if (isClassCell && currentDay && cellStartColumn === 0) {
          const fallbackColumn = resolveStartColumn(
            currentDay,
            colspan,
            columnPosition,
            currentDayStartRow,
            rowIdx,
          );
          if (typeof fallbackColumn === 'number' && fallbackColumn >= 0) {
            cellStartColumn = fallbackColumn;
          }
        }

        if (rowIdx === currentDayStartRow && currentDay && isClassCell) {
          const dayColspanMap = dayClassCellsByColspan.get(currentDay);
          if (dayColspanMap) {
            let stored = dayColspanMap.get(colspan);
            if (!stored) {
              stored = [];
              dayColspanMap.set(colspan, stored);
            }
            if (!stored.includes(cellStartColumn)) {
              stored.push(cellStartColumn);
              stored.sort((a, b) => a - b);
            }
          }
        }

        for (let r = 0; r < rowspan; r++) {
          if (!grid[rowIdx + r]) grid[rowIdx + r] = [];
          for (let c = 0; c < colspan; c++) {
            if (cellStartColumn + c < MAX_COLS) {
              grid[rowIdx + r][cellStartColumn + c] = {
                cell,
                rowIdx,
                columnPosition: cellStartColumn,
                colspan,
                rowspan,
              };
            }
          }
        }

        const classInfo = this.extractClassesFromCell(
          cell,
          currentDay,
          cellStartColumn,
          this.extractClassName(document),
        );
        if (classInfo) {
          const daySchedule = dayData.get(currentDay);
          if (daySchedule) {
            daySchedule.classes.push(...classInfo);
          }
        }

        columnPosition = cellStartColumn + colspan;
      }
    });

    dayData.forEach((dayInfo) => {
      if (dayInfo.note === null) {
        dayInfo.classes.sort((a, b) => a.slot - b.slot);
        result.days.push(dayInfo);
      } else if (dayInfo.classes.length === 0 && dayInfo.note) {
        result.days.push(dayInfo);
      }
    });

    return result;
  }

  private extractClassName(doc: Document): string {
    const bigFont = doc.querySelector('font[size="7"][color="#0000FF"]');
    return bigFont?.textContent?.trim() ?? '';
  }

  private isDayCell(cell: Element): boolean {
    const boldFont = cell.querySelector('font[size="4"] b');
    if (!boldFont?.textContent) return false;
    return /Ponedeljek|Torek|Sreda|Četrtek|Petek/.test(boldFont.textContent);
  }

  private extractClassesFromCell(
    cell: Element,
    currentDay: string | null,
    cellStartColumn: number,
    className: string,
  ): ClassInfo[] {
    const bgcolor = cell.getAttribute('bgcolor');
    const innerTable = cell.querySelector('table');
    if (!bgcolor || !innerTable || !currentDay) return [];

    let slotNum: number;
    if (cellStartColumn <= 0) {
      slotNum = 2;
    } else {
      if (cellStartColumn == 2) slotNum = 2;
      else slotNum = Math.floor((cellStartColumn - 1) / 2) + 1;
    }

    const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);

    const commonData: CommonClassData = {
      slot: slotNum,
      duration: colspan / 2,
      color: bgcolor,
      dayName: currentDay,
    };

    const classes: ClassInfo[] = [];
    const innerRows = Array.from(innerTable.querySelectorAll('tr'));
    let classBlockRows: HTMLTableRowElement[] = [];

    for (const row of innerRows) {
      if (row.querySelector('hr')) {
        if (classBlockRows.length > 0) {
          const classInfo = this.parseClassBlock(
            classBlockRows,
            commonData,
            className,
          );
          if (classInfo) classes.push(classInfo);
        }
        classBlockRows = [];
      } else {
        classBlockRows.push(row);
      }
    }

    if (classBlockRows.length > 0) {
      const classInfo = this.parseClassBlock(
        classBlockRows,
        commonData,
        className,
      );
      if (classInfo) classes.push(classInfo);
    }

    return classes;
  }

  private parseClassBlock(
    rows: HTMLTableRowElement[],
    commonData: CommonClassData,
    className: string,
  ): ClassInfo | null {
    if (rows.length === 0) return null;

    const classInfo: ClassInfo = {
      ...commonData,
      subject: '',
      teacher: '',
      classroom: '',
      note: '',
      specialNote: '',
      group: null,
    };

    const row1 = rows[0];
    row1.querySelectorAll('td').forEach((cell) => {
      let text = cell.querySelector('font[size="2"]')?.textContent?.trim();

      if (!text) {
        text = cell.textContent?.trim();
      }

      if (text) {
        if (text.toLowerCase().includes('skupina')) {
          classInfo.note = text;
          const match = text.match(/Skupina\s+(\d+)/i);
          if (match) classInfo.group = parseInt(match[1], 10);
        } else if (!classInfo.teacher) {
          classInfo.teacher = text;
        }
      }
    });

    if (rows.length > 1) {
      const row2 = rows[1];
      const boldSubject = row2.querySelector('font[size="3"] b');
      if (boldSubject)
        classInfo.subject = boldSubject.textContent?.trim() ?? '';

      row2.querySelectorAll('font[size="2"]').forEach((font) => {
        const text = font.textContent?.trim() ?? '';
        if (text.match(/^\d+$/)) {
          classInfo.classroom = text;
        } else if (text && !text.includes('Skupina')) {
          if (!classInfo.specialNote) {
            classInfo.specialNote = className.startsWith('EKN') ? '' : text;
            if (className.startsWith('EKN')) {
              classInfo.classroom = text;
            }
          } else {
            classInfo.specialNote += `, ${text}`;
          }
        }
      });
    }

    return classInfo.subject ? classInfo : null;
  }
}
