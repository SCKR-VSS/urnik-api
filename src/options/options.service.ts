import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from '@nestjs/cache-manager';

@Injectable()
export class OptionsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getOptions() {
    const cacheKey = 'options';
    const cachedOptions = await this.cacheManager.get(cacheKey);

    if (cachedOptions) {
      return cachedOptions;
    }

    const classes = await this.prisma.class.findMany();

    const weeks: { value: string; label: string }[] = [];

    try {
      const response = await fetch(
        'https://sckr.si/vss/urniki/frames/navbar.htm',
      );

      if (response.ok) {
        const html = await response.text();
        const optionRegex =
          /<option value="(\d+)">(\d+\.\d+\.\d{4})<\/option>/g;

        let match: any;

        while ((match = optionRegex.exec(html)) !== null) {
          const weekValue = match[1];
          const dateLabel = match[2];
          weeks.push({ value: weekValue, label: dateLabel });
        }

        weeks.sort((a, b) => parseInt(a.value, 10) - parseInt(b.value, 10));
      } else {
        console.error('Failed to fetch weeks:', response.statusText);
        throw new ServiceUnavailableException(
          'Failed to fetch schedule weeks from external source.',
        );
      }
    } catch (error) {
      console.error('Error during fetch for weeks:', error);
      throw new ServiceUnavailableException(
        'Failed to fetch schedule weeks due to a network error.',
      );
    }

    const options = {
      classes,
      weeks,
    };

    await this.cacheManager.set(cacheKey, options);

    return options;
  }
}
