import { Controller, Get, Param } from '@nestjs/common';
import { OptionsService } from './options.service';
import { ApiKeyAccess } from 'src/auth/api-key-access.decorator';

@ApiKeyAccess()
@Controller('options')
export class OptionsController { 
    constructor(private readonly optionsService: OptionsService) {}

    @Get()
    getOptions() {
        return this.optionsService.getOptions();
    }

    @Get('professors')
    getProfessors() {
        return this.optionsService.getProfessors();
    }

    @Get('subjects/:classId')
    getSubjects(
        @Param('classId') classId: string,
    ) {
        return this.optionsService.getSubjects(classId);
    }
}
