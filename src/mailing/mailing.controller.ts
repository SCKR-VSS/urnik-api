import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { MailingService } from './mailing.service';
import { Response } from 'express';

@Controller('mailing')
export class MailingController {
    constructor(private mailingService: MailingService) {}

    @Post('subscribe/:classId')
    async subscribe(
        @Param('classId') classId: string,
        @Body() body: { email: string; subjects: string[]; groups: { [key: string]: number } },
    ) {
        const classIdNum = parseInt(classId);
        return this.mailingService.saveMail(body.email, classIdNum, body.subjects, body.groups);
    }

    @Post('professor/subscribe/:professorId')
    async professorSubscribe(
        @Param('professorId') professorId: string,
        @Body() body: { email: string },
    ) {
        const professorIdNum = parseInt(professorId);
        return this.mailingService.saveProfessorMail(body.email, professorIdNum);
    }

    @Get('remove')
    async remove(
        @Query('email') email: string,
        @Res() res: Response
    ) {
        try {
            await this.mailingService.removeMail(email);
            res.redirect(`${process.env.ALLOWED_DOMAIN}/email?success=true`);
        } catch (error) {
            res.redirect(`${process.env.ALLOWED_DOMAIN}/email?success=false`);
        }
    }
}