import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AccessGuard } from './auth.guard';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessGuard,
    },
  ],
})
export class AuthModule {}