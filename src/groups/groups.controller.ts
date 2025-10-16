import { Controller, Get, Param } from '@nestjs/common';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
    constructor(private readonly groupsService: GroupsService) {}

    @Get(':classId')
    getGroups(
        @Param('classId') classId: string,
    ) {
        return this.groupsService.getGroups(classId);
    }
}
