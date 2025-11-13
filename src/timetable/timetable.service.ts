import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from '@nestjs/cache-manager';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import { jsPDF } from 'jspdf';
import autoTable, { CellInput } from 'jspdf-autotable';
import * as fs from 'fs';
import slots from 'src/constants/slots';

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getTimetable(
    week: number,
    classId: string,
    options?: { groups: { [key: string]: number }[]; subjects?: string[] },
  ) {
    let bodyHash = '';
    if (options) {
      const bodyString = JSON.stringify(options);
      bodyHash = crypto.createHash('md5').update(bodyString).digest('hex');
    }

    const key = `timetable_${week}_${classId}_${bodyHash || 'default'}`;
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

    const cachedData = await this.cacheManager.get(key);

    if (cachedData) {
      return cachedData;
    }

    const timeTable = await this.prisma.timetable.findFirst({
      where: {
        week: { id: week },
        class: { id: classNum },
      },
    });

    if (timeTable) {
      const timetableData = JSON.parse(timeTable.data as string);

      if (!options || (!options.groups && !options.subjects)) {
        await this.cacheManager.set(key, timetableData);
        return timetableData;
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
            }
            else if (userGroups[cls.subject] === undefined) {
              groupMatch = true;
            }
            else {
              groupMatch = userGroups[cls.subject] === cls.group;
            }
          }

          return subjectMatch && groupMatch;
        });

        return { ...day, classes: filteredClasses };
      });

      const filteredTimetable = {
        ...timetableData,
        days: filteredDays,
      };

      if (!filteredTimetable) throw new InternalServerErrorException();

      await this.cacheManager.set(key, filteredTimetable);

      return filteredTimetable;
    } else {
      throw new InternalServerErrorException();
    }
  }

  async getProfessor(week: number, professorId: string) {
    const key = `professor_${week}_${professorId}`;

    const profNum = parseInt(professorId);

    if (isNaN(week) || isNaN(profNum) || week < 1 || week > 53 || profNum < 1) {
      return { error: 'Invalid week or professorId parameter' };
    }

    const cachedData = await this.cacheManager.get(key);

    if (cachedData) {
      return cachedData;
    }

    const professor = await this.prisma.professor.findUnique({
      where: { id: profNum },
    });

    if (!professor) {
      return { error: 'Professor not found' };
    }

    const timetables = await this.prisma.timetable.findMany({
      where: {
        week: { id: week },
      },
    });

    const name = professor.name;

    const professorTimetables = timetables
      .map((timetable) => {
        const timetableData = JSON.parse(timetable.data as string);

        const filteredDays = timetableData.days.map((day: any) => {
          const filteredClasses = day.classes.filter((cls: any) => {
            if (!cls.teacher) {
              return false;
            }

            const profNameParts = name
              .toLowerCase()
              .split(' ')
              .filter((p) => p);
            const teacherNameParts = cls.teacher
              .toLowerCase()
              .split(' ')
              .filter((p) => p);

            return teacherNameParts.some((teacherPart) =>
              profNameParts.some((profPart) =>
                profPart.startsWith(teacherPart),
              ),
            );
          });

          return { ...day, classes: filteredClasses };
        });

        return {
          ...timetableData,
          days: filteredDays,
        };
      })
      .filter((timetable) =>
        timetable.days.some((day: any) => day.classes.length > 0),
      );

    await this.cacheManager.set(key, professorTimetables);

    return professorTimetables;
  }

  async getProfessorPdf(week: number, professorId: string): Promise<Buffer> {
    const professorTimetables = await this.getProfessor(week, professorId);

    if (
      !Array.isArray(professorTimetables) ||
      professorTimetables.length === 0
    ) {
      throw new Error(
        'No timetable data found for this professor for the selected week.',
      );
    }

    const professor = await this.prisma.professor.findUnique({
      where: { id: parseInt(professorId, 10) },
    });

    const allClasses = professorTimetables.flatMap((timetable) =>
      timetable.days.flatMap((day: any) =>
        day.classes.map((cls: any) => ({
          ...cls,
          day: day.day,
          className: timetable.className,
        })),
      ),
    );

    if (allClasses.length === 0) {
      throw new Error('No valid timetable entries found.');
    }

    const daysOfWeek = ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek'];
    const grid = Array.from({ length: 17 }, () => Array(5).fill(null));

    for (const cls of allClasses) {
      if (cls.day == null) continue;
      const dayIndex = daysOfWeek.findIndex((d) => cls.day.startsWith(d));
      if (dayIndex !== -1 && cls.slot >= 0 && cls.slot < 17) {
        grid[cls.slot][dayIndex] = cls;
        for (let i = 1; i < cls.duration; i++) {
          if (cls.slot + i < 17) {
            grid[cls.slot + i][dayIndex] = 'SPAN';
          }
        }
      }
    }

    const doc = new jsPDF({ orientation: 'landscape' });

    const fontRegular = fs.readFileSync('assets/fonts/Roboto-Regular.ttf');
    const fontBold = fs.readFileSync('assets/fonts/Roboto-Bold.ttf');
    doc.addFileToVFS('Roboto-Regular.ttf', fontRegular.toString('base64'));
    doc.addFileToVFS('Roboto-Bold.ttf', fontBold.toString('base64'));
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

    doc.setFont('Roboto', 'bold');
    doc.setFontSize(16);
    doc.text(`Urnik ${professor?.name || ''}`, 14, 15);
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(11);
    doc.text(`Teden: ${professorTimetables[0].weekLabel}`, 14, 22);

    const body: any = [];
    for (let slotIndex = 1; slotIndex < 17; slotIndex++) {
      const row: CellInput[] = [
        `${slots[slotIndex] && slots[slotIndex].split(' ').join(' - ')}`,
      ];
      for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
        const cellData = grid[slotIndex - 1][dayIndex];
        if (cellData === 'SPAN') {
          continue;
        }
        if (cellData) {
          row.push({
            content: '',
            rowSpan: cellData.duration,
            styles: {
              fillColor: cellData.color,
            },
          });
        } else {
          row.push('');
        }
      }
      body.push(row);
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const availableWidth = pageWidth - margin * 2;
    const timeColumnWidth = 30;
    const dayColumnWidth = (availableWidth - timeColumnWidth) / 5;

    autoTable(doc, {
      startY: 28,
      head: [['Ura', ...daysOfWeek]],
      body: body,
      theme: 'grid',
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: '#2c3e50',
        textColor: '#ffffff',
        font: 'Roboto',
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: timeColumnWidth, halign: 'center' },
        1: { cellWidth: dayColumnWidth },
        2: { cellWidth: dayColumnWidth },
        3: { cellWidth: dayColumnWidth },
        4: { cellWidth: dayColumnWidth },
        5: { cellWidth: dayColumnWidth },
      },
      styles: {
        font: 'Roboto',
        fontSize: 8,
        cellPadding: 2,
      },
      didDrawCell: (data) => {
        if (data.cell.section === 'body') {
          const cellData = grid[data.row.index][data.column.index - 1];

          if (cellData && cellData !== 'SPAN') {
            doc.setFillColor(cellData.color as string);
            doc.rect(
              data.cell.x,
              data.cell.y,
              data.cell.width,
              data.cell.height,
              'F',
            );

            const cellCenterX = data.cell.x + data.cell.width / 2;
            const cellTopY = data.cell.y + 6;
            const cellBottomY = data.cell.y + data.cell.height - 4;

            doc.setFont('Roboto', 'bold');
            doc.setFontSize(15);
            doc.text(cellData.subject, cellCenterX, cellTopY, {
              align: 'center',
            });

            if (cellData.group) {
              doc.setFont('Roboto', 'normal');
              doc.setFontSize(12);
              doc.text(`Skupina ${cellData.group}`, cellCenterX, cellTopY + 5, {
                align: 'center',
              });
            }

            doc.setFont('Roboto', 'normal');
            doc.setFontSize(12);
            doc.text(
              cellData.className,
              cellCenterX,
              cellTopY + (cellData.group ? 10 : 5),
              {
                align: 'center',
              },
            );

            doc.text(
              `Uč: ${cellData.classroom ? cellData.classroom : cellData.specialNote}`,
              cellCenterX,
              cellBottomY,
              {
                align: 'center',
                baseline: 'bottom',
              },
            );
          }
        }
      },
    });

    const pdfBuffer = doc.output('arraybuffer');
    return Buffer.from(pdfBuffer);
  }
}
