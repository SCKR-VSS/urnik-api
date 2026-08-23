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
import { CalendarModule } from './calendar/calendar.module';
import { MailingModule } from './mailing/mailing.module';
import { ProvisionModule } from './provision/provision.module';
import { AdminModule } from './admin/admin.module';
import { PushModule } from './push/push.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { defineConfig } from '@mikro-orm/mysql';
import { GeneratedCacheAdapter } from '@mikro-orm/core';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const metadataCache = require('../temp/metadata.json');
import { SchoolClass } from './database/entities/school-class.entity';
import { Week } from './database/entities/week.entity';
import { Timetable } from './database/entities/timetable.entity';
import { Mail } from './database/entities/mail.entity';
import { Professor } from './database/entities/professor.entity';
import { ApiKey } from './database/entities/api-key.entity';
import { PushSubscription } from './database/entities/push-subscription.entity';
import { Profmail } from './database/entities/profmail.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MikroOrmModule.forRoot(defineConfig({
      entities: [SchoolClass, Week, Timetable, Mail, Professor, ApiKey, PushSubscription, Profmail],
      clientUrl: process.env.DATABASE_URL,
      metadataCache: { enabled: true, adapter: GeneratedCacheAdapter, options: { data: metadataCache } },
    })),
    AuthModule,
    OptionsModule,
    CacheModule.register({
      isGlobal: true,
      ttl: 10 * 60 * 1000
    }),
    TimetableModule,
    GroupsModule,
    ScheduleModule.forRoot(),
    ProvisionModule,
    CalendarModule,
    MailingModule,
    AdminModule,
    PushModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
