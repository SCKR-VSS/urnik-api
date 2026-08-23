import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [ConfigModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
