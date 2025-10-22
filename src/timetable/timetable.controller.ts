import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { Response } from 'express';

interface SkupineDto {
  [key: string]: number;
}

@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get(':week/:classId')
  getTimetable(@Param('week') week: string, @Param('classId') classId: string) {
    const weekNum = parseInt(week);
    return this.timetableService.getTimetable(weekNum, classId, undefined);
  }

  @Post(':week/:classId')
  postTimetable(
    @Param('week') week: string,
    @Param('classId') classId: string,
    @Body() skupine: SkupineDto[],
  ) {
    const weekNum = parseInt(week);
    return this.timetableService.getTimetable(weekNum, classId, skupine);
  }

  @Get('professor/:week/:professorId')
  getProfessorTimetable(
    @Param('week') week: string,
    @Param('professorId') professorId: string,
  ) {
    const weekNum = parseInt(week);
    return this.timetableService.getProfessor(weekNum, professorId);
  }

  @Get('professor/:week/:professorId/pdf')
  async getProfessorPdf(
    @Param('week') week: string,
    @Param('professorId') professorId: string,
    @Res() res: Response,
  ) {
    const weekNum = parseInt(week);
    try {
      const pdfBuffer = await this.timetableService.getProfessorPdf(
        weekNum,
        professorId,
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="urnik_${professorId}_${week}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error) {
      res.status(404).send({ message: error.message });
    }
  }
}
