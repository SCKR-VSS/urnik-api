import { Controller, Post, Param, Body, Res, HttpStatus } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { Response } from 'express';

interface SkupineDto {
  [key: string]: number;
}

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post(':week/:classId')
  async postTimetable(
    @Param('week') week: string,
    @Param('classId') classId: string,
    @Body() options: { groups: SkupineDto[]; subjects?: string[] },
    @Res() res: Response,
  ) {
    const weekNum = parseInt(week);
    const result = await this.calendarService.createCalendar(
        weekNum,
        classId,
        options,
      );
  
      if (typeof result === 'object' && result.error) {
        res.status(HttpStatus.NOT_FOUND).json(result);
        return;
      }
  
      res.setHeader('Content-Type', 'text/calendar;charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename='urnik-${classId}-${week}.ics'`);
  
      res.send(result);
  }
}
