import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listApiKeys() {
    return this.prisma.apiKey.findMany({
      select: {
        id: true,
        label: true,
        key: true,
        type: true,
        usageCount: true,
        revoked: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createApiKey(label?: string, type?: number) {
    const key = randomBytes(32).toString('hex');
    return this.prisma.apiKey.create({
      data: {
        key,
        label: label ?? null,
        type: type ?? 0,
      },
      select: {
        id: true,
        label: true,
        key: true,
        type: true,
        usageCount: true,
        revoked: true,
        createdAt: true,
      },
    });
  }

  async revokeApiKey(id: number) {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id } });

    if (!apiKey) {
      throw new NotFoundException(`API key with id ${id} not found.`);
    }

    return this.prisma.apiKey.update({
      where: { id },
      data: { revoked: true },
      select: {
        id: true,
        label: true,
        key: true,
        type: true,
        usageCount: true,
        revoked: true,
        createdAt: true,
      },
    });
  }

  async deleteApiKey(id: number) {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id } });

    if (!apiKey) {
      throw new NotFoundException(`API key with id ${id} not found.`);
    }

    await this.prisma.apiKey.delete({ where: { id } });
  }
}
