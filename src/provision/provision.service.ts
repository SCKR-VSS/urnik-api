import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ProvisionService {
  constructor(private readonly prisma: PrismaService) {}

  async provisionApiKey(description?: string): Promise<{ apiKey: string }> {
    const key = crypto.randomBytes(32).toString('hex');
    await this.prisma.apiKey.create({
      data: {
        key,
        type: 1,
      },
    });
    return { apiKey: key };
  }
}