import {
  Inject,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CACHE_MANAGER, Cache} from '@nestjs/cache-manager';

export interface OptionsResponse {
  classes: any[];
  weeks: { value: number; label: string }[];
}

@Injectable()
export class OptionsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getOptions(): Promise<OptionsResponse> {
    const cacheKey = 'options';
    const cachedOptions: OptionsResponse | undefined = await this.cacheManager.get(cacheKey);

    if (cachedOptions) {
      return cachedOptions;
    }

    const classes = await this.prisma.class.findMany();

    const weeks: { value: number; label: string }[] = [];

    const weeksInDb = await this.prisma.week.findMany();

    for (const week of weeksInDb) {
      weeks.push({ value: week.id, label: week.label });
    }

    const options = {
      classes,
      weeks,
    };

    await this.cacheManager.set(cacheKey, options);

    return options;
  }

  async getProfessors(): Promise<{ id: number, name: string }[]> {
    const cacheKey = 'professors';
    const cachedOptions: { id: number, name: string }[] | undefined = await this.cacheManager.get(cacheKey);

    if (cachedOptions) {
      return cachedOptions;
    }

    const professors = await this.prisma.professor.findMany();

    await this.cacheManager.set(cacheKey, professors);

    return professors;
  }
}
