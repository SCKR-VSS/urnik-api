import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TimetableService } from './timetable.service';

interface SkupineDto {
    [key: string]: number;
}

@Controller('timetable')
export class TimetableController {
    constructor(private readonly timetableService: TimetableService) {}

    @Get(':week/:classId')
    getTimetable(
        @Param('week') week: string,
        @Param('classId') classId: string,
    ) {
        return this.timetableService.getTimetable(week, classId, undefined);
    }

    @Post(':week/:classId')
    postTimetable(
        @Param('week') week: string,
        @Param('classId') classId: string,
        @Body() skupine: SkupineDto[],
    ) {
        return this.timetableService.getTimetable(week, classId, skupine);
    }
}
