import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mysql';
import { ApiKey } from 'src/database/entities/api-key.entity';
import { randomBytes } from 'crypto';

@Injectable()
export class AdminService {
  constructor(private readonly em: EntityManager) {}

  async listApiKeys() {
    return this.em.find(ApiKey, {}, { orderBy: { createdAt: 'DESC' } });
  }

  async createApiKey(label?: string, type?: number) {
    const key = randomBytes(32).toString('hex');
    const apiKey = this.em.create(ApiKey, {
      key,
      label: label ?? null,
      type: type ?? 0,
    });
    await this.em.persist(apiKey).flush();
    return apiKey;
  }

  async revokeApiKey(id: number) {
    const apiKey = await this.em.findOne(ApiKey, { id });

    if (!apiKey) {
      throw new NotFoundException(`API key with id ${id} not found.`);
    }

    apiKey.revoked = true;
    await this.em.flush();
    return apiKey;
  }

  async deleteApiKey(id: number) {
    const apiKey = await this.em.findOne(ApiKey, { id });

    if (!apiKey) {
      throw new NotFoundException(`API key with id ${id} not found.`);
    }

    await this.em.remove(apiKey).flush();
  }
}
