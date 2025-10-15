import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
//import { ApiKeyService } from './api-key.service';
//import { PrismaModule } from '../prisma/prisma.module'; // Add when using Prisma

@Module({
  imports: [ConfigModule /*, PrismaModule */],
  providers: [/*ApiKeyService*/],
  exports: [/*ApiKeyService*/],
})
export class AuthModule {}