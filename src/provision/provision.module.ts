import { Module } from '@nestjs/common';
import { ProvisionController } from './provision.controller';
import { ProvisionService } from './provision.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProvisionController],
  providers: [ProvisionService],
})
export class ProvisionModule {}
