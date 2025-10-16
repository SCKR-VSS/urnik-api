import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { OptionsModule } from 'src/options/options.module';

@Module({
  imports: [OptionsModule],
  controllers: [GroupsController],
  providers: [GroupsService]
})
export class GroupsModule {}
