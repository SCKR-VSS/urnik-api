import { Controller, Post, Param, Body, Res, Get, Query, Req, HttpStatus } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { Public } from 'src/auth/public.decorator';

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

  /**
   * Subscribable ICS feed for a class.
   *
   * Query params:
   *   subjects  – comma-separated subject codes to include, e.g. MAT,FIZ
   *   groups    – comma-separated SUBJECT:N pairs, e.g. MAT:1,FIZ:2
   *
   * Calendar apps can subscribe to this URL and receive a live,
   * personalised feed of upcoming lessons.
   */
  @Public()
  @Get('feed/:classId')
  async getFeed(
    @Param('classId') classId: string,
    @Query('subjects') subjectsParam: string,
    @Query('groups') groupsParam: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (subjectsParam?.length > 500 || groupsParam?.length > 500) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'Query parameters too long' });
      return;
    }

    const subjects = subjectsParam
      ? subjectsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const groups: { [subject: string]: number } | undefined = groupsParam
      ? Object.fromEntries(
          groupsParam
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.includes(':'))
            .map((s) => {
              const idx = s.lastIndexOf(':');
              const sub = s.slice(0, idx).trim();
              const grp = s.slice(idx + 1).trim();
              return [sub, parseInt(grp, 10)];
            })
            .filter(([, grp]) => !isNaN(grp as number)),
        )
      : undefined;

    const feedUrl = `${req.protocol}://${req.get('host')}${req.path}`;

    const result = await this.calendarService.createFeed(classId, feedUrl, subjects, groups);

    if (typeof result === 'object' && 'error' in result) {
      res.status(HttpStatus.NOT_FOUND).json(result);
      return;
    }

    const etag = `"${createHash('md5').update(result as string).digest('hex')}"`;

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('Content-Type', 'text/calendar;charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('ETag', etag);
    res.send(result);
  }
}
