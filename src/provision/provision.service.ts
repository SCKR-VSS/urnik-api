import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mysql';
import { ApiKey } from 'src/database/entities/api-key.entity';
import * as crypto from 'crypto';

@Injectable()
export class ProvisionService {
  constructor(private readonly em: EntityManager) {}

  async provisionApiKey(description?: string): Promise<{ apiKey: string }> {
    const key = crypto.randomBytes(32).toString('hex');
    const apiKey = this.em.create(ApiKey, { key, type: 1 });
    await this.em.persist(apiKey).flush();
    return { apiKey: key };
  }
}