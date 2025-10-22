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
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
