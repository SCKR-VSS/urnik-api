import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OptionsModule } from './options/options.module';
import { TimetableModule } from './timetable/timetable.module';
import { ConfigModule } from '@nestjs/config';
import { GroupsModule } from './groups/groups.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { CalendarModule } from './calendar/calendar.module';
import { MailingModule } from './mailing/mailing.module';
import { ProvisionModule } from './provision/provision.module';

@Module({
  imports: [
    AuthModule,
    OptionsModule,
    CacheModule.register({
      isGlobal: true,
      ttl: 10 * 60 * 1000
    }),
    TimetableModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GroupsModule,
    ScheduleModule.forRoot(),
    ProvisionModule,
    PrismaModule,
    CalendarModule,
    MailingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
